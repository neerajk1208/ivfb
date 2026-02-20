export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-neutral dark:prose-invert space-y-6">
          <p className="text-muted-foreground">Last updated: February 2025</p>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Overview</h2>
            <p>
              IVF Buddy (&quot;we&quot;, &quot;our&quot;, or &quot;the App&quot;) is committed to protecting your privacy. 
              This policy explains how we collect, use, and safeguard your personal information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Email address and name from Google sign-in</li>
              <li><strong>Phone Number:</strong> For SMS reminders and check-ins (with your consent)</li>
              <li><strong>Health Information:</strong> Medication schedules, cycle dates, mood, and symptom tracking that you provide</li>
              <li><strong>Usage Data:</strong> How you interact with the app to improve our service</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Send medication reminders via SMS</li>
              <li>Provide daily check-in prompts</li>
              <li>Generate supportive AI responses to your check-ins</li>
              <li>Display your personalized schedule and tasks</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Data Storage & Security</h2>
            <p>
              Your data is stored securely using industry-standard encryption. We use trusted 
              third-party services (database hosting, SMS delivery) that comply with data protection standards.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">SMS Communications</h2>
            <p>
              By providing your phone number and opting in, you agree to receive SMS messages including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Medication reminders</li>
              <li>Daily check-in prompts</li>
              <li>Supportive responses to your replies</li>
            </ul>
            <p>
              You can opt out at any time by replying STOP to any message or disabling SMS in your settings.
              Message frequency varies based on your medication schedule. Message and data rates may apply.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Data Sharing</h2>
            <p>
              We do not sell your personal information. We only share data with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Service providers necessary to operate the app (SMS delivery, hosting)</li>
              <li>As required by law</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal data</li>
              <li>Delete your account and all associated data</li>
              <li>Opt out of SMS communications at any time</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Medical Disclaimer</h2>
            <p>
              IVF Buddy is for informational support only and is not medical advice. 
              Always follow your healthcare provider&apos;s instructions. If you experience 
              severe symptoms, contact your clinic or emergency services immediately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Contact Us</h2>
            <p>
              For privacy-related questions, contact us at privacy@ivfbuddy.app
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
