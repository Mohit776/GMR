-- Add partner_id column for hotel/rental booking requests
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

-- Index for partner lookups
CREATE INDEX IF NOT EXISTS booking_requests_partner_id_status_idx
  ON public.booking_requests(partner_id, status)
  WHERE status = 'pending';

-- Update RLS: Partners see their booking requests
DROP POLICY IF EXISTS "Partners see their booking requests" ON public.booking_requests;
CREATE POLICY "Partners see their booking requests"
  ON public.booking_requests FOR SELECT
  TO authenticated
  USING (guide_id = auth.uid() OR partner_id = auth.uid());

-- Partners can update their own requests (accept/decline)
DROP POLICY IF EXISTS "Partners update their booking requests" ON public.booking_requests;
CREATE POLICY "Partners update their booking requests"
  ON public.booking_requests FOR UPDATE
  TO authenticated
  USING (guide_id = auth.uid() OR partner_id = auth.uid())
  WITH CHECK (guide_id = auth.uid() OR partner_id = auth.uid());
