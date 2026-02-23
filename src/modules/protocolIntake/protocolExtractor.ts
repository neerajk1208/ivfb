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

1. **Dates & Cycle Start**: 
   - IMPORTANT: Day 0 = the FIRST date that has ANY content (medication checkmarks, doses, appointments, or any data)
   - Do NOT use empty columns as Day 0 - skip them
   - If calendar shows Feb 5-19 but Feb 5-6 columns are empty, and first medication/appointment is on Feb 7, then Feb 7 is Day 0
   - Look at the grid carefully: which column has the FIRST checkmark, number, or appointment marker?
   - Count consecutive days the medication appears for durationDays

2. **Reading Calendar Grids**:
   - Medications are usually listed in ROWS on the left
   - Dates are usually COLUMNS across the top
   - A checkmark (✓, X, or filled box) in a cell means that medication is taken on that date
   - Match each row's content to the correct column's date
   - BW, U/S, appointments are usually at the TOP or BOTTOM of the grid

3. **Dosages**:
   - Extract numeric amount separately (e.g., 225)
   - Extract unit separately (e.g., IU, mg, mL)
   - If unclear, put full string in "dosage" field

4. **Times**:
   - Morning meds usually taken 7-9 AM
   - Evening meds usually taken 7-10 PM
   - TRIGGER SHOTS have exact times (e.g., "10:00 PM") - this is CRITICAL
   - Use 24-hour format: "22:00" not "10:00 PM"

5. **Routes**:
   - Most IVF injectables are subcutaneous
   - PIO (progesterone in oil) is intramuscular
   - Pills are oral
   - Suppositories/inserts are vaginal

6. **Appointments - TYPES MATTER**:
   - BW alone = BLOODWORK
   - U/S alone = ULTRASOUND  
   - BW + U/S or "Monitoring" = MONITORING (combined visit)
   - VOR, ER, "Retrieval" = RETRIEVAL (critical=true)
   - ET, "Transfer" = TRANSFER (critical=true)
   - Trigger = TRIGGER (critical=true)
   - Do NOT default everything to MONITORING - read what each appointment actually says

## OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
${JSON.stringify(protocolPlanExtractionJsonSchema, null, 2)}

## CRITICAL REMINDERS:
- CYCLE START: First date with ACTUAL content, NOT first visible date if empty
- Count the ACTUAL number of days a medication appears (don't assume)
- Extract EXACT trigger time if shown
- BW/U/S are appointments, not medications
- APPOINTMENT TYPES: Read carefully - BW=BLOODWORK, U/S=ULTRASOUND, both=MONITORING, VOR/ER=RETRIEVAL, ET=TRANSFER
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

STEP 1 - FIND THE TRUE CYCLE START DATE:
- Look at the calendar grid columns (dates across the top)
- Find the FIRST column that has ANY content (checkmarks, doses, appointments)
- SKIP empty columns at the start - they are NOT Day 0
- The first date with actual data is cycleStartDate (Day 0)

STEP 2 - READ THE GRID STRUCTURE:
- Medications are usually ROWS on the left side
- Dates are COLUMNS across the top
- A checkmark/X/filled box means that med is taken on that date
- Carefully match each cell to its row (medication) and column (date)

STEP 3 - EXTRACT MEDICATIONS:
- For each medication row, find which columns have marks
- startDayOffset = number of days from cycleStartDate to first mark
- durationDays = count of consecutive days with marks

STEP 4 - EXTRACT APPOINTMENTS (TYPE MATTERS!):
- "BW" alone = type: "BLOODWORK"
- "U/S" alone = type: "ULTRASOUND"
- "BW + U/S" or "Monitoring" = type: "MONITORING"
- "VOR", "ER", "Retrieval" = type: "RETRIEVAL"
- "ET", "Transfer" = type: "TRANSFER"
- "Trigger" with time = type: "TRIGGER"
- Do NOT default everything to MONITORING

STEP 5 - VERIFY:
- Double-check that cycleStartDate matches first date with content
- Verify appointment types match what's written

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

  // Clean medication names in validated data
  const cleanedData = {
    ...validated.data,
    medications: validated.data.medications.map(med => ({
      ...med,
      name: cleanMedicationName(med.name),
    })),
  };

  // Check if extraction found anything useful
  if (cleanedData.medications.length === 0 && cleanedData.appointments.length === 0) {
    return {
      ...cleanedData,
      confidence: {
        cycleStartDate: "low",
        medications: "low",
        appointments: "low",
      },
      missingFields: [...(cleanedData.missingFields || []), "no_data_found"],
    };
  }

  return cleanedData;
}

function cleanMedicationName(name: string): string {
  if (!name) return "Unknown";
  
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  
  if (words.length >= 2) {
    const firstWord = words[0].toLowerCase();
    const duplicateCount = words.filter(w => w.toLowerCase() === firstWord).length;
    if (duplicateCount === words.length) {
      return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
    }
  }
  
  return trimmed;
}

function normalizeMedication(med: any): any {
  return {
    name: cleanMedicationName(med.name),
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
