import {
  corsHeaders,
  errorResponse,
  getAuthContext,
  HttpError,
  json,
} from '../_shared/razorpay.ts';
import { sendPush, type PushDispatchResult } from '../_shared/push.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

type CancelBody = {
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

    let body: CancelBody;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid JSON body.');
    }

    const bookingId = String(body.bookingId || '').trim();
    if (!bookingId) throw new HttpError(400, 'Missing bookingId.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: booking, error: fetchError } = await serviceClient
      .from('bookings')
      .select('id, user_id, partner_id, item_name, notified_guides, status, pre_payment_status')
      .eq('id', bookingId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!booking) throw new HttpError(404, 'Booking not found.');
    if (booking.user_id !== auth.user.id) {
      throw new HttpError(403, 'You can only cancel your own booking.');
    }

    // Only allow cancellation of bookings that haven't been completed yet
    if (booking.status === 'completed') {
      throw new HttpError(400, 'This booking has already been completed and cannot be cancelled.');
    }
    if (booking.status === 'cancelled') {
      return json({ success: true, bookingId, notifiedCount: 0, alreadyCancelled: true });
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new HttpError(400, `Booking in status '${booking.status}' cannot be cancelled.`);
    }

    if (booking.status !== 'cancelled') {
      const { error: updateError } = await serviceClient
        .from('bookings')
        .update({
          status: 'cancelled',
          pre_payment_status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (updateError) throw updateError;
    }

    await serviceClient
      .from('booking_requests')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('booking_id', bookingId)
      .eq('status', 'pending');

    const targetIds = new Set<string>();
    if (booking.partner_id) {
      targetIds.add(booking.partner_id);
    } else {
      for (const guideId of (booking.notified_guides as string[] | null) || []) {
        targetIds.add(guideId);
      }
    }

    const pushResults: Array<PushDispatchResult & { userId: string }> = [];
    for (const userId of targetIds) {
      const pushResult = await sendPush(supabaseUrl, serviceKey, {
        userId,
        title: 'Booking cancelled',
        body: `The booking for ${booking.item_name || 'your trip'} was cancelled by the traveller.`,
        data: {
          type: 'booking_cancelled',
          bookingId,
          screen: 'bookings',
        },
      });
      pushResults.push({ userId, ...pushResult });
    }

    return json({
      success: true,
      bookingId,
      notifiedCount: pushResults.reduce((total, result) => total + result.sent, 0),
      pushResults,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
