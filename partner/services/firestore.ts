import { supabase } from './supabase';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface BookingRequest {
  id: string;
  bookingId: string;
  status: 'pending' | 'accepted' | 'taken';
  city: string;
  guestName: string;
  date: string;
  amount: number;
  itemName: string;
  note?: string;
  createdAt: string;
}

function mapBookingRequest(row: any): BookingRequest {
  const b = row.bookings ?? {};
  return {
    id: row.id,
    bookingId: row.booking_id,
    status: row.status || 'pending',
    city: b.city || '',
    guestName: b.guest_name || 'Guest Traveler',
    date: b.date || (b.created_at ? b.created_at.split('T')[0] : ''),
    amount: Number(b.amount ?? b.price ?? 0),
    itemName: b.item_name || 'Trip',
    note: b.note || '',
    createdAt: row.created_at || '',
  };
}

export async function getBookingRequests(guideId: string): Promise<BookingRequest[]> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*, bookings(city, guest_name, date, amount, price, item_name, note, created_at)')
    .eq('guide_id', guideId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapBookingRequest);
}

export function listenToBookingRequests(
  guideId: string,
  callback: (requests: BookingRequest[]) => void
) {
  let active = true;
  const refresh = () => {
    getBookingRequests(guideId)
      .then((rows) => {
        if (active) callback(rows);
      })
      .catch(console.warn);
  };

  refresh();

  const channel = supabase
    .channel(`partner_booking_requests_${guideId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_requests',
        filter: `guide_id=eq.${guideId}`,
      },
      refresh
    )
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export async function acceptBookingRequest(
  bookingId: string
): Promise<{ success: boolean; reason?: string; alreadyAccepted?: boolean }> {
  const { data, error } = await supabase.functions.invoke('accept-booking-request', {
    body: { bookingId },
  });
  if (error) throw error;
  return data;
}

export interface Booking {
  id: string;
  type: 'guide' | 'hotel' | 'rental';
  guestName: string;
  date: string;
  price: number;
  status: BookingStatus;
  note?: string;
}

export interface Listing {
  id: string;
  partnerId: string;
  type: 'guide' | 'hotel' | 'rental';
  title: string;
  description?: string;
  price: number;
  images: string[];
  isActive: boolean;
  details: Record<string, any>;
  location?: string;
}

function mapBooking(row: any): Booking {
  return {
    id: row.id,
    type: row.type || row.booking_type || 'guide',
    guestName: row.guest_name || row.user_name || 'Guest',
    date: row.date || (row.created_at ? row.created_at.split('T')[0] : ''),
    price: Number(row.price ?? row.amount ?? 0),
    status: row.status || 'pending',
    note: row.note || '',
  };
}

function mapListing(row: any): Listing {
  return {
    id: row.id,
    partnerId: row.partner_id,
    type: row.type || 'guide',
    title: row.title || '',
    description: row.description || '',
    price: Number(row.price || 0),
    images: row.images || [],
    isActive: Boolean(row.is_active),
    details: row.details || {},
    location: typeof row.location === 'string' ? row.location : row.location?.address,
  };
}

export async function getBookings(partnerId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapBooking);
}

export function listenToBookings(partnerId: string, callback: (bookings: Booking[]) => void) {
  let active = true;
  const refresh = () => {
    getBookings(partnerId)
      .then((rows) => {
        if (active) callback(rows);
      })
      .catch(console.warn);
  };

  refresh();

  const channel = supabase
    .channel(`partner_bookings_${partnerId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `partner_id=eq.${partnerId}`,
      },
      refresh
    )
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export async function updateBookingStatus(id: string, status: BookingStatus) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('user_id, item_name, date')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;

  if (booking?.user_id) {
    supabase.functions.invoke('send-push', {
      body: {
        userId: booking.user_id,
        title: `Booking ${status}`,
        body: `Your booking for ${booking.item_name || 'your trip'} is now ${status}.`,
        data: { type: `booking_${status}`, screen: 'bookings' },
      },
    }).catch((pushError) => {
      console.warn('Push notification failed:', pushError.message);
    });
  }
}

