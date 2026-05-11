import {
  corsHeaders,
  errorResponse,
  getAuthContext,
  HttpError,
  json,
} from '../_shared/razorpay.ts';
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

    const guideId = auth.user.id;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // ─── 1. Verify this guide has a pending request for this booking
    const { data: requestRow, error: reqFetchErr } = await serviceClient
      .from('booking_requests')
      .select('id, status')
      .eq('booking_id', bookingId)
      .eq('guide_id', guideId)
      .maybeSingle();

    if (reqFetchErr) throw reqFetchErr;
    if (!requestRow) throw new HttpError(403, 'No booking request found for you.');
    if (requestRow.status === 'taken') {
      return json({ success: false, reason: 'already_taken' });
    }
    if (requestRow.status === 'accepted') {
      return json({ success: true, alreadyAccepted: true });
    }

    // ─── 2. Atomic UPDATE — only succeeds if no guide has accepted yet
    //    Uses partner_id IS NULL as the race-condition guard
    const { data: updated, error: updateErr } = await serviceClient
      .from('bookings')
      .update({
        partner_id: guideId,
        pre_payment_status: 'awaiting_payment',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .is('partner_id', null) // ← race condition guard: only one guide can win
      .eq('pre_payment_status', 'awaiting_guide')
      .select('id, user_id, item_name, amount, city, notified_guides, guest_name')
      .maybeSingle();

    if (updateErr) throw updateErr;

    if (!updated) {
      // Another guide won the race — mark this guide's request as 'taken'
      await serviceClient
        .from('booking_requests')
        .update({ status: 'taken', responded_at: new Date().toISOString() })
        .eq('booking_id', bookingId)
        .eq('guide_id', guideId);

      return json({ success: false, reason: 'already_taken' });
    }

    // ─── 3. Update this guide's request to 'accepted'
    await serviceClient
      .from('booking_requests')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('booking_id', bookingId)
      .eq('guide_id', guideId);

    // ─── 4. Mark all OTHER guides' requests as 'taken'
    await serviceClient
      .from('booking_requests')
      .update({ status: 'taken', responded_at: new Date().toISOString() })
      .eq('booking_id', bookingId)
      .neq('guide_id', guideId)
      .eq('status', 'pending');

    // ─── 5. Get guide name to include in user notification
    const { data: guideProfile } = await serviceClient
      .from('users')
      .select('name')
      .eq('id', guideId)
      .maybeSingle();
    const guideName = guideProfile?.name || 'Your guide';

    // ─── 6. Notify the USER that their guide accepted → time to pay
    if (updated.user_id) {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: updated.user_id,
          title: '🎉 Guide accepted your request!',
          body: `${guideName} accepted your booking. Tap to complete payment.`,
          data: {
            type: 'guide_accepted',
            bookingId,
            screen: 'bookings',
          },
        }),
      }).catch((e) => console.warn('User push failed:', e instanceof Error ? e.message : String(e)));
    }

    // ─── 7. Notify other guides that this booking was taken
    const notifiedGuides = (updated.notified_guides as string[]) || [];
    const otherGuides = notifiedGuides.filter((id) => id !== guideId);

    if (otherGuides.length > 0) {
      const { data: otherGuideProfiles } = await serviceClient
        .from('users')
        .select('id, fcm_tokens')
        .in('id', otherGuides)
        .not('fcm_tokens', 'is', null);

      for (const g of (otherGuideProfiles || [])) {
        for (const token of (g.fcm_tokens as string[] || [])) {
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              apikey: serviceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token,
              title: 'Booking taken',
              body: 'Another guide accepted this booking first.',
              data: { type: 'booking_taken', bookingId },
            }),
          }).catch(() => {});
        }
      }
    }

    return json({ success: true, bookingId });
  } catch (error) {
    return errorResponse(error);
  }
});
