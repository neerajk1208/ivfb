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

const EXTRACTION_PROMPT = `You are an expert IVF nurse extracting medication protocols from clinic documents.

## DOCUMENT TYPES YOU'LL SEE:
1. **Calendar/Grid Format** - Dates across top, medications down the side with checkmarks/doses per day
2. **List Format** - Text list of medications with instructions
3. **Mixed Format** - Combination with notes and schedules

## COMMON IVF MEDICATIONS (extract these when you see them):

**Stimulation Medications (FSH/LH):**
- Gonal-F, GF = Follitropin alfa, injectable, usually IU (75-450 IU)
- Follistim = Follitropin beta, injectable, IU
- Menopur, Men = Menotropins, injectable, IU (75-150 IU typical)

**GnRH Antagonists (prevent premature ovulation):**
- Cetrotide = Cetrorelix, subcutaneous, 0.25mg typical
- Ganirelix = Ganirelix acetate, subcutaneous, 0.25mg typical

**GnRH Agonists:**
- Lupron = Leuprolide, subcutaneous, various doses

**Estrogen:**
- Estrace = Estradiol, oral/vaginal, mg
- Estradiol patches

**Progesterone:**
- PIO = Progesterone in Oil, intramuscular, mL or mg
- Endometrin = Progesterone, vaginal insert, 100mg
- Crinone = Progesterone gel, vaginal, 8%

**Trigger Shots (EXACT TIME CRITICAL):**
- Ovidrel = Choriogonadotropin alfa, subcutaneous, 250mcg
- HCG, Pregnyl = Human chorionic gonadotropin, intramuscular, 10000 IU
- Lupron trigger = Leuprolide, for dual trigger

**Other:**
- Provera = Medroxyprogesterone, oral, mg
- Dexamethasone = steroid, oral, mg
- Doxycycline = antibiotic, oral, mg
- Methylprednisolone = steroid, oral, mg
- Baby aspirin = 81mg, oral

## APPOINTMENTS TO IDENTIFY:
- **BW** = Bloodwork (usually fasting if AM)
- **U/S** = Ultrasound / monitoring
- **BW + U/S** or **Monitoring** = Combined visit
- **VOR** or **ER** = Egg Retrieval (CRITICAL - exact time matters)
- **ET** = Embryo Transfer (CRITICAL - exact time matters)
- **β** or **Beta** = Pregnancy test

## EXTRACTION RULES:

1. **Dates**: 
   - Day 0 = first date shown on calendar
   - Count consecutive days the medication appears for durationDays
   - If calendar shows Feb 5-19, first date Feb 5 is day 0

2. **Dosages**:
   - Extract numeric amount separately (e.g., 225)
   - Extract unit separately (e.g., IU, mg, mL)
   - If unclear, put full string in "dosage" field

3. **Times**:
   - Morning meds usually taken 7-9 AM
   - Evening meds usually taken 7-10 PM
   - TRIGGER SHOTS have exact times (e.g., "10:00 PM") - this is CRITICAL
   - Use 24-hour format: "22:00" not "10:00 PM"

4. **Routes**:
   - Most IVF injectables are subcutaneous
   - PIO (progesterone in oil) is intramuscular
   - Pills are oral
   - Suppositories/inserts are vaginal

5. **Appointments**:
   - Mark RETRIEVAL and TRANSFER as critical=true
   - Mark TRIGGER as critical=true
   - Bloodwork is often fasting=true if early morning

## OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
${JSON.stringify(protocolPlanExtractionJsonSchema, null, 2)}

## CRITICAL REMINDERS:
- Count the ACTUAL number of days a medication appears (don't assume)
- Extract EXACT trigger time if shown
- BW/U/S are appointments, not medications
- If you can't determine something, set confidence to "low" and add to missingFields
- Do NOT make up information - only extract what you clearly see`;

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
        { role: "user", content: `Extract the IVF protocol from this text. Return JSON only.\n\n${extractedText}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Lower temperature for more consistent extraction
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
  if (!imageBase64 || !imageBase64.startsWith("data:image/")) {
    console.error("Invalid image format - not a data URL");
    return getFailedExtraction("Invalid image format");
  }

  const sizeInMB = (imageBase64.length * 0.75) / (1024 * 1024);
  if (sizeInMB > 20) {
    console.error(`Image too large: ${sizeInMB.toFixed(2)}MB`);
    return getFailedExtraction("Image too large. Please use a smaller image (under 20MB).");
  }

  console.log(`Processing image: ~${sizeInMB.toFixed(2)}MB`);

  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `Carefully analyze this IVF protocol calendar/document. 
              
Look at EACH day and EACH medication row. Count exactly how many days each medication is marked.

For calendar formats:
- Identify the date range shown
- For each medication row, count the days with checkmarks or doses
- Note any dosage changes mid-cycle
- Extract bloodwork (BW) and ultrasound (U/S) appointments
- Find the trigger shot time (usually an exact time like 10:00 PM)
- Identify egg retrieval (VOR/ER) date

Return JSON only.` 
            },
            { type: "image_url", image_url: { url: imageBase64, detail: "high" } },
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI Vision");
    }

    console.log("OpenAI Vision response received");
    return parseAndValidate(content);
  } catch (error: any) {
    console.error("Image extraction error:", error?.message || error);
    
    if (error?.status === 400) {
      return getFailedExtraction("Could not process this image. Please try a clearer image or enter manually.");
    }
    if (error?.status === 401) {
      return getFailedExtraction("API configuration error. Please contact support.");
    }
    if (error?.status === 429) {
      return getFailedExtraction("Service busy. Please try again in a moment.");
    }
    
    return getFailedExtraction("Failed to extract from image. Please try a clearer image or enter manually.");
  }
}

function parseAndValidate(content: string): ProtocolPlanExtraction {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON found in response:", content);
    return getFailedExtraction("Could not parse extraction result");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON parse error:", e);
    return getFailedExtraction("Invalid JSON in response");
  }

  // Ensure appointments array exists (backwards compatibility)
  if (!parsed.appointments) {
    parsed.appointments = [];
  }
  if (!parsed.milestones) {
    parsed.milestones = [];
  }
  if (!parsed.confidence?.appointments) {
    parsed.confidence = {
      ...parsed.confidence,
      appointments: parsed.confidence?.milestones || "low",
    };
  }

  const validated = protocolPlanExtractionSchema.safeParse(parsed);

  if (!validated.success) {
    console.error("Validation failed:", validated.error.message);
    // Salvage what we can
    return {
      cycleStartDate: parsed.cycleStartDate || null,
      medications: Array.isArray(parsed.medications) ? parsed.medications.map(normalizeMedication) : [],
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
      notes: parsed.notes || null,
      confidence: {
        cycleStartDate: parsed.confidence?.cycleStartDate || "low",
        medications: parsed.confidence?.medications || "low",
        appointments: parsed.confidence?.appointments || "low",
      },
      missingFields: parsed.missingFields || ["validation_failed"],
    };
  }

  // Check if extraction found anything useful
  if (validated.data.medications.length === 0 && validated.data.appointments.length === 0) {
    return {
      ...validated.data,
      confidence: {
        cycleStartDate: "low",
        medications: "low",
        appointments: "low",
      },
      missingFields: [...(validated.data.missingFields || []), "no_data_found"],
    };
  }

  return validated.data;
}

function normalizeMedication(med: any): any {
  return {
    name: med.name || "Unknown",
    dosageAmount: typeof med.dosageAmount === "number" ? med.dosageAmount : null,
    dosageUnit: med.dosageUnit || null,
    dosage: med.dosage || null,
    frequency: med.frequency || "once_daily",
    route: med.route || null,
    startDayOffset: typeof med.startDayOffset === "number" ? med.startDayOffset : 0,
    durationDays: typeof med.durationDays === "number" && med.durationDays > 0 ? med.durationDays : 1,
    timeOfDay: med.timeOfDay || null,
    exactTime: med.exactTime || med.customTime || null,
    instructions: med.instructions || null,
  };
}

function getFailedExtraction(reason: string): ProtocolPlanExtraction {
  return {
    cycleStartDate: null,
    medications: [],
    appointments: [],
    milestones: [],
    notes: reason,
    confidence: {
      cycleStartDate: "low",
      medications: "low",
      appointments: "low",
    },
    missingFields: ["extraction_failed"],
  };
}
