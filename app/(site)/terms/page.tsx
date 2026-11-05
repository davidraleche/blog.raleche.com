export const metadata = { title: "Terms of Service", alternates: { canonical: "/terms" } };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="kicker">Raleche</p>
      <h1 className="hed mt-3 text-6xl">Terms of Service</h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink/50">Last updated November 2, 2026</p>
      <div className="mt-8 font-serif text-lg leading-relaxed text-ink/80">
        <h2 className="hed mt-10 text-3xl">Using the site</h2>
        <p className="mt-3">By using blog.raleche.com you agree to these terms. Articles are provided for general information and are not legal, financial or investment advice.</p>
        <h2 className="hed mt-10 text-3xl">Accounts</h2>
        <p className="mt-3">You are responsible for your account and for keeping your sign-in secure. We may suspend accounts that abuse the site.</p>
        <h2 className="hed mt-10 text-3xl">Memberships and payments</h2>
        <p className="mt-3">Paid memberships are billed through Stripe at the price shown when you subscribe and renew until you cancel. You can cancel at any time from your account page; access continues until the end of the paid period.</p>
        <h2 className="hed mt-10 text-3xl">Content</h2>
        <p className="mt-3">Articles and summaries are our own commentary on public interviews and news. Third-party names, videos and marks belong to their owners. Please do not copy or republish our content without permission.</p>
        <h2 className="hed mt-10 text-3xl">Liability</h2>
        <p className="mt-3">The site is provided as is. To the extent the law allows, we are not liable for losses from using it.</p>
        <h2 className="hed mt-10 text-3xl">Contact</h2>
        <p className="mt-3">info@tts42.com</p>
      </div>
    </div>
  );
}
