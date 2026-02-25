# IVF Buddy - Core Intelligence System

> The heart of IVF Buddy: How we provide intelligent, empathetic support through every step of the IVF journey.

---

## Executive Summary

IVF Buddy's intelligence system combines **cycle-aware task generation**, **personalized AI companionship**, and **proactive support** to create an experience that feels like having a knowledgeable, caring friend who understands IVF.

**What makes it special:**
- **Cycle-Phase Intelligence**: Every interaction is contextualized by where you are in your IVF cycle
- **Memory & Personalization**: The AI remembers what helped you before, your preferences, and sensitive topics
- **Proactive Care**: Check-ins triggered after major events (trigger shot, retrieval, transfer)
- **Empathetic by Design**: Never toxic positivity, always validating, medically cautious
- **Multi-Channel Support**: Push notifications, SMS, and in-app chat working together

---

## Table of Contents

1. [Task Generation System](#1-task-generation-system)
2. [AI Buddy & Chat System](#2-ai-buddy--chat-system)
3. [Reminder & Notification System](#3-reminder--notification-system)
4. [Personalization & Memory](#4-personalization--memory)
5. [IVF Domain Intelligence](#5-ivf-domain-intelligence)
6. [System Architecture](#6-system-architecture)
7. [Areas for Improvement](#7-areas-for-improvement)

---

## 1. Task Generation System

### Why It's Great

Traditional reminder apps require manual entry for every medication and appointment. IVF protocols have **dozens of medications** with complex schedules (multiple doses per day, different days, varying durations). IVF Buddy **automatically generates every task** from a single protocol upload.

### How It Works

#### Flow: Protocol to Tasks

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Protocol Image │ --> │  AI Extraction   │ --> │  User Review    │
│  (PDF/Photo)    │     │  (GPT-4 Vision)  │     │  & Confirmation │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          v
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Tasks Created  │ <-- │  Plan Generation │ <-- │  Protocol       │
│  for 14 Days    │     │  (plannerService)│     │  Activated      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

#### Task Types Generated

| Task Kind | Source | Example |
|-----------|--------|---------|
| `REMINDER` | Medications | "Gonal-F 225 IU - Evening injection" |
| `APPOINTMENT` | Protocol appointments | "Bloodwork at 8:00 AM" |
| `CRITICAL` | Time-sensitive appointments | "Trigger Shot at 9:30 PM (critical timing)" |
| `CHECKIN` | Daily (auto-generated) | "How are you feeling today?" |
| `PROACTIVE_CHECKIN` | After major events | "How are you feeling after your retrieval?" |
| `INFO` | Milestones | "Day 5 of stimulation - follicles are growing" |

#### Key Components

**File:** `src/modules/planner/plannerService.ts`

```typescript
// Main function: generatePlanTasks()
// Creates tasks for 14 days ahead based on:
// - Medication schedules (with multi-dose support)
// - Appointments (with fasting/critical flags)
// - Daily check-ins
// - Proactive check-ins after major events
```

**Medication Task Logic:**
- Checks if date falls within medication date range
- Supports multiple doses per day (e.g., "Dose 1/3", "Dose 2/3")
- Uses `exactTime` if specified, otherwise defaults based on `timeOfDay`:
  - Morning: 8:00 AM
  - Afternoon: 1:00 PM
  - Evening: 6:00 PM
  - Bedtime: 9:00 PM

**IVF-Specific Features:**
- **Trigger Date Validation**: Automatically corrects trigger date = retrieval - 2 days (biological constraint)
- **Fasting Flags**: Appointments marked as fasting show "(fasting)" reminder
- **Critical Timing**: Critical appointments highlighted separately
- **Cycle Day Index**: Every task knows what cycle day it falls on

### Example: Generated Tasks for One Day

```
Day 5 of Stimulation (Feb 21):

07:00 AM - Bloodwork & Ultrasound (fasting)
08:00 AM - Estradiol 2mg - Morning dose
08:00 AM - Cetrotide 0.25mg - Subcutaneous injection
06:00 PM - Gonal-F 225 IU - Dose 1/2
06:00 PM - Menopur 75 IU - Mix and inject
09:00 PM - Gonal-F 225 IU - Dose 2/2
07:00 PM - Daily Check-in: How are you feeling?
```

---

## 2. AI Buddy & Chat System

### Why It's Great

The AI Buddy isn't a generic chatbot - it's an **IVF-specific companion** that:
- Knows exactly where you are in your cycle
- Remembers what helped you in previous conversations
- Never gives medical advice (safety first)
- Provides empathetic support without toxic positivity
- Offers actionable coping strategies matched to your phase

### How It Works

#### Context Building

Every AI response is built with rich context:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENRICHED CONTEXT                             │
├─────────────────────────────────────────────────────────────────┤
│ Cycle Context:                                                  │
│   - Day 7 of stimulation                                        │
│   - 2 days until retrieval                                      │
│   - 2 injections today (Gonal-F, Menopur)                       │
│                                                                 │
│ Today's Schedule:                                               │
│   - Bloodwork at 8:00 AM ✓                                      │
│   - Gonal-F 225 IU at 6:00 PM (pending)                         │
│                                                                 │
│ Recent Mood:                                                    │
│   - Yesterday: 3/5 (tired, bloated)                             │
│   - 2 days ago: 4/5 (feeling okay)                              │
│   - Trend: Stable                                               │
│                                                                 │
│ User Memories:                                                  │
│   - Preference: "Prefers evening injections"                    │
│   - What helped: "Walking helped with bloating"                 │
│   - Trigger: "Struggles with the waiting"                       │
│                                                                 │
│ Conversation History:                                           │
│   - User asked about injection tips yesterday                   │
│   - Discussed bloating coping strategies                        │
└─────────────────────────────────────────────────────────────────┘
```

#### Response Generation

**File:** `src/modules/buddy/buddyService.ts`

```typescript
async function generateBuddyReply(context) {
  // 1. Safety check: Scan for emergency keywords
  if (containsSevereKeyword(message)) {
    return escalationResponse(); // Direct to clinic/911
  }
  
  // 2. Build enriched context with all user data
  const enrichedContext = await buildEnrichedContext(context);
  
  // 3. Call OpenAI with IVF-specific system prompt
  const response = await callOpenAI(enrichedContext);
  
  // 4. Update conversation memory
  await updateConversationState(context);
  
  // 5. Extract memories from user message (async)
  processMessageForMemories(message);
  
  return response;
}
```

#### System Prompt Personality

**File:** `src/config/buddy/system.ts`

The AI is instructed to be:
- **Warm & Empathetic**: "I hear you" before solutions
- **Brief & Conversational**: SMS-friendly (under 320 chars)
- **Medically Cautious**: Never diagnoses, always defers to clinic
- **Avoids Toxic Positivity**: No "everything happens for a reason"
- **One Question Max**: Doesn't overwhelm with questions
- **Phase-Aware**: Different tone for different cycle phases

### Example Conversations

**User (Day 2 of TWW):** "I can't stop symptom spotting. Is cramping a good sign?"

**Buddy Response:**
```
I hear you - the TWW symptom spiral is SO real 💛 
Cramping can happen either way, so try not to read into it. 
Want a distraction technique or just some company for the wait?
```

**User (Post-Retrieval):** "Feeling really sore and emotional"

**Buddy Response:**
```
That's completely normal after retrieval 💛 Your body just did 
something incredible. Rest, heating pad, and be extra gentle 
with yourself today. How's your pain level 1-10?
```

**User (After Failed Cycle):** "It didn't work"

**Buddy Response:**
```
I'm so sorry 💛 There are no words that make this easier. 
Take all the time you need. I'm here whenever you want 
to talk, or just sit in silence together.
```

---

## 3. Reminder & Notification System

### Why It's Great

IVF medications are **time-sensitive**. Missing a dose or getting the timing wrong can impact the entire cycle. Our system:
- Sends reminders via **push notifications**, **SMS**, and **in-app chat**
- Respects **quiet hours** (no 3 AM notifications)
- **Bundles** multiple reminders at the same time
- Works even when the app isn't open (push + SMS)

### How It Works

#### Scheduler Flow

```
┌─────────────────┐
│  Cron Job       │  Runs every 5 minutes
│  (GitHub Actions)│
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Find Due Tasks │  WHERE status='PENDING' AND dueAt <= NOW()
│  (getDueTasks)  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Group by User  │  Bundle tasks with same due time
│  & Time         │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────┐
│  For Each Bundle:                       │
│  1. Check subscription status           │
│  2. Create chat message (system)        │
│  3. Send push notification              │
│  4. Send SMS (if consent given)         │
│  5. Mark tasks as SENT                  │
└─────────────────────────────────────────┘
```

#### Multi-Channel Delivery

| Channel | When Used | Format |
|---------|-----------|--------|
| **Push** | Always (if subscribed) | Title + brief body |
| **Chat** | Always | Full message with instructions |
| **SMS** | If user opted in | Condensed format |

#### Example: Bundled Reminder

**Push Notification:**
```
Title: 💊 Medication Reminder
Body: Gonal-F 225 IU, Menopur 75 IU
```

**Chat Message:**
```
💊 Time for your medications:

• Gonal-F 225 IU - Subcutaneous injection
• Menopur 75 IU - Mix and inject together

Reply "done" when complete, or let me know how you're feeling.
```

**SMS:**
```
💊 Gonal-F 225 IU, Menopur 75 IU - Evening meds due now
```

#### Quiet Hours

Users can set quiet hours (e.g., 10 PM - 7 AM). Reminders falling within quiet hours are pushed to the end of the quiet period.

---

## 4. Personalization & Memory

### Why It's Great

Most health apps treat every interaction as a blank slate. IVF Buddy **remembers**:
- What coping strategies worked for you
- Your preferences ("I prefer morning check-ins")
- Facts about you ("This is my 3rd cycle")
- Sensitive topics ("I struggle with injections")

### How It Works

#### Memory Extraction

**File:** `src/modules/insights/memoryService.ts`

Memories are automatically extracted from conversations using pattern matching:

| Category | Patterns Detected | Example |
|----------|-------------------|---------|
| `whatHelped` | "helped", "worked", "felt better" | "Walking really helped with the bloating" |
| `preference` | "I prefer", "I like", "I don't like" | "I prefer not to talk about statistics" |
| `fact` | "I am", "This is my X cycle" | "This is my second IVF cycle" |
| `trigger` | "hard to", "struggle with", "can't handle" | "I struggle with the injections" |

#### Memory Usage in Context

```typescript
// In buddyService.ts
const memories = await getMemoriesForUser(userId, 10);

// Returns:
// - Preference: "Prefers evening check-ins"
// - What helped: "Ice helped with injection pain"
// - Fact: "Has a 3-year-old from first IVF"
// - Trigger: "Anxiety around beta results"
```

These memories are injected into the AI context, so responses are personalized:

**Without Memory:** "Have you tried ice for injection pain?"
**With Memory:** "Remember how ice helped last time? That might help today too."

### Mood Tracking & Trends

**File:** `src/modules/insights/trendsService.ts`

Daily mood check-ins are aggregated into trends:

```typescript
// getRecentMoodTrend() returns:
{
  direction: "declining",  // or "improving", "stable"
  average: 2.8,
  recentScores: [3, 2, 2, 4, 3],
  recurringSymptoms: ["tired", "bloated"]
}
```

This feeds into the AI context, enabling responses like:
```
"I've noticed you've been feeling more tired lately. 
Day 7 of stims is often the hardest. You're almost there 💛"
```

---

## 5. IVF Domain Intelligence

### Cycle Phase Detection

**File:** `src/modules/buddy/buddyService.ts` - `determineCyclePhase()`

The system knows exactly where you are:

| Phase | Detection | AI Behavior |
|-------|-----------|-------------|
| `stimulation_day_1-3` | Days 1-3 of cycle | Focus on routine establishment |
| `stimulation_day_4-7` | Days 4-7 | Side effects peak, more supportive |
| `stimulation_day_8+` | Day 8+ before trigger | Almost there, monitoring intensifies |
| `pre_trigger` | Day before trigger | Big day coming, nerves are normal |
| `trigger_day` | Day of trigger shot | Critical timing, be reassuring |
| `retrieval_day` | Day of retrieval | Extra gentle, recovery focus |
| `post_retrieval_day_1-3` | 1-3 days after | Rest and recovery |
| `transfer_day` | Day of transfer | Hopeful but nervous |
| `tww_day_1-14` | Two-week wait | Hardest wait, avoid symptom speculation |

### Proactive Check-ins

After major events, the system automatically reaches out:

| Event | Check-in Timing | Message |
|-------|-----------------|---------|
| Trigger Shot | +12 hours | "How are you feeling after your trigger shot last night? This is a big milestone!" |
| Retrieval | +4 hours, +24 hours | "Checking in after your retrieval. How's the recovery going?" |
| Transfer | +4 hours, +24 hours | "How are you feeling after your transfer? Remember: rest and be gentle with yourself." |

### Suggestion Library

**File:** `src/config/buddy/suggestions.ts`

143 curated suggestions matched by:
- **Cycle phase** (stimulation vs TWW)
- **Symptoms** (bloating, anxiety, insomnia)
- **Mood level** (some only shown when mood is low)

Examples:
- "Ice the injection site for 30 seconds before and after"
- "Try the 5-4-3-2-1 grounding technique"
- "A warm bath can help with ovary tenderness"
- "Journal 3 things that went okay today"

### Resource Library

**File:** `src/config/buddy/resources.ts`

12 curated resources linked contextually:
- Injection technique guides
- Side effects management
- Retrieval preparation
- TWW survival tips
- Emotional support resources

### Safety: 4-Tier Emotional Safety System

**Files:** 
- `src/config/buddy/safetyTiers.ts` - Tier definitions and templates
- `src/modules/buddy/safetyClassifier.ts` - Classification logic
- `src/modules/buddy/responseFilter.ts` - Post-LLM filtering
- `src/modules/buddy/auditService.ts` - Audit logging

#### Tier System

| Tier | Category | Description | Handling |
|------|----------|-------------|----------|
| **0** | Normal/Positive | Happy, excited, nervous, stressed, venting | LLM response only |
| **1** | Elevated | Hopelessness, despair, feeling like failure | LLM + gentle safety line |
| **2** | Risk (Mental) | Panic attacks, can't stop crying, can't function | LLM + support resources |
| **2** | Risk (Medical) | OHSS symptoms, bleeding, clot signs | LLM + medical alert |
| **3** | Crisis | Suicidal ideation, self-harm | LLM + prominent crisis resources |

#### Both/And Approach
Every response includes:
1. **Warm LLM response** (contextual, personalized)
2. **Scaled safety appendix** (based on tier)

User self-selects which part is relevant. No robotic overrides.

#### Example: Tier 2 Mental Health
```
"Panic attacks during stims are so real and scary 💛 
Day 7 is often the hardest. You've made it this far.

---
If you're struggling emotionally, you're not alone. 
Your clinic has support resources, or you can reach 988 anytime."
```

#### Example: Tier 3 Crisis
```
"I'm really glad you're sharing this with me. That feeling 
of not wanting to go on is so heavy. You don't have to face this alone.

---
I want to make sure you have support right now.
If you're having thoughts of hurting yourself:
• Call or text 988 for immediate support
• Text HOME to 741741
• Reach out to someone you trust

You don't have to carry this alone."
```

#### Classification Flow
1. **Hard-coded check** - Crisis keywords, medical patterns (instant flag)
2. **LLM classification** - Nuanced understanding of context
3. **Final tier** = max(hard_coded, LLM) for safety
4. **Post-filter** - Remove toxic positivity, medical advice
5. **Append** - Scaled safety message
6. **Audit log** - Tier 2+ logged for review

#### Post-LLM Filtering
Blocks phrases like:
- "Everything happens for a reason"
- "Just stay positive"
- "You should take..."
- "You probably have..."

#### Audit Logging
All Tier 2+ events logged to `SafetyAuditLog` table:
- Timestamp, user, tier, category
- Trigger phrase, user message, response
- For liability protection and quality improvement

---

## 6. System Architecture

### Key Files

```
src/
├── modules/
│   ├── planner/
│   │   └── plannerService.ts      # Task generation
│   ├── buddy/
│   │   ├── buddyService.ts        # AI response generation
│   │   ├── buddySchemas.ts        # Response validation
│   │   ├── safetyClassifier.ts    # Tier classification
│   │   ├── responseFilter.ts      # Post-LLM filtering
│   │   ├── auditService.ts        # Safety audit logging
│   │   └── fallbackRules.ts       # Fallback responses
│   ├── chat/
│   │   └── chatService.ts         # Message handling
│   ├── tasks/
│   │   ├── taskService.ts         # Task CRUD
│   │   └── scheduler.ts           # Due task processing
│   ├── insights/
│   │   ├── memoryService.ts       # User memory
│   │   ├── trendsService.ts       # Mood trends
│   │   └── proactiveCheckinService.ts
│   ├── push/
│   │   └── pushService.ts         # Push notifications
│   └── messaging/
│       └── messagingService.ts    # SMS via Twilio
├── config/
│   └── buddy/
│       ├── system.ts              # System prompt + tier instructions
│       ├── safetyTiers.ts         # Tier definitions & templates
│       ├── suggestions.ts         # 143 suggestions
│       └── resources.ts           # 12 resources
└── app/api/
    ├── chat/                      # Chat endpoints
    ├── jobs/tick/                 # Scheduler cron
    └── push/                      # Push endpoints
```

### Database Schema (Relevant Tables)

```
Task                    # Reminders, appointments, check-ins
ChatMessage             # All chat messages
ConversationState       # Rolling conversation summary
CheckIn                 # User mood/symptom logs
Insight_UserMemory      # Extracted user memories
Insight_DailyMood       # Aggregated daily mood data
Insight_ProactiveCheckIn # Scheduled proactive check-ins
SafetyAuditLog          # Tier 2+ safety events for review
```

---

## 7. Areas for Improvement

### Completed

#### ✅ **4-Tier Emotional Safety System** (Implemented)
- Tiered classification (0=normal, 1=elevated, 2=risk, 3=crisis)
- Both/And approach: LLM response + scaled safety appendix
- Hard-coded crisis detection + LLM nuanced classification
- Post-LLM filtering (toxic positivity, medical advice)
- Audit logging for Tier 2+ events

### High Priority

#### 1. **Cycle Summary Generation** (Not Implemented)
- `Insight_CycleSummary` table exists but is never populated
- Should generate end-of-cycle insights: average mood, what helped, total injections
- Could provide valuable feedback for future cycles

#### 2. **Smarter Suggestion Selection**
- Current: Simple phase + symptom matching
- Improvement: Track which suggestions user found helpful (`Insight_UserSuggestion.wasHelpful`)
- Learn user's preferred coping style over time

#### 3. **Partner Mode**
- Partners often feel helpless during IVF
- Could add partner-specific tips and check-ins
- "Check in on your partner - Day 7 of stims is often hard"

#### 4. **Symptom Prediction**
- With enough data, could predict: "Based on your pattern, you might feel more tired tomorrow"
- Proactive suggestions before symptoms hit

### Medium Priority

#### 5. **Voice Notes**
- Some users find typing hard when emotional
- Voice-to-text for check-ins and chat

#### 6. **Clinic Integration**
- Direct sync with clinic portals (EPIC, etc.)
- Auto-import protocol updates
- Share mood data with care team (with consent)

#### 7. **Community Features**
- Anonymous support groups by cycle phase
- "Others in TWW right now" connection
- Moderated, safe space

#### 8. **Better Fallbacks**
- Current: Generic fallback when AI fails
- Improvement: Phase-specific fallbacks with more personality

### Lower Priority (Nice to Have)

#### 9. **Gamification**
- Streaks for daily check-ins
- Milestone celebrations ("You completed 10 days of stims!")
- Be careful: Not everyone wants gamification during IVF

#### 10. **Data Export**
- Export mood/symptom data for personal records
- Share with therapist or support network

#### 11. **Multi-Language Support**
- Currently English only
- Spanish, Mandarin would expand reach significantly

#### 12. **Apple Watch / Wear OS**
- Medication reminders on wrist
- Quick check-in from watch

---

## Conclusion

IVF Buddy's intelligence system is built on four pillars:

1. **Cycle Awareness**: Every interaction knows where you are in your journey
2. **Memory & Learning**: The AI gets smarter about YOU over time
3. **Empathy by Design**: Never cold, never dismissive, always validating
4. **Safety First**: 4-tier emotional safety system with deterministic safeguards

The foundation is solid. The key remaining improvements are:
- Completing cycle summaries
- Smarter suggestion learning
- Partner support
- Clinic integration

This isn't just a reminder app. It's a **companion** for one of life's most challenging journeys - with the safety net to match.
