import { Text } from '../../components/Text';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScrollView,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Invoke Helper ─────────────────────────────────────────────────────────────
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
  primary: '#16A34A',
  primaryLight: '#DCFCE7',
  primarySurface: '#F0FDF4',
  teal: '#14B8A6',
  tealLight: '#F0FDFA',
  skyBlue: '#0EA5E9',
  skyBlueLight: '#E0F2FE',
  orange: '#F97316',
  orangeLight: '#FFF7ED',
  orangeBorder: '#FED7AA',
  white: '#FFFFFF',
  background: '#F8FAFC',
  darkGray: '#0F172A',
  mediumGray: '#64748B',
  borderGray: '#E2E8F0',
  surfaceGray: '#F1F5F9',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  dangerBorder: '#FECACA',
  dangerSurface: '#FEF2F2',
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
type BookingType = 'guide' | 'hotel' | 'vehicle' | 'rental' | string;

interface Booking {
  id: string;
  vehicleName: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  listingImage?: string | null;
  date: string;
  time: string;
  duration: string;
  pickup: string;
  totalAmount: number;
  status: StatusType;
  tab: TabType;
  item_id?: string;
  pre_payment_status?: string | null;
  booking_type?: BookingType;
  _createdAt?: number;
}

// ─── Centralized Configs ───────────────────────────────────────────────────────
const FILTER_TABS: TabType[] = ['Upcoming', 'Completed', 'Cancelled'];

const STATUS_CONFIG: Record<StatusType, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Confirmed: { color: COLORS.primary, bg: COLORS.primaryLight, icon: 'checkmark-circle' },
  Pending: { color: COLORS.orange, bg: COLORS.orangeLight, icon: 'time-outline' },
  Completed: { color: COLORS.skyBlue, bg: COLORS.skyBlueLight, icon: 'checkbox-outline' },
  Cancelled: { color: COLORS.danger, bg: COLORS.dangerLight, icon: 'close-circle-outline' },
};

const PRE_PAYMENT_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  awaiting_guide: { color: COLORS.orange, bg: COLORS.orangeLight, label: '🔍 Finding Guide…' },
  awaiting_owner: { color: COLORS.orange, bg: COLORS.orangeLight, label: '⏳ Awaiting Owner Confirmation…' },
  awaiting_payment: { color: COLORS.teal, bg: COLORS.tealLight, label: '✅ Accepted – Pay Now' },
  confirmed: { color: COLORS.primary, bg: COLORS.primaryLight, label: '✔ Confirmed' },
};

// Booking type → icon config
const BOOKING_TYPE_ICONS: Record<string, { library: 'ionicons' | 'mci'; name: string }> = {
  guide: { library: 'ionicons', name: 'person-outline' },
  hotel: { library: 'ionicons', name: 'business-outline' },
};

const VEHICLE_TYPE_ICONS: Record<string, { library: 'ionicons' | 'mci'; name: string }> = {
  Bike: { library: 'mci', name: 'motorbike' },
  Scooty: { library: 'mci', name: 'motorbike' },
  Car: { library: 'ionicons', name: 'car-outline' },
};

// Tab empty state config
const EMPTY_STATE_CONFIG: Record<TabType, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  subtitle: string;
  ctaLabel?: string;
  ctaRoute?: string;
}> = {
  Upcoming: {
    icon: 'calendar-outline',
    color: COLORS.primary,
    bg: COLORS.primaryLight,
    subtitle: 'Plan your next adventure and book a vehicle!',
    ctaLabel: 'Browse Listings',
    ctaRoute: '/(tabs)/Home',
  },
  Completed: {
    icon: 'checkmark-circle-outline',
    color: COLORS.skyBlue,
    bg: COLORS.skyBlueLight,
    subtitle: 'Your completed trips will appear here.',
    ctaLabel: 'Book a Trip',
    ctaRoute: '/(tabs)/Home',
  },
  Cancelled: {
    icon: 'close-circle-outline',
    color: COLORS.danger,
    bg: COLORS.dangerLight,
    subtitle: 'Any cancelled bookings will appear here.',
  },
};

