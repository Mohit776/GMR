import {
  corsHeaders,
  errorResponse,
  getAuthContext,
  HttpError,
  json,
} from '../_shared/razorpay.ts';
import { sendPush, type PushDispatchResult } from '../_shared/push.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

type AcceptBody = {
  bookingId: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const auth = await getAuthContext(req);

    let body: AcceptBody;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid JSON body.');
    }

    const bookingId = String(body.bookingId || '').trim();
    if (!bookingId) throw new HttpError(400, 'Missing bookingId.');

    const partnerId = auth.user.id;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // ─── 1. Verify this guide/partner has a pending request for this booking
    const { data: requestRow, error: reqFetchErr } = await serviceClient
      .from('booking_requests')
      .select('id, status, guide_id, partner_id')
      .eq('booking_id', bookingId)
      .or(`guide_id.eq.${partnerId},partner_id.eq.${partnerId}`)
      .maybeSingle();

    if (reqFetchErr) throw reqFetchErr;
    if (!requestRow) throw new HttpError(403, 'No booking request found for you.');
    if (requestRow.status === 'taken') {
      return json({ success: false, reason: 'already_taken' });
    }
    if (requestRow.status === 'accepted') {
      return json({ success: true, alreadyAccepted: true });
    }

    // ─── 2. Atomic UPDATE — only succeeds if no guide/partner has accepted yet
    //    Uses partner_id IS NULL as the race-condition guard
    const { data: updated, error: updateErr } = await serviceClient
      .from('bookings')
      .update({
        partner_id: partnerId,
        pre_payment_status: 'awaiting_payment',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .is('partner_id', null) // ← race condition guard: only one can win
      .eq('status', 'pending')
      .in('pre_payment_status', ['awaiting_guide', 'awaiting_owner'])
      .select('id, user_id, item_name, amount, city, notified_guides, guest_name')
      .maybeSingle();

    if (updateErr) throw updateErr;

    if (!updated) {
      // Another guide/partner won the race — mark this request as 'taken'
      await serviceClient
        .from('booking_requests')
        .update({ status: 'taken', responded_at: new Date().toISOString() })
        .eq('id', requestRow.id);

      return json({ success: false, reason: 'already_taken' });
    }

    // ─── 3. Update this request to 'accepted'
    await serviceClient
      .from('booking_requests')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', requestRow.id);

    // ─── 4. Mark all OTHER requests as 'taken'
    await serviceClient
      .from('booking_requests')
      .update({ status: 'taken', responded_at: new Date().toISOString() })
      .eq('booking_id', bookingId)
      .neq('id', requestRow.id)
      .eq('status', 'pending');

    // ─── 5. Get partner name to include in user notification
    const { data: partnerProfile } = await serviceClient
      .from('users')
      .select('name')
      .eq('id', partnerId)
      .maybeSingle();
    const partnerName = partnerProfile?.name || 'The owner/guide';
    const pushResults: Array<PushDispatchResult & { target: string; userId: string }> = [];

    // ─── 6. Notify the USER that their request was accepted → time to pay
    if (updated.user_id) {
      console.log(`[accept-booking-request] Sending acceptance notification to user ${updated.user_id} for booking ${bookingId}`);
      const pushResult = await sendPush(supabaseUrl, serviceKey, {
        userId: updated.user_id,
        title: 'Booking request accepted!',
        body: `${partnerName} accepted your booking. Tap to complete payment.`,
        data: {
          type: 'booking_accepted',
          bookingId,
          screen: 'bookings',
          amount: updated.amount,
          description: updated.item_name || 'Booking',
        },
      });
      console.log(`[accept-booking-request] User push result: sent=${pushResult.sent}, success=${pushResult.success}, reason=${pushResult.reason || 'ok'}`);
      pushResults.push({ target: 'user', userId: updated.user_id, ...pushResult });
    }

    // ─── 7. Notify other notified guides/partners that this booking was taken
    const notifiedGuides = (updated.notified_guides as string[]) || [];
    const otherGuides = notifiedGuides.filter((id) => id !== partnerId);

    if (otherGuides.length > 0) {
      console.log(`[accept-booking-request] Notifying ${otherGuides.length} others that booking ${bookingId} was taken`);
      for (const otherGuideId of otherGuides) {
        const pushResult = await sendPush(supabaseUrl, serviceKey, {
          userId: otherGuideId,
          title: 'Booking taken',
          body: 'Another partner accepted this booking first.',
          data: { type: 'booking_taken', bookingId },
        });
        console.log(`[accept-booking-request] Other partner ${otherGuideId} push result: sent=${pushResult.sent}`);
        pushResults.push({ target: 'other_partner', userId: otherGuideId, ...pushResult });
      }
    }

    console.log(`[accept-booking-request] Completed. Push results:`, pushResults);
    return json({ success: true, bookingId, pushResults });
  } catch (error) {
    return errorResponse(error);
  }
});
