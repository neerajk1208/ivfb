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

## SPECIAL INSTRUCTIONS TO CAPTURE:
For EACH medication, look for and include in the "instructions" field:
- Mixing/preparation details (e.g., "mix 2 powder vials in 1mL liquid")
- Number of vials/ampules to use together
- Reconstitution instructions (e.g., "dissolve powder in saline")
- Storage notes (e.g., "refrigerate after mixing")
- Administration tips (e.g., "rotate injection sites", "inject slowly")
- Any other notes about how to prepare or give the medication
- Do NOT leave instructions empty if there are preparation details visible

## EXTRACTION RULES:

1. **EXTRACT ACTUAL DATES - THIS IS CRITICAL**:
   - For medications: Read the ACTUAL DATE from the column header where each medication starts and ends
   - For appointments: Read the ACTUAL DATE from the column header where the appointment is marked
   - Use YYYY-MM-DD format (e.g., "2025-02-15")
   - DO NOT calculate day offsets - just read the dates you see
   - If calendar shows "Feb 15" as a column header and medication has a mark there, startDate = "2025-02-15"

2. **Reading Calendar Grids**:
   - Dates are shown as COLUMN HEADERS (e.g., "Feb 15", "Feb 16", "2/15", "2/16")
   - Medications are usually listed in ROWS on the left
   - A checkmark (✓, X, or filled box) in a cell means that medication is taken on that column's date
   - Match each cell to its column's date header
   - BW, U/S, appointments are usually at the TOP or BOTTOM of the grid

3. **Dosages**:
   - Extract numeric amount separately (e.g., 225)
   - Extract unit separately (e.g., IU, mg, mL)
   - For pills: dosageAmount = number of pills, dosageUnit = "pills", unitStrength = strength per pill (e.g., "2mg")
   - Example: "Take 2 pills of Estrace 2mg" → dosageAmount=2, dosageUnit="pills", unitStrength="2mg"
   - If unclear, put full string in "dosage" field

4. **Times**:
   - Morning meds usually taken 7-9 AM
   - Evening meds usually taken 7-10 PM
   - TRIGGER SHOTS have exact times (e.g., "10:00 PM") - this is CRITICAL
   - Use 24-hour format: "22:00" not "10:00 PM"
   - For ONCE DAILY: use timeOfDay and exactTime fields
   - For TWICE DAILY or THREE TIMES DAILY: use the "doses" array:
     * doses: [{ doseNumber: 1, timeOfDay: "morning", exactTime: "08:00" }, { doseNumber: 2, timeOfDay: "evening", exactTime: "20:00" }]
     * Each dose should have its own time

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
- READ ACTUAL DATES from column headers - do NOT calculate offsets
- For each medication: startDate = first column with mark, endDate = last column with mark
- For each appointment: date = the column where it's marked
- Extract EXACT trigger time if shown - this is critical for IVF success
- BW/U/S are appointments, not medications
- APPOINTMENT TYPES: Read carefully - BW=BLOODWORK, U/S=ULTRASOUND, both=MONITORING, VOR/ER=RETRIEVAL, ET=TRANSFER
- IMPORTANT: Include ALL appointments shown - Trigger shots, Retrieval (VOR/ER), Transfer (ET) are CRITICAL events
- If you can't determine something, set confidence to "low" and add to missingFields`;

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

STEP 1 - READ THE CALENDAR DATES:
- Look at the column headers - they show dates (e.g., "Feb 15", "Feb 16", "2/15", "2/16")
- Note the year context (assume current year if not shown)
- These are the ACTUAL DATES you will extract

STEP 2 - EXTRACT MEDICATIONS WITH ACTUAL DATES:
- For each medication row, find which columns have marks/checkmarks
- startDate = the date from the FIRST column header that has a mark for this medication
- endDate = the date from the LAST column header that has a mark for this medication
- Example: If "Gonal-F" row has marks in columns "Feb 15" through "Feb 27":
  startDate: "2025-02-15", endDate: "2025-02-27"
- DO NOT calculate offsets - just read the actual dates from column headers

STEP 3 - EXTRACT APPOINTMENTS WITH ACTUAL DATES:
- For each appointment shown, read the date from its column header
- date = the ACTUAL date where this appointment is marked
- Example: If "BW" is marked in the "Feb 17" column:
  type: "BLOODWORK", date: "2025-02-17"
