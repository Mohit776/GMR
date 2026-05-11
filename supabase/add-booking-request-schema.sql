-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add-booking-request-schema.sql
-- Purpose:   Support the guide-accepts-first, then user-pays flow
-- Run in:    Supabase SQL Editor (or supabase db push)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add extra columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS start_date    timestamptz,
  ADD COLUMN IF NOT EXISTS end_date      timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_at   timestamptz,
  ADD COLUMN IF NOT EXISTS notified_guides uuid[] DEFAULT '{}',
  -- tracks what stage the booking is in before payment
  -- 'awaiting_guide'   = request sent, waiting for guide to accept
  -- 'awaiting_payment' = guide accepted, waiting for user to pay
  -- 'confirmed'        = payment done
  -- 'cancelled'        = cancelled at any stage
  ADD COLUMN IF NOT EXISTS pre_payment_status text DEFAULT 'awaiting_guide';

-- Index for city + status lookups (finding unmatched bookings)
CREATE INDEX IF NOT EXISTS bookings_city_status_idx
  ON public.bookings(city, status);

CREATE INDEX IF NOT EXISTS bookings_pre_payment_status_idx
  ON public.bookings(pre_payment_status)
  WHERE pre_payment_status IN ('awaiting_guide', 'awaiting_payment');

-- 2. booking_requests table — tracks per-guide accept/decline
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

-- Indexes
CREATE INDEX IF NOT EXISTS booking_requests_booking_id_idx
  ON public.booking_requests(booking_id);
CREATE INDEX IF NOT EXISTS booking_requests_guide_id_status_idx
  ON public.booking_requests(guide_id, status)
  WHERE status = 'pending';

-- RLS
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.booking_requests TO authenticated;
GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;

-- Guides see their own requests
DROP POLICY IF EXISTS "Guides see their booking requests" ON public.booking_requests;
CREATE POLICY "Guides see their booking requests"
  ON public.booking_requests FOR SELECT
  TO authenticated
  USING (guide_id = auth.uid());

-- Edge functions (service role) can insert/update freely
DROP POLICY IF EXISTS "Service role can manage booking_requests" ON public.booking_requests;
CREATE POLICY "Service role can manage booking_requests"
  ON public.booking_requests FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Guides read bookings they are requested for" ON public.bookings;
CREATE POLICY "Guides read bookings they are requested for"
  ON public.bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.booking_requests br
      WHERE br.booking_id = bookings.id
        AND br.guide_id = auth.uid()
    )
  );

-- 3. Add city index to users for guide lookups
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS city text;

UPDATE public.users
SET city = nullif(split_part(coalesce(profile_data->>'city', profile_data->>'location', ''), ',', 1), '')
WHERE role = 'guide'
  AND (city IS NULL OR city = '');

CREATE INDEX IF NOT EXISTS users_city_role_idx
  ON public.users(city, role)
  WHERE role = 'guide';

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