// Pre-payment states that should be hidden for non-guide bookings
const HIDE_AWAITING_GUIDE_TYPES: BookingType[] = ['hotel', 'vehicle', 'rental'];

// ─── Animated Card Wrapper ─────────────────────────────────────────────────────
const AnimatedCard = ({ children, index }: { children: React.ReactNode; index: number }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const delay = Math.min(index * 80, 400);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
};

// ─── Listing Icon ──────────────────────────────────────────────────────────────
const ListingIcon = ({
  type,
  bookingType,
  size = 28,
  color = COLORS.mediumGray,
}: {
  type: VehicleType;
  bookingType?: BookingType | null;
  size?: number;
  color?: string;
}) => {
  // Check booking type first
  if (bookingType && BOOKING_TYPE_ICONS[bookingType]) {
    const cfg = BOOKING_TYPE_ICONS[bookingType];
    if (cfg.library === 'mci') {
      return <MaterialCommunityIcons name={cfg.name as any} size={size} color={color} />;
    }
    return <Ionicons name={cfg.name as any} size={size} color={color} />;
  }

  // Fallback to vehicle type
  const vehicleCfg = VEHICLE_TYPE_ICONS[type] || VEHICLE_TYPE_ICONS.Car;
  if (vehicleCfg.library === 'mci') {
    return <MaterialCommunityIcons name={vehicleCfg.name as any} size={size} color={color} />;
  }
  return <Ionicons name={vehicleCfg.name as any} size={size} color={color} />;
};

// ─── Action Button Helpers ─────────────────────────────────────────────────────
const ViewDetailsButton = ({ bookingId }: { bookingId: string }) => (
  <TouchableOpacity
    style={styles.secondaryBtn}
    activeOpacity={0.8}
    onPress={() => router.push({ pathname: '/more/bookingDetail', params: { id: bookingId } })}
  >
    <Feather name="file-text" size={14} color={COLORS.darkGray} />
    <Text style={styles.secondaryBtnText}>View Details</Text>
  </TouchableOpacity>
);

const CancelButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={styles.dangerBtn} activeOpacity={0.85} onPress={onPress}>
    <Ionicons name="close-circle-outline" size={14} color={COLORS.danger} />
    <Text style={styles.dangerBtnText}>Cancel</Text>
  </TouchableOpacity>
);