- Type mapping:
  * "BW" alone = BLOODWORK
  * "U/S" alone = ULTRASOUND
  * "BW + U/S" or "Monitoring" = MONITORING
  * "VOR", "ER", "Retrieval" = RETRIEVAL (set critical: true)
  * "ET", "Transfer" = TRANSFER (set critical: true)
  * "Trigger" with time = TRIGGER (set critical: true, include exactTime!)
- IMPORTANT: Trigger, Retrieval (VOR/ER), and Transfer (ET) are CRITICAL - do not skip them!

STEP 4 - VERIFY:
- Double-check each date matches its column header
- Verify appointment types match what's written
- Ensure Trigger shot time is captured if shown

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

function computeCycleStartDate(medications: any[], appointments: any[]): string | null {
  const allDates: string[] = [];
  
  for (const med of medications) {
    if (med.startDate) allDates.push(med.startDate);
  }
  for (const apt of appointments) {
    if (apt.date) allDates.push(apt.date);
  }
  
  if (allDates.length === 0) return null;
  
  // Sort dates and return the earliest
  allDates.sort();
  return allDates[0];
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function processMedicationDates(med: any, cycleStartDate: string): any {
  const processed = { ...med };
  
  if (med.startDate && cycleStartDate) {
    processed.startDayOffset = daysBetween(cycleStartDate, med.startDate);
  } else {
    processed.startDayOffset = med.startDayOffset ?? 0;
  }
  
  if (med.startDate && med.endDate) {
    processed.durationDays = daysBetween(med.startDate, med.endDate) + 1;
  } else {
    processed.durationDays = med.durationDays ?? 1;
  }
  
  return processed;
}

function processAppointmentDates(apt: any, cycleStartDate: string): any {
  const processed = { ...apt };
  
  if (apt.date && cycleStartDate) {
    processed.dayOffset = daysBetween(cycleStartDate, apt.date);
  } else {
    processed.dayOffset = apt.dayOffset ?? 0;
  }
  
  return processed;
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

  // Ensure arrays exist
  if (!parsed.medications) parsed.medications = [];
  if (!parsed.appointments) parsed.appointments = [];
  if (!parsed.milestones) parsed.milestones = [];
  
  // Compute cycleStartDate from all extracted dates
  const cycleStartDate = computeCycleStartDate(parsed.medications, parsed.appointments);
  parsed.cycleStartDate = cycleStartDate;
  
  // Process medications: compute offsets from dates
  parsed.medications = parsed.medications.map((med: any) => 
    processMedicationDates(med, cycleStartDate || "")
  );
  
  // Process appointments: compute offsets from dates
  parsed.appointments = parsed.appointments.map((apt: any) => 
    processAppointmentDates(apt, cycleStartDate || "")
  );
  
  if (!parsed.confidence?.appointments) {
    parsed.confidence = {
      ...parsed.confidence,
      cycleStartDate: cycleStartDate ? "high" : "low",
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
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments.map((apt: any) => ({
        ...apt,
        date: apt.date || null,
        dayOffset: apt.dayOffset ?? 0,
      })) : [],
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

  // Clean medication names and ensure all fields
  const cleanedData = {
    ...validated.data,
    medications: validated.data.medications.map(med => ({
      ...med,
      name: cleanMedicationName(med.name),
      startDate: (med as any).startDate || null,
      endDate: (med as any).endDate || null,
      unitStrength: (med as any).unitStrength || null,
      doses: (med as any).doses || null,
    })),
    appointments: validated.data.appointments.map(apt => ({
      ...apt,
      date: (apt as any).date || null,
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
    unitStrength: med.unitStrength || null,
    dosage: med.dosage || null,
    frequency: med.frequency || "once_daily",
    route: med.route || null,
    startDate: med.startDate || null,
    endDate: med.endDate || null,
    startDayOffset: typeof med.startDayOffset === "number" ? med.startDayOffset : 0,
    durationDays: typeof med.durationDays === "number" && med.durationDays > 0 ? med.durationDays : 1,
    timeOfDay: med.timeOfDay || null,
    exactTime: med.exactTime || med.customTime || null,
    doses: Array.isArray(med.doses) ? med.doses : null,
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
