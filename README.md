# ErrandGo

Global errand marketplace: post any errand, find a trusted runner, chat, pay securely, track progress and release payment after completion.

## Stack
- React + Vite
- Supabase Auth / PostgreSQL / Realtime / Storage
- Map provider for location and routing
- Flutterwave or another supported payment provider through server-side Edge Functions
- PWA-ready responsive UI

## Production setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` once in Supabase SQL Editor.
3. Enable Email authentication and any social/phone providers you want.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Configure your map provider public key.
6. Add payment secrets only to server-side/Supabase Edge Function secrets. Never expose payment secrets in the Vite client.
7. Deploy with `npm install && npm run build`.

## Marketplace lifecycle
OPEN → PENDING → ACCEPTED → IN_PROGRESS → COMPLETED

Alternative terminal states: CANCELLED and DISPUTED.

Payments must be held in a server-controlled escrow flow. A client must never be trusted to increase a wallet balance or release escrow. Verify payment webhooks server-side, re-check provider transactions, and write immutable transaction records before updating balances.

## Core tables
`profiles`, `errands`, `applications`, `conversations`, `messages`, `wallets`, `transactions`, `reviews`, `notifications`, `disputes`, `saved_errands`.

## Security
- RLS is enabled in `supabase/schema.sql`.
- Never put payment secret keys in client code.
- Validate prices and ownership on the server.
- Verify payment references server-side.
- Add rate limiting/CAPTCHA to auth and sensitive endpoints.
- Add admin-only policies before exposing an admin dashboard.

## Run locally
```bash
npm install
npm run dev
```

If Supabase variables are absent, the UI can still be previewed. Real authentication, persistent marketplace data, realtime chat, payments and withdrawals require the Supabase configuration.
