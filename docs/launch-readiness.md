# Launch Readiness Guide

This guide covers what to install, configure, and verify before launching Apex Drive.

## 1) Install / Download

- Node.js `20.9+` (already required for local dev)
- A Git client
- [Vercel CLI](https://vercel.com/docs/cli) (optional but recommended): `npm i -g vercel`
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for schema/migrations)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local webhook testing)

## 2) Accounts You Need

- [Clerk](https://clerk.com/) (production app + live keys)
- [Stripe](https://stripe.com/) (live mode + products/prices/webhooks)
- [Mapbox](https://www.mapbox.com/) (token with styles/geocoding/directions access)
- [Supabase](https://supabase.com/) (Postgres + auth-ready backend for persistence)
- [Vercel](https://vercel.com/) (recommended hosting for this Next.js app)
- A domain registrar (Cloudflare, Namecheap, GoDaddy, etc.)

## 3) Production Env Vars

Set these in your deploy platform (not only in local `.env.local`):

- `NEXT_PUBLIC_APP_URL=https://<your-domain>`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ELITE`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_ENABLE_MAPBOX_BASEMAP=true`

Run validation before deploy:

```bash
npm run preflight -- --prod
```

## 4) Domain + Deploy Order

1. Deploy app to Vercel project.
2. Attach custom domain in Vercel.
3. Point DNS records at Vercel.
4. Update `NEXT_PUBLIC_APP_URL` to the final HTTPS domain.
5. Update Clerk redirect URLs and allowed origins to this domain.
6. Update Stripe webhook endpoint to:
   - `https://<your-domain>/api/stripe/webhook`

## 5) Supabase Setup (Profiles)

Profiles now sync to Supabase through `GET/PUT /api/profile` using Clerk auth on the server.

1. Run the migration in Supabase SQL Editor (or with Supabase CLI):

```bash
# Option A: paste supabase/migrations/20240620000000_profiles.sql into Supabase SQL Editor

# Option B: with Supabase CLI linked to your project
npx supabase db push
```

2. Confirm Vercel production env vars exist:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Save Profile in Settings should persist to the `profiles` table.

Next persistence targets after profiles:

- `convoys`
- `convoy_members`
- `clubs`
- `meets`
- `favorite_routes`
- `friend_requests`
- `friendships`
- `direct_messages`

Enable Row Level Security and add per-user access policies from day one.

## 6) Final Launch Smoke Tests

- New user sign-up -> email verification -> dashboard access
- Sign out -> returns to custom `/sign-in` page
- Route flow:
  - `Get Me There` -> arrive at route start -> `Start Route Focus`
- Live GPS marker + Follow Me behavior on dashboard map
- Stripe checkout success + cancel paths
- Stripe webhook metadata sync into Clerk `publicMetadata.subscription`
