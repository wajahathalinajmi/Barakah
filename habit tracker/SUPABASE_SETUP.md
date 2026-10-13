# Connect Barakah to Supabase

The app uses Supabase Auth for email/password accounts and a private JSONB row per user for habits and check-ins.

1. Create a Supabase project.
2. In **Project Settings → API**, copy the Project URL and the publishable key.
3. Paste them into `supabase-config.js` as `url` and `publishableKey`. The publishable key is designed for browser use; never use a `service_role` key in this file.
4. Open **SQL Editor** in Supabase and run all of `supabase-schema.sql`.
5. In **Authentication → URL Configuration**, add the app's deployed origin to the allowed redirect URLs. For local development, serve this folder from a local web server and add its origin (for example, `http://localhost:8000`).
6. Open the app from that origin and create an account. If email confirmation is enabled, confirm the link before signing in.

Until the project URL and publishable key are configured, the app displays this setup requirement instead of pretending that local browser storage is a real account.
