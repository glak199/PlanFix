# PlanFix — Google-only planning

PlanFix now requires Google authentication before loading the dashboard or allowing plans, groups, invitations, votes, bookmarks, or profile access. There is no guest entry, anonymous account creation, local demo, or device-preview fallback. The welcome page retains the blue/lime visual direction and split sign-in layout while using original PlanFix-specific content. It explains plan details, invitations, groups and voting through product features, a four-step workflow, use cases and FAQs. The lower support section opens a visitor-controlled email draft to useplanfix@gmail.com; it does not claim to send messages from the website. The founder credit appears at the very bottom. The removed “Join your people” action and reference-style slogans are absent.

The initial HTML includes a brief PlanFix logo/wordmark opening screen. It fades after the app’s first render with a minimum display of 850 ms, independently of authentication requests. The underlying app stays inert until the screen is removed. A 4.5-second watchdog releases the screen if the bundle fails, and reduced-motion preferences disable the animation.

## Supabase configuration

The public URL and publishable key are set in `dist/config.js`. The public key cannot install SQL or enable the Google provider. The owner guide is available at `/setup/`.

- **New PlanFix database:** run `supabase/schema.sql` once. The published copy is `/setup/planfix.sql`.
- **Existing PlanFix database:** run `supabase/google-only.sql`. It is idempotent, modifies permission helpers, and preserves existing records and historical account mappings. The published copy is `/setup/google-only.sql`.
- Disable Anonymous Sign-Ins in Supabase.
- Enable Google, configuring the Google OAuth client ID and secret in Supabase only. The Google authorized redirect URI is `https://efwefmhcjbatxfylmqqx.supabase.co/auth/v1/callback`.
- Set Supabase's Site URL and redirect allowlist to `https://planfix-social-plans.glitteringmotor3.chatgpt.site/`.
- In Google Cloud, use the website origin without a trailing slash as an authorized JavaScript origin. Add test users if the consent screen remains in testing mode.

The site retains its owner-private Sites audience. External users need a deliberate hosting audience change before they can visit; the application additionally enforces Google authentication.

## Access enforcement

The browser verifies its Supabase session with `getUser()`, requires a non-anonymous user and a Google identity, and only then loads authorized records. The SQL independently checks `auth.users` and `auth.identities`, blocks anonymous/email-only accounts, and protects every RPC and table read through actor/ownership helpers and RLS. Tampering with local storage or the UI does not grant database access.

The public `planfix_auth_mode` capability marker exposes only the literal `google_only`, with no user data. Startup requires this marker before opening the dashboard. If the provider, database, or required migration is unavailable, visitors remain at sign-in; no preview mode is offered.

A Google sign-in creates an account for new users and restores the existing account for returning users. Invitation tokens and intended create/join actions survive the same-tab OAuth round trip. Sign-out immediately clears in-memory plan data and closes dialogs. Bookmarks and recent activity are device-local and scoped to the verified account ID. Existing local preview data from prior versions is left untouched but is never used to unlock the app or displayed to unsigned visitors.

Legacy database records are retained. Already-linked historical identities continue to resolve to their Google account. New guest-upgrade tickets are disabled.

## Validation

`npm run build`

`npm test`

Tests cover the signed-out landing, anonymous and email-only rejection, an expired/unverified stored session, missing policy/configuration, OAuth cancellation, authenticated plan/vote/invite flows, sign-out, preserved invite intent, SQL/RLS enforcement, and non-destructive migration. PostgreSQL tests use PGlite with mocked Supabase Auth tables. UI tests use JSDOM with a test-only auth mock; production includes the real Supabase SDK.

Actual Google OAuth and live database operations still require the project owner to apply the SQL and enable Google. Visual browser QA requires the managed browser tool, which is not available in this session.
