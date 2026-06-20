# Apex Drive

A Next.js 16 app for convoy planning, live map reports, favorite route tracing, garage management, clubs/meets, and premium subscriptions.

## Prerequisites

- Node.js 20.9+
- A [Clerk](https://clerk.com/) app
- A [Stripe](https://stripe.com/) account

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your env file:

```bash
cp .env.example .env.local
```

3. Fill these values in `.env.local`:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_MAPBOX_TOKEN` (required for route tracing + reverse geocoding)
- `NEXT_PUBLIC_ENABLE_MAPBOX_BASEMAP` (`true` by default; set to `false` only if you want to force OSM fallback basemap)
- `NEXT_PUBLIC_APP_URL` (usually `http://localhost:3000`)
- `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ELITE` (recommended for production)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (for upcoming cloud persistence migration)

4. Start the app:

```bash
npm run dev
```

## Authentication Flow

- Unauthenticated users are redirected to Clerk sign-in/sign-up.
- Users must have a **verified email** before dashboard access.
- Phone verification is only required if a phone number has been added to the Clerk account.
- Account management is available at `/account`.

## Subscription Flow

- The profile subscription section calls `POST /api/stripe/checkout`.
- Stripe Checkout sessions are created as monthly subscriptions.
- If Stripe Price IDs are configured (`STRIPE_PRICE_*`), Checkout uses those IDs (recommended).
- If Price IDs are not configured, Checkout falls back to inline dev pricing.
- Stripe webhook endpoint is `POST /api/stripe/webhook`.
- Add your webhook URL in Stripe and use the signing secret for `STRIPE_WEBHOOK_SECRET`.
- Stripe webhook events update Clerk `publicMetadata.subscription` so subscription status survives refresh and new sessions.

## Persistence Notes

- App edits (convoys, vehicles, clubs, meets, notifications, favorite routes, profile image/form) are persisted in browser localStorage per signed-in user.
- Subscription truth is persisted in Clerk metadata via Stripe webhooks.
- For multi-device/shared-team persistence of app data, add a database and move those localStorage entities to server APIs.

## Map Behavior Notes

- Basemap uses Mapbox dark style by default when token + style access are valid.
- Set `NEXT_PUBLIC_ENABLE_MAPBOX_BASEMAP=false` to force OSM basemap if you need to bypass Mapbox style rendering.
- If WebGL or tile loading fails, the app falls back to a static OSM embed so the map panel never stays blank.

## Build Check

```bash
npm run build
```

## Env Preflight

Run a preflight check before deploy to validate required env vars:

```bash
npm run preflight
```

Use strict production checks (HTTPS URL + live keys expected):

```bash
npm run preflight -- --prod
```

## Pre-Launch Checklist

- Set all production env vars in your host (Vercel/Railway/etc), including `NEXT_PUBLIC_APP_URL` with your final HTTPS domain.
- Configure Clerk production keys and allowed redirect URLs for your production domain.
- Configure Stripe live keys + live webhook endpoint: `https://<your-domain>/api/stripe/webhook`.
- Subscribe Stripe webhook to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Validate flows in production mode before going public: sign-up/sign-in, account verification, checkout success/cancel, webhook metadata sync.

## Launch Guide

For full launch setup steps (downloads, domain, deploy order, Supabase planning), see `docs/launch-readiness.md`.
