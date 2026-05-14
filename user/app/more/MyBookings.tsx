import { Text } from '../../components/Text';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';

async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const result = await supabase.functions.invoke(name, { body: body as any });
  if (result.error) {
    let message = result.error.message || `${name} failed.`;
    const context = (result.error as any).context;
    if (context && typeof context.json === 'function') {
      try {
        const payload = await context.json();
        message = payload?.error || payload?.message || message;
      } catch { }
    }
    throw new Error(message);
  }
  if (!result.data) throw new Error(`${name} returned empty response.`);
  return result.data as T;
}

// ─── Color Palette ─────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#16A34A', // Vibrant green
  teal: '#14B8A6',
  skyBlue: '#0EA5E9',
  orange: '#F97316',
  white: '#FFFFFF',
  lightGray: '#F8FAFC', // Softer background
  darkGray: '#0F172A',  // Deeper text
  mediumGray: '#64748B', // Slate gray
  borderGray: '#E2E8F0', // Subtle border
  danger: '#EF4444',
};

const SHADOWS = {
  small: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────────
type TabType = 'Upcoming' | 'Completed' | 'Cancelled';
type StatusType = 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
type VehicleType = 'Scooty' | 'Bike' | 'Car';

interface Booking {
  id: string;
  vehicleName: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  vehicleImage?: string | null;
  date: string;
  time: string;
  duration: string;
  pickup: string;
  totalAmount: number;
  status: StatusType;
  tab: TabType;
  item_id?: string;
  pre_payment_status?: string | null; // guide-first flow states
  booking_type?: string;
  _createdAt?: number;
}

// ─── Mock Data Removed ─────────────────────────────────────────────────────────
const FILTER_TABS: TabType[] = ['Upcoming', 'Completed', 'Cancelled'];

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<StatusType, { color: string; bg: string }> = {
  Confirmed: { color: COLORS.primary, bg: '#DCFCE7' },
  Pending: { color: COLORS.orange, bg: '#FFF7ED' },
  Completed: { color: COLORS.skyBlue, bg: '#E0F2FE' },
  Cancelled: { color: COLORS.danger, bg: '#FEE2E2' },
};

// Guide-first booking sub-state display config
const PRE_PAYMENT_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  awaiting_guide: { color: COLORS.orange, bg: '#FFF7ED', label: '🔍 Finding Guide…' },
  awaiting_payment: { color: COLORS.teal, bg: '#F0FDFA', label: '✅ Guide Accepted – Pay Now' },
  confirmed: { color: COLORS.primary, bg: '#DCFCE7', label: '✔ Confirmed' },
};

// ─── Vehicle Icon ──────────────────────────────────────────────────────────────
const VehicleIcon = ({
  type,
  size = 28,
  color = COLORS.mediumGray,
}: {
  type: VehicleType;
  size?: number;
  color?: string;
}) => {
  if (type === 'Bike' || type === 'Scooty') {
    return <MaterialCommunityIcons name="motorbike" size={size} color={color} />;
  }
  return <Ionicons name="car-outline" size={size} color={color} />;
};

// ─── Bottom Tab Bar ────────────────────────────────────────────────────────────
const TAB_ITEMS = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'explore', label: 'Explore', icon: 'compass-outline' },
  { key: 'bookings', label: 'Bookings', icon: 'calendar-outline' },
  { key: 'chat', label: 'Chat', icon: 'chatbubble-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
] as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BottomTabBar = ({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (key: string) => void;
}) => (
  <View style={styles.tabBar}>
    {TAB_ITEMS.map((tab) => {
      const isActive = active === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          style={styles.tabItem}
          onPress={() => onSelect(tab.key)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={tab.icon}
            size={22}
            color={isActive ? COLORS.primary : COLORS.mediumGray}
          />
          <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
            {tab.label}
          </Text>
          {isActive && <View style={styles.tabActiveBar} />}
        </TouchableOpacity>
      );
    })}
  </View>
);