export async function getListings(partnerId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapListing);
}

export function listenToListings(partnerId: string, callback: (listings: Listing[]) => void) {
  let active = true;
  getListings(partnerId)
    .then((rows) => {
      if (active) callback(rows);
    })
    .catch(console.warn);
  return () => {
    active = false;
  };
}

export async function createListing(listing: Omit<Listing, 'id'>) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('You must be signed in to create listings.');
  }

  const ownerId = authData.user.id;
  if (listing.partnerId !== ownerId) {
    throw new Error('You can only create listings for your own partner account.');
  }

  // Determine the correct partner type — the profile.role may still be 'user'
  // if the DB wasn't updated during onboarding, so we resolve it here.
  const validPartnerTypes = ['guide', 'hotel', 'rental'] as const;
  let resolvedType: 'guide' | 'hotel' | 'rental' = validPartnerTypes.includes(listing.type as any)
    ? listing.type
    : 'guide'; // fallback while we look up the actual role

  // Ensure the user row exists and has a valid partner role
  await ensurePartnerCanManageListings(ownerId, resolvedType);

  // Re-fetch the profile to get the definitive role after ensurePartner fixed it
  if (!validPartnerTypes.includes(listing.type as any)) {
    const { data: freshProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', ownerId)
      .maybeSingle();
    if (freshProfile && validPartnerTypes.includes(freshProfile.role as any)) {
      resolvedType = freshProfile.role as 'guide' | 'hotel' | 'rental';
    }
  }

  const { error } = await supabase.from('listings').insert({
    partner_id: ownerId,
    type: resolvedType,
    title: listing.title,
    description: listing.description || '',
    price: listing.price,
    images: listing.images || [],
    is_active: listing.isActive,
    details: listing.details || {},
    location: listing.location || listing.details?.location || listing.details?.address || '',
  });
  if (error) throw error;
}

async function ensurePartnerCanManageListings(
  userId: string,
  role: 'guide' | 'hotel' | 'rental'
) {
  const { data: user } = await supabase.auth.getUser();
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile) {
    const { error } = await supabase.from('users').insert({
      id: userId,
      email: user.user?.email || null,
      name:
        user.user?.user_metadata?.full_name ||
        user.user?.user_metadata?.name ||
        user.user?.email?.split('@')[0] ||
        'Partner',
      phone: user.user?.phone || null,
      role,
      is_onboarded: true,
      is_approved: false,
      has_uploaded_docs: false,
      profile_data: {},
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return;
  }

  if (!['guide', 'hotel', 'rental'].includes(profile.role)) {
    const { error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  }
}

export async function updateListing(id: string, listing: Partial<Listing>) {
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if ('title' in listing) row.title = listing.title;
  if ('description' in listing) row.description = listing.description;
  if ('price' in listing) row.price = listing.price;
  if ('images' in listing) row.images = listing.images;
  if ('isActive' in listing) row.is_active = listing.isActive;
  if ('details' in listing) row.details = listing.details;
  if ('location' in listing) row.location = listing.location;
  const { error } = await supabase.from('listings').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteListing(id: string) {
  const { error } = await supabase.from('listings').delete().eq('id', id);
  if (error) throw error;
}

export function computeEarnings(bookings: Booking[]) {
  const completedBookings = bookings.filter((booking) => booking.status === 'completed');
  const confirmedBookings = bookings.filter((booking) => booking.status === 'confirmed');
  const pendingBookings = bookings.filter((booking) => booking.status === 'pending');
  const total = completedBookings.reduce((sum, booking) => sum + booking.price, 0);
  return {
    total,
    thisMonth: total,
    totalBookings: bookings.length,
    confirmedBookings: confirmedBookings.length,
    pendingBookings: pendingBookings.length,
    confirmed: confirmedBookings.length,
    pending: pendingBookings.length,
    completed: completedBookings.length,
  };
}
