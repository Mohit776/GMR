import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

export type BookingInput = {
  amount: number;
  description?: string;
  bookingType: 'vehicle' | 'hotel' | 'guide';
  itemId: string;
  itemName?: string;
  days: number;
  partnerId?: string;
  coupon?: string;
  discountAmount?: number;
};

export type ResolvedBooking = {
  input: BookingInput;
  bookingType: 'vehicle' | 'hotel' | 'guide';
  itemId: string;
  itemName: string;
  listingId: string | null;
  partnerId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  serviceFee: number;
  discountAmount: number;
  amountRupees: number;
  amountPaise: number;
  description: string;
};

export type AuthContext = {
  user: User;
  serviceClient: SupabaseClient;
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return json({ success: false, error: error.message }, error.status);
  }

  console.error(error);
  return json(
    {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    },
    500
  );
}

export async function getAuthContext(req: Request): Promise<AuthContext> {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonOrPublishableKey =
    Deno.env.get('SUPABASE_ANON_KEY') ||
    Deno.env.get('SB_PUBLISHABLE_KEY') ||
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
    '';

  if (!anonOrPublishableKey) {
    throw new HttpError(500, 'Missing Supabase public API key for auth verification.');
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Missing authorization token.');

  const authClient = createClient(supabaseUrl, anonOrPublishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, 'Invalid authorization token.');
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return { user: data.user, serviceClient };
}

export async function readBookingInput(req: Request): Promise<BookingInput> {
  let body: Partial<BookingInput>;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON request body.');
  }

  const bookingType = String(body.bookingType || '').toLowerCase();
  if (!['vehicle', 'hotel', 'guide'].includes(bookingType)) {
    throw new HttpError(400, 'Unsupported booking type.');
  }

  const itemId = String(body.itemId || '').trim();
  if (!itemId) throw new HttpError(400, 'Missing booking item.');

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'Invalid booking amount.');
  }

  const days = Math.max(1, Math.min(365, Math.trunc(Number(body.days) || 1)));
  const discountAmount = Math.max(0, Number(body.discountAmount) || 0);

  return {
    amount,
    description: String(body.description || 'Booking Payment').slice(0, 240),
    bookingType: bookingType as 'vehicle' | 'hotel' | 'guide',
    itemId,
    itemName: String(body.itemName || '').slice(0, 240),
    days,
    partnerId: String(body.partnerId || '').trim(),
    coupon: String(body.coupon || '').trim().toUpperCase() || undefined,
    discountAmount,
  };
}

export async function resolveBooking(
  serviceClient: SupabaseClient,
  input: BookingInput
): Promise<ResolvedBooking> {
  if (input.bookingType === 'guide') {
    return resolveGuideBooking(serviceClient, input);
  }

  return resolveListingBooking(serviceClient, input);
}

export function buildBookingRow(
  user: User,
  resolved: ResolvedBooking,
  payment: {
    paymentId: string;
    orderId: string;
    signature: string;
  }
) {
  const userName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Unknown User';

  return {
    user_id: user.id,
    user_name: userName,
    user_email: user.email || '',
    booking_type: resolved.bookingType,
    type: resolved.bookingType,
    item_id: resolved.itemId,
    listing_id: resolved.listingId,
    item_name: resolved.itemName,
    days: resolved.quantity,
    amount: resolved.amountRupees,
    price: resolved.amountRupees,
    payment_id: payment.paymentId,
    razorpay_order_id: payment.orderId,
    razorpay_signature: payment.signature,
    payment_provider: 'razorpay',
    payment_verified_at: new Date().toISOString(),
    payment_status: 'paid',
    status: 'confirmed',
    partner_id: resolved.partnerId,
    guest_name: userName || 'Guest Traveler',
    date: new Date().toISOString().split('T')[0],
    note: '',
  };
}

export async function createRazorpayOrder(user: User, resolved: ResolvedBooking) {
  const keyId = getEnv('RAZORPAY_KEY_ID');
  const keySecret = getEnv('RAZORPAY_KEY_SECRET');
  const receipt = `gmr_${Date.now().toString(36)}_${user.id.slice(0, 8)}`.slice(0, 40);

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: resolved.amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        user_id: user.id,
        booking_type: resolved.bookingType,
        item_id: resolved.itemId,
        listing_id: resolved.listingId || '',
        partner_id: resolved.partnerId,
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.description || 'Unable to create Razorpay order.';
    throw new HttpError(502, message);
  }

  return body;
}

export async function fetchRazorpayOrder(orderId: string) {
  const keyId = getEnv('RAZORPAY_KEY_ID');
  const keySecret = getEnv('RAZORPAY_KEY_SECRET');

  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.description || 'Unable to fetch Razorpay order.';
    throw new HttpError(502, message);
  }

  return body;
}

export async function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  const keySecret = getEnv('RAZORPAY_KEY_SECRET');
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`${orderId}|${paymentId}`));
  return safeEqualHex(toHex(digest), signature);
}

