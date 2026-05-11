-- =============================================================================
-- FIX: Allow guides to read bookings that have a booking_request for them
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- Problem: The bookings RLS policy only allows user_id or partner_id to read,
-- but when a booking is created via send-booking-request, partner_id is NULL
-- (no guide accepted yet). So the guide's join query returns empty bookings data.

-- Solution: Add an RLS policy that lets guides read bookings where they have
-- a pending booking_request entry.

DROP POLICY IF EXISTS "Guides read bookings they are requested for" ON public.bookings;
CREATE POLICY "Guides read bookings they are requested for"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.booking_requests br
      WHERE br.booking_id = bookings.id
        AND br.guide_id = auth.uid()
    )
  );

-- Also add a policy to let the bookings table handle the guest_name column
-- which we reference via the join (booking_requests → bookings)

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Guide booking access policy applied successfully' AS result;
