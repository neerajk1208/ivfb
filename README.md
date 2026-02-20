# IVF Buddy

Your supportive companion through your IVF journey. IVF Buddy helps you manage medication reminders, daily check-ins, and provides gentle support throughout your cycle.

> **Disclaimer**: IVF Buddy is for informational support only and is not medical advice. Always follow your clinic's instructions.

## Features

- **Protocol Management**: Upload your clinic's protocol PDF or enter medications manually
- **Smart Reminders**: Automated SMS reminders for medications based on your schedule
- **Daily Check-ins**: Track your mood and symptoms with gentle prompts
- **Buddy Voice**: Supportive AI-powered responses to your check-ins
- **Privacy-First**: Your data stays secure and private

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + shadcn/ui
- **Auth**: NextAuth.js (Google OAuth)
- **Database**: PostgreSQL + Prisma
- **SMS**: Twilio
- **AI**: OpenAI API (Responses API)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local, Neon, or Supabase)
- Google OAuth credentials
- Twilio account (for SMS)
- OpenAI API key

### 1. Clone and Install

```bash
cd ivf-buddy
npm install
```

### 2. Environment Setup

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ivfbuddy"

# NextAuth
NEXTAUTH_SECRET="generate-a-secure-secret"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Twilio
TWILIO_ACCOUNT_SID="your-twilio-sid"
TWILIO_AUTH_TOKEN="your-twilio-token"
TWILIO_PHONE_NUMBER="+1234567890"

# OpenAI
OPENAI_API_KEY="your-openai-key"
OPENAI_MODEL="gpt-4.1-mini"

# Storage (use "local" for development)
UPLOAD_STORAGE="local"

# App URL
APP_BASE_URL="http://localhost:3000"
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Setting Up Services

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google+ API
4. Go to Credentials → Create Credentials → OAuth Client ID
5. Set authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Secret to your `.env`

### Twilio SMS

1. Create a [Twilio account](https://www.twilio.com/)
2. Get a phone number with SMS capability
3. Copy Account SID, Auth Token, and Phone Number to `.env`
4. Set up the inbound webhook URL (see below)

### Setting Twilio Webhook URL

For local development, use ngrok or similar:

```bash
ngrok http 3000
```

Then configure your Twilio phone number's webhook:
- **Webhook URL**: `https://your-ngrok-url.ngrok.io/api/twilio/inbound`
- **HTTP Method**: POST

For production, use your deployed URL: `https://your-domain.com/api/twilio/inbound`

### OpenAI

1. Get an API key from [OpenAI Platform](https://platform.openai.com/)
2. Add to `.env` as `OPENAI_API_KEY`

## Running the Scheduler (Cron Job)

The scheduler sends due SMS reminders. In development, you can trigger it manually:

```bash
# Trigger via GET (dev only)
curl http://localhost:3000/api/jobs/tick

# Or via POST
curl -X POST http://localhost:3000/api/jobs/tick
```

For production, set up a cron job to hit `/api/jobs/tick` every 5 minutes:

```bash
*/5 * * * * curl -X POST https://your-domain.com/api/jobs/tick -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Add `CRON_SECRET` to your environment for production security.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/               # API endpoints
│   │   ├── auth/          # NextAuth routes
│   │   ├── checkin/       # Check-in endpoints
│   │   ├── jobs/          # Scheduler endpoints
│   │   ├── protocol/      # Protocol management
│   │   ├── tasks/         # Task management
│   │   ├── today/         # Today view data
│   │   ├── twilio/        # Twilio webhooks
│   │   ├── uploads/       # File upload handling
│   │   └── user/          # User profile management
│   ├── onboarding/        # Onboarding flow pages
│   ├── settings/          # Settings page
│   └── today/             # Main dashboard
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── providers/        # Context providers
│   └── ...
├── config/               # App configuration
│   ├── app.ts           # App-wide settings
│   └── buddy/           # Buddy AI configuration
├── lib/                  # Shared utilities
│   ├── auth.ts          # Auth helpers
│   ├── db.ts            # Prisma client
│   ├── http.ts          # Response helpers
│   ├── time.ts          # Timezone utilities
│   └── validate.ts      # Zod schemas
└── modules/             # Business logic modules
    ├── buddy/           # AI buddy service
    ├── checkins/        # Check-in service
    ├── messaging/       # Twilio/SMS service
    ├── planner/         # Task generation
    ├── protocolIntake/  # Protocol extraction
    ├── tasks/           # Task management
    ├── uploads/         # File storage
    └── user/            # User management
```

## OCR for Image Uploads

For MVP, OCR is stubbed out. To enable image text extraction:

1. **Option A: Google Cloud Vision** (recommended)
   - Enable Vision API in Google Cloud
   - Add credentials to environment
   - Implement in `src/modules/protocolIntake/textExtractors.ts`

2. **Option B: Tesseract.js**
   ```bash
   npm install tesseract.js
   ```
   Then implement the OCR provider in `textExtractors.ts`

## Key Flows

### Onboarding Flow
1. User signs in with Google
2. Enters phone number, timezone, SMS consent
3. Uploads protocol PDF OR enters medications manually
4. Reviews extracted/entered protocol
5. Confirms → generates 14-day task plan

### SMS Flow
1. Scheduler runs every 5 minutes
2. Finds due tasks for users with SMS consent
3. Sends reminder/check-in SMS via Twilio
4. User can reply with mood (1-5) and symptoms
5. Buddy AI generates supportive response
6. Severe symptoms trigger escalation message

## Safety Features

- **Escalation Keywords**: Detects severe symptoms and advises contacting clinic
- **No Medical Advice**: System never diagnoses or recommends treatments
- **Opt-Out**: Users can text STOP to unsubscribe immediately
- **Quiet Hours**: Configurable do-not-disturb periods

## Development Notes

- All dates/times are stored in UTC, converted to user timezone for display
- File uploads stored locally in `./uploads` directory (use S3 for production)
- SMS limited to 320 characters
- Conversation state maintains rolling summary for context

## Deployment

1. Deploy to Vercel, Railway, or similar
2. Set all environment variables
3. Run `npx prisma migrate deploy`
4. Configure Twilio webhook URL
5. Set up cron job for `/api/jobs/tick`

## License

Private - All rights reserved