export async function sendBookingPush(resolved: ResolvedBooking, guestName: string, bookingId: string) {
  if (!resolved.partnerId) return;

  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: resolved.partnerId,
        title: 'New booking',
        body: `${guestName} booked ${resolved.itemName}.`,
        data: { type: 'new_booking', bookingId, screen: 'bookings' },
      }),
    });
  } catch (error) {
    console.warn('Push notification failed:', error instanceof Error ? error.message : String(error));
  }
}

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `Missing server secret: ${name}.`);
  return value;
}

async function resolveListingBooking(serviceClient: SupabaseClient, input: BookingInput): Promise<ResolvedBooking> {
  const expectedListingType = input.bookingType === 'vehicle' ? 'rental' : input.bookingType;
  const { data: listing, error } = await serviceClient
    .from('listings')
    .select('id, partner_id, type, title, price, is_active')
    .eq('id', input.itemId)
    .maybeSingle();

  if (error) throw error;
  if (!listing || listing.type !== expectedListingType || listing.is_active !== true) {
    throw new HttpError(404, 'Booking item is not available.');
  }
  
  const { data: appSettings } = await serviceClient.from('app_settings').select('service_fee_percentage').eq('id', 1).single();
  const feePercent = appSettings?.service_fee_percentage != null ? Number(appSettings.service_fee_percentage) : 5;

  const unitPrice = toPositiveNumber(listing.price, 'Listing price is invalid.');
  const quantity = input.days;
  const pricing = validatePricing(input, unitPrice, quantity, feePercent);

  return {
    input,
    bookingType: input.bookingType as 'vehicle' | 'hotel',
    itemId: listing.id,
    itemName: listing.title || input.itemName || 'Booking',
    listingId: listing.id,
    partnerId: listing.partner_id,
    quantity,
    unitPrice,
    ...pricing,
    description: input.description || `${listing.title} booking`,
  };
}

async function resolveGuideBooking(serviceClient: SupabaseClient, input: BookingInput): Promise<ResolvedBooking> {
  const guideId = input.itemId || input.partnerId || '';
  const { data: guide, error: guideError } = await serviceClient
    .from('users')
    .select('id, name, role, is_approved, profile_data')
    .eq('id', guideId)
    .maybeSingle();

  if (guideError) throw guideError;
  if (!guide || guide.role !== 'guide' || guide.is_approved !== true) {
    throw new HttpError(404, 'Guide is not available.');
  }

  const { data: listing, error: listingError } = await serviceClient
    .from('listings')
    .select('id, title, price, is_active')
    .eq('partner_id', guide.id)
    .eq('type', 'guide')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (listingError) throw listingError;

  const profileData = parseProfileData(guide.profile_data);
  const profilePrice = Number(profileData.price_per_day || profileData.pricePerDay || 0);
  const listingPrice = listing ? Number(listing.price || 0) : 0;
  const unitPrice = toPositiveNumber(profilePrice > 0 ? profilePrice : listingPrice, 'Guide price is invalid.');
  const quantity = input.days;
  
  const { data: appSettings } = await serviceClient.from('app_settings').select('service_fee_percentage').eq('id', 1).single();
  const feePercent = appSettings?.service_fee_percentage != null ? Number(appSettings.service_fee_percentage) : 5;
  
  const pricing = validatePricing(input, unitPrice, quantity, feePercent);

  return {
    input,
    bookingType: 'guide',
    itemId: guide.id,
    itemName: guide.name || listing?.title || input.itemName || 'Guide Booking',
    listingId: listing?.id || null,
    partnerId: guide.id,
    quantity,
    unitPrice,
    ...pricing,
    description: input.description || `${guide.name || 'Guide'} booking`,
  };
}

function validatePricing(input: BookingInput, unitPrice: number, quantity: number, feePercent: number) {
  const subtotal = unitPrice * quantity;
  const serviceFee = Math.round(subtotal * (feePercent / 100));
  const requestedDiscount = Math.round((Number(input.discountAmount) || 0) * 100) / 100;
  const maxDiscount = input.coupon ? Math.round(subtotal * 0.1) : 0;

  if (requestedDiscount > maxDiscount) {
    throw new HttpError(400, 'Invalid discount for this booking.');
  }

  const amountRupees = subtotal + serviceFee - requestedDiscount;
  const amountPaise = Math.round(amountRupees * 100);
  const requestedPaise = Math.round(Number(input.amount) * 100);

  if (amountPaise !== requestedPaise) {
    throw new HttpError(400, 'Payment amount changed. Please return to checkout and try again.');
  }

  return {
    subtotal,
    serviceFee,
    discountAmount: requestedDiscount,
    amountRupees,
    amountPaise,
  };
}

function parseProfileData(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return {};

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function toPositiveNumber(value: unknown, message: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new HttpError(400, message);
  }
  return numberValue;
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
