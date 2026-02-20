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

const EXTRACTION_PROMPT = `You are an expert at extracting IVF medication protocol data from clinic documents.

IMPORTANT: These documents come in many formats:
- Calendar/grid schedules with dates and medication abbreviations
- Text lists of medications with dosages and timing
- Mixed formats with instructions and schedules

Common IVF medication abbreviations:
- GF, Gonal-F, Follistim = FSH injection (follicle stimulating hormone)
- Men, Menopur = Menotropin injection
- Cetrotide, Ganirelix = GnRH antagonist
- Estrace, E2 = Estradiol
- Provera = Medroxyprogesterone
- HCG, Ovidrel, Pregnyl = Trigger shot
- BW = Bloodwork, U/S = Ultrasound (these are appointments, not medications)
- VOR, ER = Egg Retrieval (milestone, not medication)
- ET = Embryo Transfer (milestone)

Your task:
1. Extract ALL medications with their schedules
2. Convert calendar dates to day offsets (day 0 = first day shown or cycle start)
3. Identify milestones like monitoring, trigger, retrieval, transfer
4. If something is unclear, set confidence to "low" and add to missingFields

Output ONLY valid JSON matching this schema:
${JSON.stringify(protocolPlanExtractionJsonSchema, null, 2)}

Rules:
- cycleStartDate: Use the first date shown, format YYYY-MM-DD, or null if unclear
- startDayOffset: Relative to cycle start (0 = first day)
- durationDays: Count how many days the medication appears
- timeOfDay: Extract if mentioned (morning, evening, etc.)
- Do NOT include bloodwork/ultrasound as medications - those are appointments
- Do NOT make up information - only extract what you see`;

export async function extractProtocolFromText(
  extractedText: string
): Promise<ProtocolPlanExtraction> {
  const openai = getOpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Extract the protocol from this text:\n\n${extractedText}` },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return parseAndValidate(content);
  } catch (error) {
    console.error("Text extraction error:", error);
    return getFailedExtraction("Failed to extract from text");
  }
}

export async function extractProtocolFromImage(
  imageBase64: string
): Promise<ProtocolPlanExtraction> {
  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Vision requires gpt-4o or gpt-4-turbo
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the IVF protocol from this image. Return JSON only." },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI Vision");
    }

    return parseAndValidate(content);
  } catch (error) {
    console.error("Image extraction error:", error);
    return getFailedExtraction("Failed to extract from image. Please try a clearer image or enter manually.");
  }
}

function parseAndValidate(content: string): ProtocolPlanExtraction {
  // Extract JSON from response (may have markdown wrapper)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON found in response:", content);
    return getFailedExtraction("Could not parse extraction result");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = protocolPlanExtractionSchema.safeParse(parsed);

  if (!validated.success) {
    console.error("Validation failed:", validated.error.message);
    // Try to salvage what we can
    return {
      cycleStartDate: parsed.cycleStartDate || null,
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
      notes: parsed.notes || null,
      confidence: parsed.confidence || {
        cycleStartDate: "low",
        medications: "low",
        milestones: "low",
      },
      missingFields: parsed.missingFields || ["validation_failed"],
    };
  }

  // Check if extraction actually found anything
  if (validated.data.medications.length === 0) {
    return {
      ...validated.data,
      confidence: {
        cycleStartDate: "low",
        medications: "low",
        milestones: "low",
      },
      missingFields: [...(validated.data.missingFields || []), "no_medications_found"],
    };
  }

  return validated.data;
}

function getFailedExtraction(reason: string): ProtocolPlanExtraction {
  return {
    cycleStartDate: null,
    medications: [],
    milestones: [],
    notes: reason,
    confidence: {
      cycleStartDate: "low",
      medications: "low",
      milestones: "low",
    },
    missingFields: ["extraction_failed"],
  };
}
