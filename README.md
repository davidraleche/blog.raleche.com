# raleche.com

A Wired-style tech magazine with paid memberships for executive summaries, a newsletter, and a Wall Street-terminal admin.

- **Content**: articles are copied from [tts42.com](https://tts42.com) (sitemap → `/blog/*`). Each article's "The short version" and action sections become its members-only **executive summary**.
- **Memberships** (Stripe subscriptions): **Member $12/mo** unlocks executive summaries on every story; **Executive Brief $19/mo** adds the weekly summary briefing by email. Prices and features are editable in Admin → Plans.
- **Sign in / sign up in one step**: Google, email + password (an unknown email creates the account), or phone number + SMS code.
- **Newsletter**: signup forms on the homepage, articles and footer; campaigns composed and sent from the admin.
- **Admin** (`/admin`, for `ADMIN_EMAIL`): terminal-style dashboard (MRR, ARR, members, conversion, signups, readership, top articles, live activity), plus posts (markdown editor with preview), categories, members (roles, comp memberships), subscriptions, newsletter (subscribers, CSV export, campaigns, weekly digest), plans & pricing, TTS42 sync, and settings.

## Stack
Next.js 15 (App Router, server actions) · Prisma (SQLite locally, Postgres in production) · Tailwind CSS · Stripe · Twilio (SMS) · Resend (email) · Recharts.

## Run locally
```bash
npm install
cp .env.example .env        # then fill in values (see below)
npm run setup               # creates the DB, seeds admin/plans/categories, imports tts42.com articles
npm run dev
```
Without Stripe/Twilio/Resend keys the app runs in **demo mode**: subscribing activates instantly, SMS codes print to the server log, and emails are logged.

**Admin login**: set `ADMIN_PASSWORD` in `.env` before `npm run setup` and sign in with `ADMIN_EMAIL` + that password. Google sign-in with the admin email also grants admin (only verified Google emails are promoted; password sign-ups never are).

## Configure
| Service | Env vars | Notes |
|---|---|---|
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Redirect URI: `{APP_URL}/api/auth/google/callback` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Webhook URL `{APP_URL}/api/stripe/webhook`, events `checkout.session.completed`, `customer.subscription.*`. Enable the Customer Portal in Stripe settings. No price IDs needed: Checkout uses the plan price from the DB. |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Phone sign-in codes |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | Newsletter sending (verify the sending domain) |

Local Stripe webhooks: `stripe listen --forward-to localhost:3002/api/stripe/webhook`.

## Re-sync articles
Admin → Import TTS42 → **Sync now**, or `npm run import:tts42`. Re-syncing updates article text but keeps any executive summary you edited.

## Deploy (Google Cloud project `raleche-blog`)
- **Web**: Cloud Run service `blog` (us-central1), scales to zero.
- **Database**: Cloud SQL Postgres 16 `raleche-db` (db-f1-micro, 10 GB HDD, 7 daily backups).
- **Secrets** (Secret Manager): `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. Add Google/Twilio keys the same way and pass them with `--update-secrets`.
- **Email**: Resend, domain `raleche.com` verified (records on `send`, `rsend`, `resend._domainkey`), sender `EMAIL_FROM=Raleche <newsletter@raleche.com>`.
- **Hosting**: Firebase Hosting site `raleche-blog` serves raleche.com (`APP_URL`) and rewrites all traffic to Cloud Run; www.raleche.com and blog.raleche.com 301-redirect to it. Stripe webhook: `https://raleche.com/api/stripe/webhook`. Google OAuth redirect URI: `https://raleche.com/api/auth/google/callback`.
- **Analytics**: GA4 `G-BTN45MJ4RG` via `GA_MEASUREMENT_ID` (Admin → Settings overrides it).

Release a new version:
```bash
gcloud builds submit --project raleche-blog --tag us-central1-docker.pkg.dev/raleche-blog/web/blog:vN .
gcloud run deploy blog --project raleche-blog --region us-central1 --image us-central1-docker.pkg.dev/raleche-blog/web/blog:vN
gcloud run jobs update setup --project raleche-blog --region us-central1 --image us-central1-docker.pkg.dev/raleche-blog/web/blog:vN
gcloud run jobs execute setup --project raleche-blog --region us-central1 --wait   # applies schema changes
```
Admin password: `gcloud secrets versions access latest --secret ADMIN_PASSWORD --project raleche-blog`