// ─── Booking Card ──────────────────────────────────────────────────────────────
const BookingCard = ({ booking, onCancel }: { booking: Booking; onCancel?: (id: string) => void }) => {
  const status = STATUS_CONFIG[booking.status];
  const isUpcoming = booking.tab === 'Upcoming';
  const isCancelled = booking.tab === 'Cancelled';
  const isCompleted = booking.tab === 'Completed';

  // Determine effective pre-payment status
  let prePayStatus = booking.pre_payment_status;
  if (
    booking.booking_type &&
    HIDE_AWAITING_GUIDE_TYPES.includes(booking.booking_type) &&
    prePayStatus === 'awaiting_guide'
  ) {
    prePayStatus = null;
  }

  const isAwaitingGuide = prePayStatus === 'awaiting_guide';
  const isAwaitingOwner = prePayStatus === 'awaiting_owner';
  const isAwaitingPayment = prePayStatus === 'awaiting_payment';
  const prePayConfig = prePayStatus ? PRE_PAYMENT_CONFIG[prePayStatus] : null;

  const confirmCancel = useCallback(
    (title: string, message: string) => {
      if (!onCancel) return;
      Alert.alert(title, message, [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => onCancel(booking.id) },
      ]);
    },
    [onCancel, booking.id]
  );

  const handleDirections = useCallback(() => {
    if (booking.pickup && booking.pickup !== 'Not specified') {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.pickup)}`
      );
    }
  }, [booking.pickup]);

  const handleRebook = useCallback(() => {
    if (booking.booking_type === 'hotel' || booking.booking_type === 'guide') {
      router.push('/(tabs)/Home');
    } else {
      router.push('/more/vehicle');
    }
  }, [booking.booking_type]);

  // ── Render Actions based on state ──
  const renderActions = () => {
    // Guide-first: Awaiting guide
    if (isAwaitingGuide || isAwaitingOwner) {
      return (
        <>
          <View style={styles.guideStatusBox}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={styles.guideStatusText}>
              {isAwaitingOwner ? 'Waiting for owner confirmation…' : 'Finding guide…'}
            </Text>
          </View>
          <CancelButton
            onPress={() => confirmCancel('Cancel Request', 'Are you sure you want to cancel this booking request?')}
          />
        </>
      );
    }

    // Guide-first: Pay Now
    if (isAwaitingPayment) {
      return (
        <TouchableOpacity
          style={styles.tealBtn}
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
          <Text style={styles.tealBtnText}>Pay Now ₹{booking.totalAmount.toLocaleString()}</Text>
        </TouchableOpacity>
      );
    }

    // Normal Upcoming – Confirmed
    if (isUpcoming && booking.status === 'Confirmed') {
      return (
        <>
          <ViewDetailsButton bookingId={booking.id} />
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleDirections}>
            <Ionicons name="navigate-outline" size={14} color={COLORS.white} />
            <Text style={styles.primaryBtnText}>Get Directions</Text>
          </TouchableOpacity>
        </>
      );
    }

    // Normal Upcoming – Pending
    if (isUpcoming && booking.status === 'Pending') {
      return (
        <>
          <ViewDetailsButton bookingId={booking.id} />
          <CancelButton
            onPress={() => confirmCancel('Cancel Booking', 'Are you sure you want to cancel this booking?')}
          />
        </>
      );
    }

    // Completed
    if (isCompleted) {
      return (
        <>
          <ViewDetailsButton bookingId={booking.id} />
          <TouchableOpacity
            style={styles.tealBtn}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: '/more/RateAndReview',
                params: { bookingId: booking.id, itemId: booking.item_id },
              })
            }
          >
            <Ionicons name="star-outline" size={14} color={COLORS.white} />
            <Text style={styles.tealBtnText}>Rate & Review</Text>
          </TouchableOpacity>
        </>
      );
    }

    // Cancelled
    if (isCancelled) {
      return (
        <>
          <ViewDetailsButton bookingId={booking.id} />
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleRebook}>
            <Ionicons name="refresh-outline" size={14} color={COLORS.white} />
            <Text style={styles.primaryBtnText}>Rebook</Text>
          </TouchableOpacity>
        </>
      );
    }

    return null;
  };

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
        {/* Listing Image */}
        {booking.listingImage ? (
          <ExpoImage
            source={{ uri: booking.listingImage }}
            style={styles.vehicleImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.vehicleImagePlaceholder}>
            <ListingIcon
              type={booking.vehicleType}
              bookingType={booking.booking_type}
              size={30}
              color={COLORS.mediumGray}
            />
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
            <Ionicons name="calendar-outline" size={14} color={COLORS.mediumGray} />
            <Text style={styles.metaText}>{booking.date}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="clock" size={11} color={COLORS.mediumGray} />
            <Text style={styles.metaText}>
              {booking.time} · {booking.duration}
            </Text>
          </View>
        </View>

        {/* Status Badge (hidden when pre-pay banner shows) */}
        {!prePayConfig && (
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon} size={12} color={status.color} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: status.color }]}>{booking.status}</Text>
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
            <Ionicons name="location" size={16} color={COLORS.primary} />
            <Text style={styles.tripDetailValue} numberOfLines={1}>
              {booking.pickup}
            </Text>
          </View>
        </View>
        <View style={styles.tripDetailDivider} />
        <View style={styles.tripDetailItem}>
          <Text style={styles.tripDetailLabel}>TOTAL</Text>
          <Text style={[styles.tripDetailValue, styles.totalAmountText]}>
            ₹{booking.totalAmount.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Action Buttons ── */}
      <View style={styles.actionRow}>{renderActions()}</View>
    </View>
  );
};

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ tab }: { tab: TabType }) => {
  const config = EMPTY_STATE_CONFIG[tab];

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconBox, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon} size={44} color={config.color} />
      </View>
      <Text style={styles.emptyTitle}>No {tab} Bookings</Text>
      <Text style={styles.emptySubtitle}>{config.subtitle}</Text>
      {config.ctaLabel && config.ctaRoute && (
        <TouchableOpacity
          style={[styles.emptyBtn, { backgroundColor: config.color }]}
          activeOpacity={0.85}
          onPress={() => router.push(config.ctaRoute as any)}
        >
          <Text style={styles.emptyBtnText}>{config.ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Summary Bar ───────────────────────────────────────────────────────────────
const SummaryBar = ({ bookings }: { bookings: Booking[] }) => {
  const counts = FILTER_TABS.reduce(
    (acc, tab) => {
      acc[tab] = bookings.filter((b) => b.tab === tab).length;
      return acc;
    },
    {} as Record<TabType, number>
  );

  const total = bookings.length;
  if (total === 0) return null;

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryCount}>{total}</Text>
        <Text style={styles.summaryLabel}>Total</Text>
      </View>
      {FILTER_TABS.map((tab) => {
        const cfg = STATUS_CONFIG[tab === 'Upcoming' ? 'Confirmed' : tab === 'Completed' ? 'Completed' : 'Cancelled'];
        return (
          <View key={tab} style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: cfg.color }]}>{counts[tab]}</Text>
            <Text style={styles.summaryLabel}>{tab}</Text>
          </View>
        );
      })}
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

  // Animated underline for tabs
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const toIndex = FILTER_TABS.indexOf(activeTab);
    Animated.spring(tabIndicatorAnim, {
      toValue: toIndex,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [activeTab, tabIndicatorAnim]);

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

      const rows = data || [];

      // Batch fetch all unique listing IDs and guide IDs (fix N+1)
      const listingIds = [
        ...new Set(rows.filter((r) => r.booking_type !== 'guide' && r.item_id).map((r) => r.item_id)),
      ];
      const guideIds = [
        ...new Set(
          rows
            .filter((r) => r.booking_type === 'guide')
            .map((r) => r.partner_id || r.item_id)
            .filter(Boolean)
        ),
      ];

      // Batch fetch listing images
      const listingImageMap: Record<string, string | null> = {};
      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from('listings')
          .select('id, images')
          .in('id', listingIds);
        (listings || []).forEach((l) => {
          listingImageMap[l.id] =
            l.images && Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null;
        });
      }

      // Batch fetch guide avatars
      const guideImageMap: Record<string, string | null> = {};
      if (guideIds.length > 0) {
        const { data: guides } = await supabase
          .from('users')
          .select('id, photo_url, profile_data')
          .in('id', guideIds);
        (guides || []).forEach((g) => {
          const pd = g.profile_data || {};
          guideImageMap[g.id] = g.photo_url || pd.profileImage || pd.profile_image || null;
        });
      }

      const fetchedBookings: Booking[] = rows.map((row) => {
        let status: StatusType = 'Pending';
        const rawStatus = (row.status || '').toLowerCase();

        if (rawStatus === 'confirmed') status = 'Confirmed';
        else if (rawStatus === 'completed') status = 'Completed';
        else if (rawStatus === 'cancelled' || rawStatus === 'rejected') status = 'Cancelled';

        let tab: TabType = 'Upcoming';
        if (status === 'Completed') tab = 'Completed';
        else if (status === 'Cancelled') tab = 'Cancelled';

        // Use the booking date (not created_at) for display
        let dateStr = 'Unknown Date';
        let timeStr = 'Unknown Time';
        const displayDate = row.date || row.created_at;
        if (displayDate) {
          const dateObj = new Date(displayDate);
          dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }

        // Look up images from pre-fetched maps
        let listingImage: string | null = null;
        if (row.booking_type === 'guide') {
          const targetGuideId = row.partner_id || row.item_id;
          if (targetGuideId) listingImage = guideImageMap[targetGuideId] || null;
        } else if (row.item_id) {
          listingImage = listingImageMap[row.item_id] || null;
        }

        return {
          id: row.id,
          vehicleName: row.item_name || 'Unknown Booking',
          vehicleNumber: row.vehicle_number || 'N/A',
          vehicleType: row.vehicle_type || (row.booking_type === 'vehicle' ? 'Bike' : 'Car'),
          listingImage,
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
      });

      setBookings(fetchedBookings);
      setLoading(false);
      setRefreshing(false);
    };

    fetchBookings();
  }, [user, refreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleCancelBooking = useCallback(async (bookingId: string) => {
    try {
      await invokeFunction('cancel-booking', { bookingId });
      Alert.alert('Success', 'Booking cancelled successfully');
      setRefreshing(true);
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to cancel booking');
    }
  }, []);

  const filtered = bookings.filter((b) => b.tab === activeTab);

  // Group by date for section headers
  const grouped = filtered.reduce(
    (acc, booking) => {
      const section = acc.find((s) => s.sectionTitle === booking.date);
      if (section) {
        section.data.push(booking);
      } else {
        acc.push({ sectionTitle: booking.date, data: [booking] });
      }
      return acc;
    },
    [] as { sectionTitle: string; data: Booking[] }[]
  );

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.darkGray} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Summary Bar ── */}
      {!loading && <SummaryBar bookings={bookings} />}

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
                  <Text
                    style={[styles.filterTabCountText, isActive && styles.filterTabCountTextActive]}
                  >
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading bookings…</Text>
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
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          {grouped.map((section, sectionIndex) => (
            <View key={section.sectionTitle}>
              <View style={styles.sectionDateRow}>
                <View style={styles.sectionDateDot} />
                <Text style={styles.sectionDate}>{section.sectionTitle}</Text>
                <Text style={styles.sectionCount}>
                  {section.data.length} {section.data.length === 1 ? 'booking' : 'bookings'}
                </Text>
              </View>
              {section.data.map((booking, cardIndex) => (
                <AnimatedCard
                  key={booking.id}
                  index={sectionIndex * section.data.length + cardIndex}
                >
                  <BookingCard booking={booking} onCancel={handleCancelBooking} />
                </AnimatedCard>
              ))}
            </View>
          ))}

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
              <Ionicons name="call" size={20} color={COLORS.white} />
            </View>
          </TouchableOpacity>

          <View style={styles.scrollBottomSpacer} />
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
    backgroundColor: COLORS.background,
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
  headerSpacer: {
    width: 36,
  },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkGray,
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.mediumGray,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    backgroundColor: COLORS.background,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.mediumGray,
  },

  // Scroll
  scroll: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  scrollBottomSpacer: {
    height: 20,
  },

  // Section Date
  sectionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 2,
    gap: 8,
  },
  sectionDateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  sectionDate: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.mediumGray,
    letterSpacing: 0.2,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.mediumGray,
    marginLeft: 'auto',
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
    backgroundColor: COLORS.background,
    ...SHADOWS.small,
  },
  vehicleImagePlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 4,
    ...SHADOWS.small,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: 4,
  },
  statusIcon: {
    marginRight: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
  totalAmountText: {
    color: COLORS.primary,
    fontSize: 16,
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.background,
  },
  guideStatusBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    backgroundColor: COLORS.orangeLight,
    borderColor: COLORS.orangeBorder,
  },
  guideStatusText: {
    color: COLORS.orange,
    fontSize: 13,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    backgroundColor: COLORS.white,
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  dangerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSurface,
    gap: 6,
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
    borderColor: COLORS.surfaceGray,
    gap: 12,
    ...SHADOWS.medium,
  },
  helpIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
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
    backgroundColor: COLORS.background,
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
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
});
