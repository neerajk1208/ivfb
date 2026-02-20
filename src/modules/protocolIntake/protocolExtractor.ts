import OpenAI from "openai";
import {
  protocolPlanExtractionSchema,
  protocolPlanExtractionJsonSchema,
  type ProtocolPlanExtraction,
} from "./protocolSchemas";

function getOpenAI(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

const SYSTEM_PROMPT = `You are a careful assistant extracting structured IVF protocol plan data from clinic instructions.

Your task is to extract medication schedules and important milestones from the provided text.

Rules:
1. Output MUST be valid JSON matching the provided schema exactly.
2. Do not include any extra keys or commentary.
3. If a field cannot be determined, set it to null and add it to missingFields.
4. Set confidence levels based on clarity of the source text.
5. startDayOffset is relative to cycle start (day 0 = cycle start date).
6. durationDays must be at least 1.
7. If time of day is mentioned (e.g., "8pm", "morning"), extract it.
8. Keep extraction purely structural - no medical advice or interpretation.`;

function buildUserPrompt(extractedText: string): string {
  return `Extract the IVF protocol plan from the following text. Return ONLY valid JSON matching this schema:

${JSON.stringify(protocolPlanExtractionJsonSchema, null, 2)}

Text to extract from:
---
${extractedText}
---

Remember:
- cycleStartDate should be YYYY-MM-DD format or null
- startDayOffset is relative to cycle start (0 = start day)
- If uncertain about any field, set confidence to "low" and add to missingFields
- Do not make up information - only extract what is clearly stated`;
}

export async function extractProtocolFromText(
  extractedText: string,
  retryOnFailure = true
): Promise<ProtocolPlanExtraction> {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  try {
    const openai = getOpenAI();
    const response = await openai.responses.create({
      model,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(extractedText) },
      ],
    });

    const content = response.output_text;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = protocolPlanExtractionSchema.safeParse(parsed);

    if (!validated.success) {
      if (retryOnFailure) {
        console.warn("Validation failed, retrying with correction prompt");
        return await retryExtraction(extractedText, content, validated.error.message);
      }
      throw new Error(`Invalid extraction format: ${validated.error.message}`);
    }

    return validated.data;
  } catch (error) {
    console.error("Protocol extraction error:", error);
    
    return getEmptyExtraction();
  }
}

async function retryExtraction(
  originalText: string,
  previousResponse: string,
  errorMessage: string
): Promise<ProtocolPlanExtraction> {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const retryPrompt = `Your previous output did not match the required schema.

Error: ${errorMessage}

Previous response:
${previousResponse}

Please fix the JSON to match the schema exactly. Here is the original text again:
---
${originalText}
---

Return ONLY the corrected JSON.`;

  try {
    const openai = getOpenAI();
    const response = await openai.responses.create({
      model,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: retryPrompt },
      ],
    });

    const content = response.output_text;
    if (!content) {
      throw new Error("Empty response from OpenAI on retry");
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in retry response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = protocolPlanExtractionSchema.safeParse(parsed);

    if (!validated.success) {
      console.error("Retry also failed validation:", validated.error.message);
      return getEmptyExtraction();
    }

    return validated.data;
  } catch (error) {
    console.error("Retry extraction error:", error);
    return getEmptyExtraction();
  }
}

function getEmptyExtraction(): ProtocolPlanExtraction {
  return {
    cycleStartDate: null,
    medications: [],
    milestones: [],
    notes: null,
    confidence: {
      cycleStartDate: "low",
      medications: "low",
      milestones: "low",
    },
    missingFields: ["cycleStartDate", "medications", "milestones"],
  };
}
