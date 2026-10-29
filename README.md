<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e7a86e79-432f-4850-8d63-1c339abc4e01

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Supabase

The server provides the configured project URL and public client key at `/api/supabase/config`. Set `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` in the hosting environment to override the defaults. `SUPABASE_ANON_KEY` is only used as a fallback if no publishable key is configured. Do not use a service-role key in the browser or as the client key.

The CRM reads and writes data from the browser, so configure row-level security with policies appropriate for your users before storing customer records. The current `supabase_setup.sql` grants unrestricted access to the `anon` and `authenticated` roles; do not run it unchanged on a production project. Cloud sync is reported as unavailable until the `leads` table can be queried successfully.
