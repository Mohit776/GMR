import {
  corsHeaders,
  createRazorpayOrder,
  errorResponse,
  getAuthContext,
  HttpError,
  json,
  readBookingInput,
  resolveBooking,
} from '../_shared/razorpay.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const auth = await getAuthContext(req);

    let bodyText: string;
    try {
      bodyText = await req.text();
    } catch {
      throw new HttpError(400, 'Invalid request body.');
    }

    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      throw new HttpError(400, 'Invalid JSON.');
    }

    // ─── NEW FLOW: bookingId provided → create order from existing booking ──
    if (parsedBody.bookingId) {
      const bookingId = String(parsedBody.bookingId).trim();

      const { data: preBooking, error: fetchErr } = await auth.serviceClient
        .from('bookings')
        .select('id, user_id, amount, pre_payment_status, item_id, item_name, booking_type')
        .eq('id', bookingId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!preBooking) throw new HttpError(404, 'Booking not found.');
      if (preBooking.user_id !== auth.user.id) {
        throw new HttpError(403, 'Booking does not belong to you.');
      }
      if (preBooking.pre_payment_status !== 'awaiting_payment') {
        throw new HttpError(400, 'This booking is not ready for payment yet. Your guide must accept first.');
      }

      const amountPaise = Math.round(Number(preBooking.amount) * 100);
      const receipt = `gmr_${Date.now().toString(36)}_${auth.user.id.slice(0, 8)}`.slice(0, 40);

      const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
      const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;

      const resp = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt,
          notes: {
            user_id: auth.user.id,
            booking_id: bookingId,
            booking_type: preBooking.booking_type,
            item_id: preBooking.item_id,
          },
        }),
      });

      const order = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = order?.error?.description || 'Unable to create Razorpay order.';
        throw new HttpError(502, msg);
      }

      return json({
        success: true,
        keyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency || 'INR',
        bookingId,
      });
    }

    // ─── LEGACY FLOW: full booking payload ──────────────────────────────────
    const bookingReq = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: bodyText,
    });
    const input = await readBookingInput(bookingReq);
    const resolved = await resolveBooking(auth.serviceClient, input);
    const order = await createRazorpayOrder(auth.user, resolved);

    return json({
      success: true,
      keyId: Deno.env.get('RAZORPAY_KEY_ID'),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency || 'INR',
    });
  } catch (error) {
    return errorResponse(error);
  }
});
