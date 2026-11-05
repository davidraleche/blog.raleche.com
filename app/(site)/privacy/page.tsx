export const metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="kicker">Raleche</p>
      <h1 className="hed mt-3 text-6xl">Privacy Policy</h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink/50">Last updated November 2, 2026</p>
      <div className="mt-8 font-serif text-lg leading-relaxed text-ink/80">
        <h2 className="hed mt-10 text-3xl">Who we are</h2>
        <p className="mt-3">Raleche (blog.raleche.com) is a publication run by Tech Team Strategy. Questions about this policy: info@tts42.com.</p>
        <h2 className="hed mt-10 text-3xl">What we collect</h2>
        <p className="mt-3">When you create an account we collect your name and email address, either from Google sign-in or from the form you fill in, or a phone number if you sign in with a texted code. If you subscribe to the newsletter we collect your email address. Paid members are handled by Stripe, so we never see or store your card number. We also count article views in aggregate.</p>
        <h2 className="hed mt-10 text-3xl">Google sign-in</h2>
        <p className="mt-3">If you choose Sign in with Google we receive only your name, email address and Google account identifier. We do not access your Gmail, contacts, calendar or any other Google data.</p>
        <h2 className="hed mt-10 text-3xl">How we use it</h2>
        <p className="mt-3">To sign you in, deliver the newsletter, manage your membership, answer your messages and keep the site secure. We do not sell your personal information.</p>
        <h2 className="hed mt-10 text-3xl">Who we share it with</h2>
        <p className="mt-3">Service providers that run the site for us: Google Cloud (hosting and database), Stripe (payments), Twilio (text-message codes) and Resend (email delivery). They may only use your data to provide their service to us.</p>
        <h2 className="hed mt-10 text-3xl">Advertising</h2>
        <p className="mt-3">Visitors who are not paying members may see ads served by Google AdSense. Google and its partners use cookies to show ads based on your visits to this and other sites. You can turn off personalized ads at <a href="https://adssettings.google.com" className="text-accent hover:underline">adssettings.google.com</a>, and learn more at <a href="https://policies.google.com/technologies/ads" className="text-accent hover:underline">policies.google.com/technologies/ads</a>. Paying members don&apos;t see ads.</p>
        <h2 className="hed mt-10 text-3xl">Your choices</h2>
        <p className="mt-3">You can unsubscribe from any email with the link at the bottom of it. To see, correct or delete your account data, write to info@tts42.com and we will respond within 30 days.</p>
        <h2 className="hed mt-10 text-3xl">Changes</h2>
        <p className="mt-3">If we change this policy we will update the date above.</p>
      </div>
    </div>
  );
}
