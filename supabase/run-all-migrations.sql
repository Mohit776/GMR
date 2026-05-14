-- =============================================================================
-- GMR Combined Migration: Guide-First Booking Flow
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- ── 1. Add city column to users ─────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS city text;

UPDATE public.users
SET city = nullif(split_part(coalesce(profile_data->>'city', profile_data->>'location', ''), ',', 1), '')
WHERE role = 'guide'
  AND (city IS NULL OR city = '');

-- ── 2. Add new columns to bookings ──────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS city               text,
  ADD COLUMN IF NOT EXISTS start_date         timestamptz,
  ADD COLUMN IF NOT EXISTS end_date           timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_at        timestamptz,
  ADD COLUMN IF NOT EXISTS notified_guides    uuid[] DEFAULT '{}',
  -- 'awaiting_guide' | 'awaiting_payment' | 'confirmed' | 'cancelled'
  ADD COLUMN IF NOT EXISTS pre_payment_status text DEFAULT 'awaiting_guide';

-- ── 3. Indexes on bookings ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS bookings_city_status_idx
  ON public.bookings(city, status);

CREATE INDEX IF NOT EXISTS bookings_pre_payment_status_idx
  ON public.bookings(pre_payment_status)
  WHERE pre_payment_status IN ('awaiting_guide', 'awaiting_payment');

-- ── 4. booking_requests table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  guide_id      uuid NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'declined' | 'taken'
  responded_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id, guide_id)
);

-- ── 5. Indexes on booking_requests ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS booking_requests_booking_id_idx
  ON public.booking_requests(booking_id);

CREATE INDEX IF NOT EXISTS booking_requests_guide_id_status_idx
  ON public.booking_requests(guide_id, status)
  WHERE status = 'pending';

-- ── 6. Index on users for city-based guide lookup ───────────────────────────
CREATE INDEX IF NOT EXISTS users_city_role_idx
  ON public.users(city, role)
  WHERE role = 'guide';

-- ── 7. RLS on booking_requests ───────────────────────────────────────────────
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.booking_requests TO authenticated;
GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;

-- Drop existing policies first to avoid conflicts on re-run
DROP POLICY IF EXISTS "Guides see their booking requests" ON public.booking_requests;
DROP POLICY IF EXISTS "Service role can manage booking_requests" ON public.booking_requests;
DROP POLICY IF EXISTS "Guides read bookings they are requested for" ON public.bookings;

-- Guides can see their own requests
CREATE POLICY "Guides see their booking requests"
  ON public.booking_requests FOR SELECT
  TO authenticated
  USING (guide_id = auth.uid());

-- Service role (edge functions) can do everything
CREATE POLICY "Service role can manage booking_requests"
  ON public.booking_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Guides must be able to read the booking details joined from their request.
CREATE POLICY "Guides read bookings they are requested for"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.booking_requests br
      WHERE br.booking_id = bookings.id
        AND br.guide_id = auth.uid()
    )
  );

-- ── 8. Notify PostgREST to reload schema cache ───────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_requests;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

-- Done ✓
SELECT 'Migration completed successfully' AS result;
create table if not exists public.app_settings (
  id integer primary key default 1,
  service_fee_percentage numeric not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_row check (id = 1)
);

insert into public.app_settings (id, service_fee_percentage)
values (1, 5)
on conflict (id) do nothing;

create publication IF NOT EXISTS supabase_realtime;
alter publication supabase_realtime add table public.app_settings;

alter table public.app_settings enable row level security;

-- Everyone can read
drop policy if exists "Anyone can read app_settings" on public.app_settings;
create policy "Anyone can read app_settings"
on public.app_settings for select
using (true);

-- Only admins can update
drop policy if exists "Admins can update app_settings" on public.app_settings;
create policy "Admins can update app_settings"
on public.app_settings for update
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- Add trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
before update on public.app_settings
for each row
execute procedure public.handle_updated_at();
