import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator,
  Linking
} from 'react-native';
import { Text } from '../../components/Text';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';

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
  borderGray: '#E2E8F0',
  danger: '#EF4444',
  success: '#10B981',
};

type VehicleType = 'Scooty' | 'Bike' | 'Car';
type StatusType = 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';

interface BookingDetail {
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
  tab: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  created_at: string;
  item_id: string;
  price_per_day: number;
  days: number;
}

const STATUS_CONFIG: Record<StatusType, { color: string; bg: string; icon: any }> = {
  Confirmed: { color: COLORS.primary, bg: '#DCFCE7', icon: 'checkmark-circle' },
  Pending: { color: COLORS.orange, bg: '#FFF7ED', icon: 'time' },
  Completed: { color: COLORS.skyBlue, bg: '#E0F2FE', icon: 'checkbox' },
  Cancelled: { color: COLORS.danger, bg: '#FEE2E2', icon: 'close-circle' },
};

export default function BookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetail | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchBookingDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, users:users!bookings_user_id_fkey(name, phone, email)')
          .eq('id', id as string)
          .single();

        if (error) throw error;

        if (data) {
          let status: StatusType = 'Pending';
          const rawStatus = (data.status || '').toLowerCase();
          if (rawStatus === 'confirmed') status = 'Confirmed';
          else if (rawStatus === 'completed') status = 'Completed';
          else if (rawStatus === 'cancelled' || rawStatus === 'rejected') status = 'Cancelled';

          let dateStr = 'Unknown Date';
          let timeStr = 'Unknown Time';
          if (data.created_at) {
            const dateObj = new Date(data.created_at);
            dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          }

          setBooking({
            id: data.id,
            vehicleName: data.item_name || 'Unknown Booking',
            vehicleNumber: data.vehicle_number || 'N/A',
            vehicleType: data.vehicle_type || (data.booking_type === 'vehicle' ? 'Bike' : 'Car'),
            date: dateStr,
            time: timeStr,
            duration: data.days ? `${data.days} Days` : 'N/A',
            pickup: data.pickup_location || 'Not specified',
            totalAmount: data.amount || data.price || 0,
            status,
            tab: status === 'Completed' ? 'Completed' : (status === 'Cancelled' ? 'Cancelled' : 'Upcoming'),
            userName: data.users?.name || 'Customer',
            userPhone: data.users?.phone || '',
            userEmail: data.users?.email || '',
            created_at: data.created_at,
            item_id: data.item_id,
            price_per_day: data.price_per_day || 0,
            days: data.days || 0,
          });
        }
      } catch (err) {
        console.error('Error fetching booking details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookingDetails();
  }, [id]);

  const handleGetDirections = () => {
    if (booking?.pickup) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.pickup)}`;
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.mediumGray} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.darkGray, marginTop: 16 }}>Booking Not Found</Text>
        <Text style={{ fontSize: 14, color: COLORS.mediumGray, textAlign: 'center', marginTop: 8 }}>
          We couldn't find the details for this booking. It might have been deleted.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.darkGray} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking ID: #{booking.id.slice(0, 8).toUpperCase()}</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="share-outline" size={24} color={COLORS.darkGray} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* ── Status Banner ── */}
        <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg }]}>
          <View style={styles.statusInfo}>
            <Ionicons name={statusConfig.icon} size={24} color={statusConfig.color} />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.statusLabel, { color: statusConfig.color }]}>Booking {booking.status}</Text>
              <Text style={styles.statusTime}>Updated on {booking.date} at {booking.time}</Text>
            </View>
          </View>
        </View>

        {/* ── Vehicle Info Card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.vehicleIconBox}>
              <MaterialCommunityIcons 
                name={booking.vehicleType === 'Car' ? 'car' : 'motorbike'} 
                size={32} 
                color={COLORS.primary} 
              />
            </View>
            <View style={styles.vehicleMainInfo}>
              <Text style={styles.vehicleName}>{booking.vehicleName}</Text>
              <View style={styles.plateNumber}>
                <Text style={styles.plateText}>{booking.vehicleNumber}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DATE</Text>
              <Text style={styles.detailValue}>{booking.date}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>TIME</Text>
              <Text style={styles.detailValue}>{booking.time}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DURATION</Text>
              <Text style={styles.detailValue}>{booking.duration}</Text>
            </View>
          </View>
        </View>

        {/* ── Pickup Location ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup Location</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationIconBox}>
              <Ionicons name="location" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.locationText}>{booking.pickup}</Text>
          </View>
          {booking.status !== 'Cancelled' && (
            <TouchableOpacity style={styles.directionsBtn} onPress={handleGetDirections}>
              <Ionicons name="navigate-outline" size={18} color={COLORS.white} />
              <Text style={styles.directionsBtnText}>Get Directions</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Price Summary ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Price Summary</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Base Fare ({booking.duration})</Text>
            <Text style={styles.priceValue}>₹{(booking.price_per_day * booking.days).toLocaleString()}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Taxes & Fees</Text>
            <Text style={styles.priceValue}>₹0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { fontWeight: '700', color: COLORS.darkGray }]}>Total Amount</Text>
            <Text style={[styles.priceValue, { fontWeight: '800', color: COLORS.primary, fontSize: 18 }]}>
              ₹{booking.totalAmount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.paymentInfo}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.success} />
            <Text style={styles.paymentInfoText}>Payment Securely Processed</Text>
          </View>
        </View>

        {/* ── Support ── */}
        <View style={styles.supportBox}>
          <View style={styles.supportIconBox}>
            <Ionicons name="headset-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.supportTitle}>Need help with this booking?</Text>
            <Text style={styles.supportSubtitle}>Our support team is available 24/7</Text>
          </View>
          <TouchableOpacity style={styles.supportBtn}>
            <Text style={styles.supportBtnText}>Contact</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Bottom Actions ── */}
      <View style={styles.bottomActions}>
        {booking.status === 'Cancelled' ? (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => router.push('/more/vehicle')}
          >
            <Text style={styles.actionBtnText}>Rebook Now</Text>
          </TouchableOpacity>
        ) : booking.status === 'Completed' ? (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: COLORS.teal }]}
            onPress={() => router.push({ pathname: '/more/RateAndReview', params: { bookingId: booking.id, itemId: booking.item_id } })}
          >
            <Text style={styles.actionBtnText}>Rate & Review</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.row}>
            <TouchableOpacity 
              style={[styles.actionBtn, { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.danger, marginRight: 12 }]}
            >
              <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, { flex: 2, backgroundColor: COLORS.primary }]}
              onPress={handleGetDirections}
            >
              <Text style={styles.actionBtnText}>Start Trip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  header: {
    height: 64,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkGray,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  statusBanner: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusTime: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: 2,
    fontWeight: '500',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconBox: {
    width: 60,
    height: 60,
    borderRadius: 15,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  vehicleMainInfo: {
    flex: 1,
    marginLeft: 16,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkGray,
  },
  plateNumber: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  plateText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.mediumGray,
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderGray,
    marginVertical: 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.mediumGray,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginBottom: 14,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.mediumGray,
    lineHeight: 20,
    fontWeight: '500',
  },
  directionsBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  directionsBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 14,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: '#F0FDF4',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  paymentInfoText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
  },
  supportBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  supportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  supportSubtitle: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: 2,
  },
  supportBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
  },
  supportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGray,
  },
  actionBtn: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  backBtn: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
