import {
  corsHeaders,
  errorResponse,
  getAuthContext,
  HttpError,
  json,
} from '../_shared/razorpay.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

type SendBookingRequestBody = {
  city: string;
  bookingType: string;
  itemId: string;
  itemName: string;
  days: number;
  amount: number;
  description?: string;
  coupon?: string;
  discountAmount?: number;
  startDate?: string;
  endDate?: string;
};

type GuideRow = {
  id: string;
  name?: string | null;
  city?: string | null;
  profile_data?: Record<string, unknown> | null;
};

function normalizeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function firstCityPart(value: unknown) {
  return normalizeText(value).split(',')[0]?.trim() || '';
}

function guideMatchesCity(guide: GuideRow, requestedCity: string) {
  const requested = normalizeText(requestedCity);
  const requestedFirstPart = firstCityPart(requestedCity);
  const guideCity = normalizeText(guide.city);
  const profileCity = normalizeText(guide.profile_data?.city);
  const profileLocation = normalizeText(guide.profile_data?.location);

  const candidates = [requested, requestedFirstPart].filter(Boolean);
  const guideLocations = [guideCity, profileCity, profileLocation].filter(Boolean);

  return guideLocations.some((location) =>
    candidates.some((candidate) => (
      location === candidate ||
      location.includes(candidate) ||
      candidate.includes(location)
    ))
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const auth = await getAuthContext(req);

    let body: SendBookingRequestBody;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'Invalid JSON body.');
    }

    const city = String(body.city || '').trim().toLowerCase();
    if (!city) throw new HttpError(400, 'Missing city.');
    if (!body.amount || body.amount <= 0) throw new HttpError(400, 'Invalid amount.');
    if (!body.itemId) throw new HttpError(400, 'Missing itemId.');

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

    const bookingRow: Record<string, unknown> = {
      user_id: auth.user.id,
      user_name: userName,
      user_email: auth.user.email || '',
      booking_type: body.bookingType || 'guide',
      type: body.bookingType || 'guide',
      item_id: body.itemId,
      item_name: body.itemName || 'Guide Booking',
      days: Math.max(1, body.days || 1),
      amount: body.amount,
      price: body.amount,
      payment_status: 'pending',
      status: 'pending',
      pre_payment_status: 'awaiting_guide',
      city,
      guest_name: userName,
      date: new Date().toISOString().split('T')[0],
      note: body.description || '',
      notified_guides: [],
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

    const { data: guides, error: guidesError } = await serviceClient
      .from('users')
      .select('id, name, city, profile_data')
      .eq('role', 'guide')
      .eq('is_approved', true);

    if (guidesError) throw guidesError;

    const guideRows = (guides || []) as GuideRow[];
    const selectedGuideId = body.bookingType === 'guide' ? String(body.itemId || '') : '';
    const selectedGuide = guideRows.find((g) => g.id === selectedGuideId);
    const cityGuides = guideRows.filter((g) => guideMatchesCity(g, city));
    const guideMap = new Map<string, GuideRow>();

    if (selectedGuide) guideMap.set(selectedGuide.id, selectedGuide);
    for (const guide of cityGuides) guideMap.set(guide.id, guide);

    const eligibleGuides = Array.from(guideMap.values());

    if (eligibleGuides.length === 0) {
      await serviceClient
        .from('bookings')
        .update({ pre_payment_status: 'awaiting_guide' })
        .eq('id', bookingId);

      return json({
        success: true,
        bookingId,
        notifiedCount: 0,
        requestCount: 0,
        message: 'No guides available in this city right now. You will be notified when one accepts.',
      });
    }

    const requestRows = eligibleGuides.map((g) => ({
      booking_id: bookingId,
      guide_id: g.id,
      status: 'pending',
    }));

    const { error: reqError } = await serviceClient
      .from('booking_requests')
      .insert(requestRows);
    if (reqError) {
      console.warn('booking_requests insert error:', reqError.message);
      throw reqError;
    }

    const requestedGuideIds = eligibleGuides.map((g) => g.id);
    await serviceClient
      .from('bookings')
      .update({ notified_guides: requestedGuideIds })
      .eq('id', bookingId);

    let notifiedCount = 0;
    const displayCity = city.charAt(0).toUpperCase() + city.slice(1);
    for (const guide of eligibleGuides) {
      try {
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: guide.id,
            title: `New booking in ${displayCity}!`,
            body: `${userName} is looking for a guide in ${displayCity}. Tap to accept!`,
            data: {
              type: 'booking_request',
              bookingId,
              screen: 'bookings',
            },
          }),
        });
        const pushResult = await pushResponse.json().catch(() => ({}));
        notifiedCount += Number(pushResult?.sent || 0);
      } catch (e) {
        console.warn('push failed for guide', guide.id, e instanceof Error ? e.message : String(e));
      }
    }

    return json({
      success: true,
      bookingId,
      notifiedCount,
      requestCount: eligibleGuides.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
