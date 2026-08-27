# ErrandGo — functional setup

The app is designed so all marketplace UI and non-provider interactions work immediately. External services that require private credentials are intentionally left configurable.

## 1. Supabase

The repository contains:
- `supabase/migrations/002_errandgo_complete.sql`
- `supabase/migrations/003_security_and_rpc_patch.sql`

Run both files, in order, in the Supabase SQL Editor for the project used by ErrandGo.

Then confirm Authentication → Email is enabled. If email confirmation is enabled, a new user must confirm their email before the first password login.

Required Vite variables:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Never put a Supabase service-role key in the frontend.

## 2. What works without provider credentials

- Navigation and responsive UI
- Search and category filtering
- Post errand form and database insert when Supabase is connected
- Errand detail pages
- Runner application creation
- Saved errands
- Customer's My Errands list
- Start/complete errand status updates
- Profile editing
- Notifications and mark-all-read
- Support ticket submission
- Chat UI and local persistence; realtime messages when a conversation exists
- Geolocation permission request
- Authentication state persistence
- Admin dashboard data reads for authenticated users

## 3. Provider-only features

These require credentials/configuration before they can move real money or access third-party services:

- Payment gateway funding
- Payment webhooks
- Escrow settlement/release
- Bank withdrawals/payouts
- Maps/route tiles and production geocoding
- Identity/KYC verification
- Production push notifications

These features should be implemented through server-side/edge functions. Provider secrets must not be exposed in Vite client variables.

## 4. Production checks

After pushing to `main`:

```bash
npm install
npm run build
```

The GitHub Actions build workflow runs these same checks on pushes and pull requests to `main`.

For Vercel, set the same public Vite variables in Project Settings → Environment Variables and redeploy after changing them.
