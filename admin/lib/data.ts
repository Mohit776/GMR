import { supabaseAdmin } from './supabase-server';
import { User, Partner, Listing, Booking, ProgressItem, RevenueDataPoint } from './mockData';

// ─── Timestamp Helper ─────────────────────────────────────────────────────────
function formatDate(ts: string | null | undefined): string {
  if (!ts) return 'N/A';
  try {
    return new Date(ts).toISOString().split('T')[0];
  } catch {
    return 'N/A';
  }
}

function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return 'N/A';
  try {
    return new Date(ts).toISOString();
  } catch {
    return 'N/A';
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*');

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name || 'Unknown User',
      email: row.email || 'No Email',
      role: row.role || 'user',
      joinedDate: formatDate(row.created_at),
      status: row.is_approved ? 'active' : 'inactive',
      avatarInitials: row.name ? row.name.substring(0, 2).toUpperCase() : 'U',
      avatarColor: 'bg-blue-500',
    } as User));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export async function getPartners(): Promise<Partner[]> {
  try {
    // Fetch partners and their listing count in one query
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*, listings(count)')
      .in('role', ['rental', 'guide', 'hotel']);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name || 'Unknown Partner',
      businessName: row.profile_data?.shopName || row.name || 'N/A',
      location: row.profile_data?.location || 'Unknown Location',
      listings: (row.listings as any)?.[0]?.count ?? 0,
      joinedDate: formatDate(row.created_at),
      status: row.is_approved ? 'verified' : 'pending',
      avatarInitials: row.name ? row.name.substring(0, 2).toUpperCase() : 'P',
      avatarColor: 'bg-green-500',
    } as Partner));
  } catch (error) {
    console.error('Error fetching partners:', error);
    return [];
  }
}

export async function getPartnerById(id: string): Promise<Partner | null> {
  try {
    const { data: row, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !row) return null;

    return {
      id: row.id,
      name: row.name || 'Unknown Partner',
      businessName: row.profile_data?.shopName || row.name || 'N/A',
      location: row.profile_data?.location || 'Unknown Location',
      listings: 0,
      joinedDate: formatDate(row.created_at),
      status: row.is_approved ? 'verified' : 'pending',
      avatarInitials: row.name ? row.name.substring(0, 2).toUpperCase() : 'P',
      avatarColor: 'bg-green-500',
      email: row.email,
      phone: row.phone,
      profileData: row.profile_data,
      documents: row.documents || [],
      photoUrl: row.photo_url,
      kycVideoUrl: row.kyc_video_url,
    } as any;
  } catch (error) {
    console.error('Error fetching partner details:', error);
    return null;
  }
}

export async function getListings(): Promise<Listing[]> {
  try {
    // 1. Fetch listings
    const { data: listingsData, error: listingsError } = await supabaseAdmin
      .from('listings')
      .select('*, partner:users!listings_partner_id_fkey(name)');

    if (listingsError) throw listingsError;

    // 2. Fetch all reviews
    const { data: reviewsData, error: reviewsError } = await supabaseAdmin
      .from('reviews')
      .select('item_id, rating');

    if (reviewsError) {
      console.warn('Error fetching reviews:', reviewsError);
    }

    const reviews = reviewsData || [];

    return (listingsData || []).map((row) => {
      // Calculate dynamic ratings and reviews count
      const itemReviews = reviews.filter(r => r.item_id === row.id);
      const reviewsCount = itemReviews.length;
      const averageRating = reviewsCount > 0
        ? (itemReviews.reduce((sum, r) => sum + r.rating, 0) / reviewsCount).toFixed(1)
        : null;

      const baseDetails = row.details || {};

      return {
        id: row.id,
        name: row.title || 'Untitled Listing',
        partner: row.partner?.name || row.partner_id || 'Unknown Partner',
        category: row.type || 'Other',
        location: row.location || 'Unknown Location',
        price: row.price ? `₹${row.price}` : 'N/A',
        status: row.is_active ? 'active' : 'draft',
        details: {
          ...baseDetails,
          rating: averageRating || baseDetails.rating || 'No ratings',
          reviews: reviewsCount || baseDetails.reviews || 0,
        },
      } as Listing;
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    return [];
  }
}

export async function getBookings(): Promise<Booking[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*, partner:users!bookings_partner_id_fkey(name), client:users!bookings_user_id_fkey(name)');

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      client: row.client?.name || row.guest_name || row.user_name || row.user_id || 'Unknown Client',
      partner: row.partner?.name || row.partner_id || 'Unknown Partner',
      listing: row.item_name || row.listing_id || 'Unknown Listing',
      dateTime: formatDateTime(row.created_at),
      guests: row.days || 1,
      amount: row.amount || row.price ? `₹${row.amount || row.price}` : 'N/A',
      status: row.status || 'pending',
      paymentProvider: row.payment_provider,
      paymentVerifiedAt: row.payment_verified_at,
      razorpayOrderId: row.razorpay_order_id,
    } as Booking));
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
}

