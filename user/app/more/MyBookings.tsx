import { Text } from '../../components/Text';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { ScrollView,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppBar from '../../components/AppBar';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Color Palette ─────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#16A34A',
  teal: '#14B8A6',
  skyBlue: '#0EA5E9',
  orange: '#F97316',
  white: '#FFFFFF',
  lightGray: '#F1F5F9',
  darkGray: '#1F2937',
  mediumGray: '#6B7280',
  borderGray: '#d3dbe2',
  danger: '#EF4444',
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
  date: string;
  time: string;
  duration: string;
  pickup: string;
  totalAmount: number;
  status: StatusType;
  tab: TabType;
  item_id?: string;
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
const BookingCard = ({ booking }: { booking: Booking }) => {
  const status = STATUS_CONFIG[booking.status];
  const isUpcoming = booking.tab === 'Upcoming';
  const isCancelled = booking.tab === 'Cancelled';
  const isCompleted = booking.tab === 'Completed';

  return (
    <View style={styles.bookingCard}>

      {/* ── Card Header ── */}
      <View style={styles.cardHeader}>
        {/* Vehicle Image Placeholder */}
        <View style={styles.vehicleImagePlaceholder}>
          <VehicleIcon type={booking.vehicleType} size={30} color={COLORS.mediumGray} />
          <Text style={styles.imagePlaceholderLabel}>Image Here</Text>
        </View>

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
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>
            {booking.status}
          </Text>
        </View>
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
        {isUpcoming && booking.status === 'Confirmed' && (
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
        {isUpcoming && booking.status === 'Pending' && (
          <>
            <TouchableOpacity 
              style={styles.secondaryBtn} 
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/more/bookingDetail', params: { id: booking.id } })}
            >
              <Text style={styles.secondaryBtnText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} activeOpacity={0.85}>
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
        <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.85}>
          <Text style={styles.emptyBtnText}>Rent a Vehicle</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function MyBookingsScreen() {
  const { user } = useAuth();
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

      const fetchedBookings: Booking[] = (data || []).map((row) => {
        let status: StatusType = 'Pending';
        const rawStatus = (row.status || '').toLowerCase();
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

        return {
          id: row.id,
          vehicleName: row.item_name || 'Unknown Booking',
          vehicleNumber: row.vehicle_number || 'N/A',
          vehicleType: row.vehicle_type || (row.booking_type === 'vehicle' ? 'Bike' : 'Car'),
          date: dateStr,
          time: timeStr,
          duration: row.days ? `${row.days} Days` : 'N/A',
          pickup: row.pickup_location || 'Not specified',
          totalAmount: row.amount || row.price || 0,
          status,
          tab,
          item_id: row.item_id,
          _createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
        };
      });

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── Header ── */}
      <AppBar />

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
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </View>
            ))
          ) : (
            filtered.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))
          )}

          {/* ── Need Help Banner ── */}
          <View style={styles.helpBanner}>
            <View style={styles.helpIconBox}>
              <Ionicons name="headset-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.helpTextBox}>
              <Text style={styles.helpTitle}>Need Help?</Text>
              <Text style={styles.helpSubtitle}>Trip Support · We're here 24/7</Text>
            </View>
            <TouchableOpacity style={styles.helpCallBtn} activeOpacity={0.85}>
              <ExpoImage source={require('../../assets/svg/phone-call-svgrepo-com.svg')} style={{ width: 22, height: 22, tintColor: COLORS.white }} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
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
    gap: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.lightGray,
    gap: 5,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: '#DCFCE7',
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.mediumGray,
  },
  filterTabTextActive: {
    color: COLORS.primary,
  },
  filterTabCount: {
    backgroundColor: COLORS.borderGray,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterTabCountActive: {
    backgroundColor: COLORS.primary,
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
    paddingTop: 14,
    paddingBottom: 10,
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
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: COLORS.borderGray,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'flex-start',
    gap: 12,
  },
  vehicleImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    borderStyle: 'dashed',
  },
  imagePlaceholderLabel: {
    fontSize: 9,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  vehicleName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkGray,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.borderGray,
    marginHorizontal: 14,
  },

  // Trip Details
  tripDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tripDetailItem: {
    flex: 1,
    gap: 4,
  },
  tripDetailDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.borderGray,
    marginHorizontal: 14,
  },
  tripDetailLabel: {
    fontSize: 10,
    color: COLORS.mediumGray,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  tripDetailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripDetailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkGray,
    flex: 1,
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.borderGray,
    backgroundColor: COLORS.white,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  dangerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  dangerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.danger,
  },
  tealBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.teal,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
    shadowColor: COLORS.teal,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  tealBtnText: {
    fontSize: 13,
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
    borderColor: COLORS.borderGray,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  helpIconBox: {
    width: 46,
    height: 46,
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
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkGray,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnText: {
    fontSize: 14,
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