// ─── Booking Card ──────────────────────────────────────────────────────────────
const BookingCard = ({ booking, onCancel }: { booking: Booking; onCancel?: (id: string) => void }) => {
  const status = STATUS_CONFIG[booking.status];
  const isUpcoming = booking.tab === 'Upcoming';
  const isCancelled = booking.tab === 'Cancelled';
  const isCompleted = booking.tab === 'Completed';

  let prePayStatus = booking.pre_payment_status;
  // Hide finding guide state for hotel or vehicle/rental bookings
  if ((booking.booking_type === 'hotel' || booking.booking_type === 'vehicle' || booking.booking_type === 'rental') && prePayStatus === 'awaiting_guide') {
    prePayStatus = null;
  }

  const isAwaitingGuide = prePayStatus === 'awaiting_guide';
  const isAwaitingPayment = prePayStatus === 'awaiting_payment';

  const prePayConfig = prePayStatus ? PRE_PAYMENT_CONFIG[prePayStatus] : null;

  return (
    <View style={styles.bookingCard}>

      {/* Guide-first status banner */}
      {prePayConfig && (
        <View style={[styles.prePayBanner, { backgroundColor: prePayConfig.bg }]}>
          <Text style={[styles.prePayBannerText, { color: prePayConfig.color }]}>
            {prePayConfig.label}
          </Text>
        </View>
      )}

      {/* ── Card Header ── */}
      <View style={styles.cardHeader}>
        {/* Vehicle Image */}
        {booking.vehicleImage ? (
          <ExpoImage
            source={{ uri: booking.vehicleImage }}
            style={styles.vehicleImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.vehicleImagePlaceholder}>
            <VehicleIcon type={booking.vehicleType} size={30} color={COLORS.mediumGray} />
          </View>
        )}

        {/* Info */}
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.vehicleName} numberOfLines={1}>
            {booking.vehicleName}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="credit-card" size={11} color={COLORS.mediumGray} />
            <Text style={styles.metaText}>{booking.vehicleNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <ExpoImage source={require('../../assets/svg/calender-svgrepo-com.svg')} style={{ width: 14, height: 14, tintColor: COLORS.mediumGray }} />
            <Text style={styles.metaText}>{booking.date}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="clock" size={11} color={COLORS.mediumGray} />
            <Text style={styles.metaText}>{booking.time} · {booking.duration}</Text>
          </View>
        </View>

        {/* Status Badge */}
        {!prePayConfig && (
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {booking.status}
            </Text>
          </View>
        )}
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Trip Details ── */}
      <View style={styles.tripDetailsRow}>
        <View style={styles.tripDetailItem}>
          <Text style={styles.tripDetailLabel}>PICKUP</Text>
          <View style={styles.tripDetailValueRow}>
            <ExpoImage source={require('../../assets/svg/location-pin-svgrepo-com.svg')} style={{ width: 16, height: 16, tintColor: COLORS.primary }} />
            <Text style={styles.tripDetailValue} numberOfLines={1}>
              {booking.pickup}
            </Text>
          </View>
        </View>
        <View style={styles.tripDetailDivider} />
        <View style={styles.tripDetailItem}>
          <Text style={styles.tripDetailLabel}>TOTAL</Text>
          <Text style={[styles.tripDetailValue, { color: COLORS.primary, fontSize: 16 }]}>
            ₹{booking.totalAmount.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Action Buttons ── */}
      <View style={styles.actionRow}>
        {/* Guide-first: Awaiting guide */}
        {isAwaitingGuide && (
          <>
            <View style={[styles.guideStatusBox, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10, gap: 8 }]}>
              <ActivityIndicator size="small" color={COLORS.orange} />
              <Text style={[styles.guideStatusText, { color: COLORS.orange, fontSize: 13, fontWeight: '700' }]}>
                Finding guide…
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dangerBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (onCancel) {
                  Alert.alert(
                    'Cancel Request',
                    'Are you sure you want to cancel this booking request?',
                    [
                      { text: 'No', style: 'cancel' },
                      { text: 'Yes, Cancel', style: 'destructive', onPress: () => onCancel(booking.id) },
                    ]
                  );
                }
              }}
            >
              <Text style={styles.dangerBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {/* Guide-first: Pay Now */}
        {isAwaitingPayment && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.teal, shadowColor: COLORS.teal }]}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: '/more/payment',
                params: {
                  bookingId: booking.id,
                  amount: String(booking.totalAmount),
                  description: booking.vehicleName,
                },
              })
            }
          >
            <Ionicons name="card" size={16} color={COLORS.white} />
            <Text style={styles.primaryBtnText}>Pay Now ₹{booking.totalAmount.toLocaleString()}</Text>
          </TouchableOpacity>
        )}
        {/* Normal upcoming actions */}
        {isUpcoming && !isAwaitingGuide && !isAwaitingPayment && booking.status === 'Confirmed' && (
          <>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/more/bookingDetail', params: { id: booking.id } })}
            >
              <Text style={styles.secondaryBtnText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85}>
              <Ionicons name="navigate-outline" size={14} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Get Directions</Text>
            </TouchableOpacity>
          </>
        )}
        {isUpcoming && !isAwaitingGuide && !isAwaitingPayment && booking.status === 'Pending' && (
          <>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/more/bookingDetail', params: { id: booking.id } })}
            >
              <Text style={styles.secondaryBtnText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (onCancel) {
                  Alert.alert(
                    'Cancel Booking',
                    'Are you sure you want to cancel this booking?',
                    [
                      { text: 'No', style: 'cancel' },
                      { text: 'Yes, Cancel', style: 'destructive', onPress: () => onCancel(booking.id) }
                    ]
                  );
                }
              }}
            >
              <Text style={styles.dangerBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {isCompleted && (
          <>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/more/bookingDetail', params: { id: booking.id } })}
            >
              <Text style={styles.secondaryBtnText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tealBtn}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/more/RateAndReview', params: { bookingId: booking.id, itemId: booking.item_id } })}
            >
              <Ionicons name="star-outline" size={14} color={COLORS.white} />
              <Text style={styles.tealBtnText}>Rate & Review</Text>
            </TouchableOpacity>
          </>
        )}
        {isCancelled && (
          <>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/more/bookingDetail', params: { id: booking.id } })}
            >
              <Text style={styles.secondaryBtnText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85}>
              <Ionicons name="refresh-outline" size={14} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Rebook</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ tab }: { tab: TabType }) => {
  const icon =
    tab === 'Upcoming' ? 'calendar-outline' :
      tab === 'Completed' ? 'checkmark-circle-outline' :
        'close-circle-outline';
  const iconColor =
    tab === 'Upcoming' ? COLORS.primary :
      tab === 'Completed' ? COLORS.skyBlue :
        COLORS.danger;
  const iconBg =
    tab === 'Upcoming' ? '#DCFCE7' :
      tab === 'Completed' ? '#E0F2FE' :
        '#FEE2E2';
  const subtitle =
    tab === 'Upcoming'
      ? 'Plan your next adventure and book a vehicle!'
      : tab === 'Completed'
        ? 'Your completed trips will appear here.'
        : 'Any cancelled bookings will appear here.';

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={44} color={iconColor} />
      </View>
      <Text style={styles.emptyTitle}>No {tab} Bookings</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {tab === 'Upcoming' && (
        <TouchableOpacity
          style={styles.emptyBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/Home')}
        >
          <Text style={styles.emptyBtnText}>Rent a Vehicle</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function MyBookingsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('Upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchBookings = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookings:', error.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const now = new Date().getTime();
      const THIRTY_MINS = 30 * 60 * 1000;

      const fetchedBookings: Booking[] = await Promise.all((data || []).map(async (row) => {
        let status: StatusType = 'Pending';
        let rawStatus = (row.status || '').toLowerCase();
        let prePayStatus = row.pre_payment_status || null;

        // Auto-expire unaccepted requests after 30 mins (only for guides)
        if (row.booking_type === 'guide' && rawStatus === 'pending' && prePayStatus === 'awaiting_guide' && row.created_at) {
          const createdAtTime = new Date(row.created_at).getTime();
          if (now - createdAtTime > THIRTY_MINS) {
            // Expire it in the database
            await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', row.id);
            rawStatus = 'cancelled';
          }
        }

        if (rawStatus === 'confirmed') status = 'Confirmed';
        else if (rawStatus === 'completed') status = 'Completed';
        else if (rawStatus === 'cancelled' || rawStatus === 'rejected') status = 'Cancelled';

        let tab: TabType = 'Upcoming';
        if (status === 'Completed') tab = 'Completed';
        else if (status === 'Cancelled') tab = 'Cancelled';

        let dateStr = 'Unknown Date';
        let timeStr = 'Unknown Time';
        if (row.created_at) {
          const dateObj = new Date(row.created_at);
          dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }

        // Fetch image: guide avatar from users table, vehicle image from rental_listings
        let vehicleImage: string | null = null;
        if (row.booking_type === 'guide' && row.item_id) {
          // item_id for guide bookings is the guide's user ID
          const { data: guideUser } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', row.item_id)
            .maybeSingle();
          vehicleImage = guideUser?.avatar_url ?? null;
        } else if (row.item_id) {
          // Vehicle / hotel booking – look up rental_listings
          const { data: listing } = await supabase
            .from('rental_listings')
            .select('images')
            .eq('id', row.item_id)
            .maybeSingle();
          if (listing?.images && Array.isArray(listing.images) && listing.images.length > 0) {
            vehicleImage = listing.images[0];
          }
        }

        return {
          id: row.id,
          vehicleName: row.item_name || 'Unknown Booking',
          vehicleNumber: row.vehicle_number || 'N/A',
          vehicleType: row.vehicle_type || (row.booking_type === 'vehicle' ? 'Bike' : 'Car'),
          vehicleImage,
          date: dateStr,
          time: timeStr,
          duration: row.days ? `${row.days} Days` : 'N/A',
          pickup: row.pickup_location || row.city || 'Not specified',
          totalAmount: row.amount || row.price || 0,
          status,
          tab,
          item_id: row.item_id,
          pre_payment_status: row.pre_payment_status || null,
          booking_type: row.booking_type || null,
          _createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
        };
      }));

      setBookings(fetchedBookings);
      setLoading(false);
      setRefreshing(false);
    };

    fetchBookings();
  }, [user, refreshKey]);

  const onRefresh = () => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await invokeFunction('cancel-booking', { bookingId });

      Alert.alert('Success', 'Booking cancelled successfully');
      onRefresh();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to cancel booking');
    }
  };

  const filtered = bookings.filter((b) => b.tab === activeTab);

  const groupedUpcoming = filtered.reduce((acc, booking) => {
    const existingSection = acc.find(s => s.sectionTitle === booking.date);
    if (existingSection) {
      existingSection.data.push(booking);
    } else {
      acc.push({ sectionTitle: booking.date, data: [booking] });
    }
    return acc;
  }, [] as { sectionTitle: string; data: Booking[] }[]);

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.darkGray} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Filter Tabs ── */}
      <View style={styles.filterTabsWrapper}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const count = bookings.filter((b) => b.tab === tab).length;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {tab}
              </Text>
              {count > 0 && (
                <View style={[styles.filterTabCount, isActive && styles.filterTabCountActive]}>
                  <Text style={[styles.filterTabCountText, isActive && styles.filterTabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor='#16A34A'
              colors={['#16A34A']}
            />
          }
        >
          {activeTab === 'Upcoming' ? (
            groupedUpcoming.map((section) => (
              <View key={section.sectionTitle}>
                <Text style={styles.sectionDate}>{section.sectionTitle}</Text>
                {section.data.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} onCancel={handleCancelBooking} />
                ))}
              </View>
            ))
          ) : (
            filtered.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onCancel={handleCancelBooking} />
            ))
          )}

          {/* ── Need Help Banner ── */}
          <TouchableOpacity
            style={styles.helpBanner}
            activeOpacity={0.9}
            onPress={() => router.push('/extra/HelpSupport')}
          >
            <View style={styles.helpIconBox}>
              <Ionicons name="headset-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.helpTextBox}>
              <Text style={styles.helpTitle}>Need Help?</Text>
              <Text style={styles.helpSubtitle}>Trip Support · We're here 24/7</Text>
            </View>
            <View style={styles.helpCallBtn}>
              <ExpoImage source={require('../../assets/svg/phone-call-svgrepo-com.svg')} style={{ width: 22, height: 22, tintColor: COLORS.white }} />
            </View>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkGray,
    letterSpacing: -0.3,
  },
  filterIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter Tabs
  filterTabsWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: COLORS.lightGray,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.mediumGray,
  },
  filterTabTextActive: {
    color: COLORS.white,
  },
  filterTabCount: {
    backgroundColor: COLORS.borderGray,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  filterTabCountActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterTabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.mediumGray,
  },
  filterTabCountTextActive: {
    color: COLORS.white,
  },

  // Scroll
  scroll: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },

  // Section Date
  sectionDate: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.mediumGray,
    marginBottom: 10,
    marginLeft: 2,
    letterSpacing: 0.2,
  },

  // Booking Card
  bookingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  prePayBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  prePayBannerText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    gap: 14,
  },
  vehicleImage: {
    width: 68,
    height: 68,
    borderRadius: 16,
    flexShrink: 0,
    backgroundColor: COLORS.lightGray,
    ...SHADOWS.small,
  },
  vehicleImagePlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 4,
    ...SHADOWS.small,
  },
  imagePlaceholderLabel: {
    fontSize: 9,
    color: COLORS.mediumGray,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 5,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkGray,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.borderGray,
    marginHorizontal: 16,
  },

  // Trip Details
  tripDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tripDetailItem: {
    flex: 1,
    gap: 6,
  },
  tripDetailDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.borderGray,
    marginHorizontal: 16,
  },
  tripDetailLabel: {
    fontSize: 10,
    color: COLORS.mediumGray,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tripDetailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkGray,
    flex: 1,
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.lightGray,
  },
  guideStatusBox: {
    borderWidth: 1,
  },
  guideStatusText: {
    color: COLORS.orange,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    backgroundColor: COLORS.white,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  dangerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  dangerBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
  tealBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.teal,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  tealBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Help Banner
  helpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
    ...SHADOWS.medium,
  },
  helpIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTextBox: {
    flex: 1,
    gap: 3,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  helpSubtitle: {
    fontSize: 12,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  helpCallBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
    backgroundColor: COLORS.lightGray,
  },
  emptyIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkGray,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGray,
    paddingBottom: 10,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 4,
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.mediumGray,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabActiveBar: {
    position: 'absolute',
    bottom: -8,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
});