export async function getDashboardStats() {
  const users = await getUsers();
  const partners = await getPartners();
  const listings = await getListings();
  const bookings = await getBookings();

  const totalUsers = users.length;
  const totalPartners = partners.length;
  const verifiedPartners = partners.filter((p) => p.status === 'verified').length;
  const pendingPartners = partners.filter((p) => p.status === 'pending').length;
  const activeListings = listings.filter((l) => l.status === 'active').length;
  const pendingBookings = bookings.filter((b) => b.status === 'pending').length;

  // Revenue: sum numeric amounts (stored as '₹1234' strings) from paid bookings
  const totalRevenue = bookings
    .filter((b) => b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum, b) => {
      const amountStr = String(b.amount).replace(/[^0-9.-]+/g, '');
      return sum + (parseFloat(amountStr) || 0);
    }, 0);

  // Bookings by type
  const typeCounts: Record<string, number> = {};
  const typeColors: Record<string, string> = {
    guide: 'bg-green-500',
    vehicle: 'bg-blue-500',
    hotel: 'bg-purple-500',
    rental: 'bg-orange-500',
  };

  for (const b of bookings) {
    const rawBooking = b as any;
    const bType = rawBooking.bookingType || rawBooking.type || 'other';
    typeCounts[bType] = (typeCounts[bType] || 0) + 1;
  }

  const totalBookingsCount = bookings.length || 1;
  const bookingsByType: ProgressItem[] = Object.entries(typeCounts).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    percentage: Math.round((count / totalBookingsCount) * 100),
    color: typeColors[name] || 'bg-gray-400',
  }));

  if (bookingsByType.length === 0) {
    bookingsByType.push({ name: 'No Bookings Yet', percentage: 100, color: 'bg-gray-300' });
  }

  // Bookings by location — aggregate real city data
  const locationCounts: Record<string, number> = {};
  for (const b of bookings) {
    const rawBooking = b as any;
    const city = rawBooking.city ? String(rawBooking.city).trim() : null;
    if (city) {
      const displayCity = city.charAt(0).toUpperCase() + city.slice(1);
      locationCounts[displayCity] = (locationCounts[displayCity] || 0) + 1;
    }
  }

  const locationColors = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
  const bookingsByLocation: ProgressItem[] = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count], i) => ({
      name,
      percentage: Math.round((count / totalBookingsCount) * 100),
      color: locationColors[i % locationColors.length],
    }));

  if (bookingsByLocation.length === 0) {
    bookingsByLocation.push({ name: 'No Bookings Yet', percentage: 100, color: 'bg-gray-300' });
  }

  const recentBookings = bookings.slice(0, 5);

  return {
    stats: {
      totalUsers,
      totalPartners,
      verifiedPartners,
      pendingPartners,
      activeListings,
      pendingBookings,
      totalRevenue: `₹${totalRevenue.toLocaleString('en-IN')}`,
    },
    recentBookings,
    bookingsByType,
    bookingsByLocation,
  };
}
