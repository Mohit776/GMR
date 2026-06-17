import {
  corsHeaders,
  errorResponse,
  getAuthContext,
  HttpError,
  json,
} from '../_shared/razorpay.ts';
import { sendPush, type PushDispatchResult } from '../_shared/push.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

type SendPartnerBookingRequestBody = {
  city: string;
  bookingType: string; // 'hotel' or 'rental'
  itemId: string; // listing id
  itemName: string;
  days: number;
  amount: number;
  description?: string;
  coupon?: string;
  discountAmount?: number;
  startDate?: string;
  endDate?: string;
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

    let body: SendPartnerBookingRequestBody;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid JSON body.');
    }

    const city = String(body.city || '').trim().toLowerCase();
    if (!city) throw new HttpError(400, 'Missing city.');
    if (!body.amount || body.amount <= 0) throw new HttpError(400, 'Invalid amount.');
    if (!body.itemId) throw new HttpError(400, 'Missing itemId (listing ID).');
    if (!body.bookingType || (body.bookingType !== 'hotel' && body.bookingType !== 'rental' && body.bookingType !== 'vehicle')) {
      throw new HttpError(400, 'Invalid booking type for partner request.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const userName =
      auth.user.user_metadata?.full_name ||
      auth.user.user_metadata?.name ||
      auth.user.email?.split('@')[0] ||
      'Traveler';

    // Check if user already has an active pending request
    const { data: existingPending } = await serviceClient
      .from('bookings')
      .select('id, pre_payment_status')
      .eq('user_id', auth.user.id)
      .eq('status', 'pending')
      .in('pre_payment_status', ['awaiting_owner', 'awaiting_payment'])
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      const stateLabel = existingPending.pre_payment_status === 'awaiting_payment'
        ? 'The owner has accepted your request and is awaiting payment. Please complete or cancel it first.'
        : 'You already have an active booking request. Please cancel it or wait for it to expire before placing a new one.';
      throw new HttpError(400, stateLabel);
    }

    // Lookup the listing to find the partner ID and location
    const { data: listing, error: listingError } = await serviceClient
      .from('listings')
      .select('id, partner_id, title, location')
      .eq('id', body.itemId)
      .single();

    if (listingError || !listing) {
      throw new HttpError(404, 'Listing not found.');
    }

    const partnerId = listing.partner_id;
    // Use listing location as city if available (client may send hotel name instead of city)
    const resolvedCity = (listing.location || city || '').trim().toLowerCase().split(',')[0]?.trim() || city;

    const bookingRow: Record<string, unknown> = {
      user_id: auth.user.id,
      user_name: userName,
      user_email: auth.user.email || '',
      booking_type: body.bookingType,
      type: body.bookingType,
      item_id: body.itemId,
      item_name: body.itemName || listing.title || 'Partner Booking',
      days: Math.max(1, body.days || 1),
      amount: body.amount,
      price: body.amount,
      payment_status: 'pending',
      status: 'pending',
      pre_payment_status: 'awaiting_owner',
      city: resolvedCity,
      guest_name: userName,
      date: new Date().toISOString().split('T')[0],
      note: body.description || '',
    };
    if (body.startDate) bookingRow.start_date = body.startDate;
    if (body.endDate) bookingRow.end_date = body.endDate;

    const { data: booking, error: insertError } = await serviceClient
      .from('bookings')
      .insert(bookingRow)
      .select('id')
      .single();
      
    if (insertError) throw insertError;

    const bookingId = booking.id;

    // Create the booking request directed to this specific partner
    const requestRow = {
      booking_id: bookingId,
      guide_id: null,
      partner_id: partnerId,
      status: 'pending',
    };

    const { error: reqError } = await serviceClient
      .from('booking_requests')
      .insert([requestRow]);
      
    if (reqError) {
      console.warn('booking_requests insert error:', reqError.message);
      throw reqError;
    }

    const pushResult = await sendPush(supabaseUrl, serviceKey, {
      userId: partnerId,
      title: `New Booking Request!`,
      body: `${userName} wants to book ${body.itemName || listing.title}. Tap to review!`,
      app: 'partner',
      data: {
        type: 'booking_request',
        bookingId,
        screen: 'bookings',
      },
    });

    console.log(`[send-partner-booking-request] Push to partner ${partnerId}: sent=${pushResult.sent}, attempted=${pushResult.attempted}, success=${pushResult.success}, reason=${pushResult.reason || 'none'}`);

    // Notify all admins
    const { data: admins } = await serviceClient
      .from('users')
      .select('id')
      .eq('role', 'admin');
    for (const admin of (admins || [])) {
      const adminPush = await sendPush(supabaseUrl, serviceKey, {
        userId: admin.id,
        title: `New Partner Booking Request`,
        body: `${userName} wants to book ${body.itemName || listing.title}.`,
        app: 'partner',
        data: { type: 'booking_request', bookingId, screen: 'bookings' },
      });
      console.log(`[send-partner-booking-request] Admin push to ${admin.id}: sent=${adminPush.sent}`);
    }

    return json({
      success: true,
      bookingId,
      notifiedCount: pushResult.sent,
      requestCount: 1,
      pushResults: [{ partnerId, ...pushResult }],
    });
  } catch (error) {
    return errorResponse(error);
  }
});
