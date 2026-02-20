export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold mb-8">Terms and Conditions</h1>
        
        <div className="prose prose-neutral dark:prose-invert space-y-6">
          <p className="text-muted-foreground">Last updated: February 2025</p>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Acceptance of Terms</h2>
            <p>
              By accessing and using IVF Buddy (&quot;the App&quot;), you agree to be bound by these 
              Terms and Conditions. If you do not agree, please do not use the App.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Description of Service</h2>
            <p>
              IVF Buddy is a personal support application that helps users manage their IVF 
              medication schedules through:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Medication reminders via SMS</li>
              <li>Daily mood and symptom check-ins</li>
              <li>AI-powered supportive responses</li>
              <li>Schedule and task management</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Medical Disclaimer</h2>
            <p className="font-medium text-destructive">
              IMPORTANT: IVF Buddy is NOT a medical device and does NOT provide medical advice.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The App is for informational and organizational support only</li>
              <li>Always follow your healthcare provider&apos;s instructions</li>
              <li>Never delay seeking medical advice because of information from this App</li>
              <li>If you experience severe symptoms, contact your clinic or call emergency services immediately</li>
              <li>The App does not diagnose, treat, or cure any medical condition</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">SMS Terms</h2>
            <p>By opting in to SMS notifications, you agree that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You consent to receive automated SMS messages at the phone number provided</li>
              <li>Message frequency varies based on your medication schedule</li>
              <li>Message and data rates may apply</li>
              <li>You can opt out at any time by replying STOP</li>
              <li>Reply HELP for assistance</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">User Responsibilities</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate information about your medication schedule</li>
              <li>Keep your account credentials secure</li>
              <li>Use the App only for its intended purpose</li>
              <li>Not rely solely on the App for medical decisions</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">AI-Generated Content</h2>
            <p>
              The App uses AI to generate supportive responses. These responses are:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>For emotional support only, not medical advice</li>
              <li>Generated automatically and may not always be accurate</li>
              <li>Not a substitute for professional medical or mental health care</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, IVF Buddy and its creators shall not be 
              liable for any damages arising from your use of the App, including but not limited 
              to missed medications, incorrect reminders, or reliance on AI-generated content.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Account Termination</h2>
            <p>
              You may delete your account at any time through the App settings. We reserve the 
              right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the App after 
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium">Contact</h2>
            <p>
              For questions about these terms, contact us at support@ivfbuddy.app
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
