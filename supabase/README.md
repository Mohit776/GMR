# Supabase Push Deployment

1. Run `schema.sql` in the Supabase SQL editor. It creates the app tables, storage buckets, and RLS policies.
2. Deploy the Edge Function in `functions/send-push`.
3. In Supabase Dashboard, create database webhooks to call the deployed `send-push` function:
   - `public.bookings` after `INSERT`
   - `public.bookings` after `UPDATE`
   - `public.users` after `UPDATE`
4. Set webhook headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer <SUPABASE_ANON_KEY>` or your chosen function auth secret.

The apps also call `send-push` directly after booking creation/status updates, so webhooks are a backup/central automation path.

Remote push requires a development build or production build. Expo Go is not enough for full remote push testing on current Android SDKs.

