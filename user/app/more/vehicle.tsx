import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import AppBar from '../../components/AppBar';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Color Palette ─────────────────────────────────────────────────────────────
const COLORS = {
  primary:    '#16A34A',
  teal:       '#14B8A6',
  skyBlue:    '#0EA5E9',
  orange:     '#F97316',
  white:      '#FFFFFF',
  lightGray:  '#F1F5F9',
  darkGray:   '#1F2937',
  mediumGray: '#6B7280',
  borderGray: '#E2E8F0',
  danger:     '#EF4444',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FeatureBadge {
  icon:  string;
  label: string;
}

interface PriceRow {
  label:    string;
  amount:   number;
  isTotal?: boolean;
}

// Default Constants Removed

// ─── Star Rating ───────────────────────────────────────────────────────────────
const StarRating = ({ rating, size = 13 }: { rating: number; size?: number }) => {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View style={styles.starRow}>
      {Array(full).fill(0).map((_, i) => (
        <Ionicons key={`f${i}`} name="star"         size={size} color="#FBBF24" />
      ))}
      {half && <Ionicons name="star-half"            size={size} color="#FBBF24" />}
      {Array(empty).fill(0).map((_, i) => (
        <Ionicons key={`e${i}`} name="star-outline"  size={size} color="#FBBF24" />
      ))}
    </View>
  );
};

// ─── Section Title ─────────────────────────────────────────────────────────────
const SectionTitle = ({ title }: { title: string }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

// ─── Feature Badge ─────────────────────────────────────────────────────────────
const FeatureBadgeItem = ({ feature }: { feature: FeatureBadge }) => (
  <View style={styles.featureBadge}>
    <MaterialCommunityIcons name={feature.icon as any} size={16} color={COLORS.primary} />
    <Text style={styles.featureBadgeText}>{feature.label}</Text>
  </View>
);

// ─── Date Selector Card ────────────────────────────────────────────────────────
const DateSelectorCard = ({
  label,
  date,
  time,
  icon,
  onPress,
}: {
  label: string;
  date:  string;
  time:  string;
  icon:  string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.dateSelectorCard} activeOpacity={0.8} onPress={onPress}>
    <View style={styles.dateSelectorIconBox}>
      <Ionicons name={icon as any} size={18} color={COLORS.primary} />
    </View>
    <View style={styles.dateSelectorInfo}>
      <Text style={styles.dateSelectorLabel}>{label}</Text>
      <Text style={styles.dateSelectorDate}>{date}</Text>
      <Text style={styles.dateSelectorTime}>{time}</Text>
    </View>
    <Feather name="chevron-down" size={16} color={COLORS.mediumGray} />
  </TouchableOpacity>
);

// ─── Spec Row ──────────────────────────────────────────────────────────────────
const SpecRow = ({
  label,
  value,
  isLast,
}: {
  label:   string;
  value:   string;
  isLast:  boolean;
}) => (
  <View style={[styles.specRow, !isLast && styles.specRowBorder]}>
    <Text style={styles.specLabel}>{label}</Text>
    <Text style={styles.specValue}>{value}</Text>
  </View>
);

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function VehicleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs'>('specs');

  const [pickupDate, setPickupDate] = useState<Date>(new Date());
  const [dropoffDate, setDropoffDate] = useState<Date>(() => {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  });
  const [showPicker, setShowPicker] = useState<{ visible: boolean, mode: 'date' | 'time', type: 'pickup' | 'dropoff' }>({ visible: false, mode: 'date', type: 'pickup' });

  const calculateDays = (start: Date, end: Date) => {
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };

  const durationDays = calculateDays(pickupDate, dropoffDate);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const onChangePicker = (event: any, selectedDate?: Date) => {
    setShowPicker({ ...showPicker, visible: false });
    if (selectedDate) {
      if (showPicker.type === 'pickup') {
        if (showPicker.mode === 'date') {
          const newDate = new Date(selectedDate);
          newDate.setHours(pickupDate.getHours(), pickupDate.getMinutes());
          setPickupDate(newDate);
          // Optionally, automatically prompt for time after date is selected
          // setTimeout(() => setShowPicker({ visible: true, mode: 'time', type: 'pickup' }), 500);
        } else {
          const newDate = new Date(pickupDate);
          newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
          setPickupDate(newDate);
        }
      } else {
        if (showPicker.mode === 'date') {
          const newDate = new Date(selectedDate);
          newDate.setHours(dropoffDate.getHours(), dropoffDate.getMinutes());
          setDropoffDate(newDate);
          // setTimeout(() => setShowPicker({ visible: true, mode: 'time', type: 'dropoff' }), 500);
        } else {
          const newDate = new Date(dropoffDate);
          newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
          setDropoffDate(newDate);
        }
      }
    }
  };

  useEffect(() => {
    if (!id) return;

    const applyVehicleData = (doc: any) => {
      const details = doc.details || {};
      const mappedFeatures: any[] = [];
      if (details.fuelType) mappedFeatures.push({ icon: 'gas-station', label: details.fuelType });
      if (details.helmet) mappedFeatures.push({ icon: 'racing-helmet', label: details.helmet === 'Yes' ? 'Helmet Provided' : 'No Helmet' });
      if (details.minDuration) mappedFeatures.push({ icon: 'clock-outline', label: `Min ${details.minDuration} Day` });
      if (mappedFeatures.length === 0) {
        mappedFeatures.push(
          { icon: 'speedometer', label: '150 km/day' },
          { icon: 'shield-check', label: 'Verified' },
          { icon: 'gas-station', label: 'Fuel Efficient' }
        );
      }
      setVehicle({
        id: doc.id,
        name: doc.title || details.vehicleMake || 'Vehicle Details',
        type: doc.category || 'Bike',
        rating: doc.rating || 4.8,
        reviews: doc.reviews || 124,
        pricePerDay: doc.price || 0,
        pickup: doc.location || 'Arambol, Goa',
        freeCancellation: true,
        description: doc.description || 'No description available for this vehicle.',
        features: mappedFeatures,
        partnerId: doc.partner_id || '',
        specs: [
          { label: 'Vehicle Make', value: details.vehicleMake || 'N/A' },
          { label: 'Fuel Type', value: details.fuelType || 'N/A' },
          { label: 'Helmet Provided', value: details.helmet || 'No' },
          { label: 'Security Deposit', value: details.deposit ? `₹${details.deposit}` : 'N/A' },
          { label: 'Min Duration', value: details.minDuration ? `${details.minDuration} Day(s)` : '1 Day' },
        ],
        image: doc.images?.[0] || null,
      });
    };

    const fetchVehicle = async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        console.error('Fetch Vehicle Detail Error:', error);
      } else if (data) {
        applyVehicleData(data);
      }
      setLoading(false);
    };

    fetchVehicle();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppBar />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppBar />
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={60} color={COLORS.danger} />
          <Text style={styles.errorText}>Vehicle not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const priceRows: PriceRow[] = [
    { label: `₹${vehicle.pricePerDay} x ${durationDays} Days`, amount: vehicle.pricePerDay * durationDays },
    { label: 'Delivery Charges', amount: 100 },
    { label: 'Total Amount', amount: vehicle.pricePerDay * durationDays + 100, isTotal: true },
  ];

  const totalAmount = priceRows[priceRows.length - 1].amount;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <AppBar />

        {/* ── Image Section ── */}
        <View style={styles.imageSection}>
          {vehicle.image ? (
            <Image source={{ uri: vehicle.image }} style={styles.vehicleFullImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialCommunityIcons 
                name={vehicle.type === 'Car' ? 'car' : 'motorbike'} 
                size={80} 
                color={COLORS.mediumGray} 
              />
              <Text style={styles.imagePlaceholderText}>No Image Available</Text>
            </View>
          )}

          {/* Overlay Header */}
          <View style={styles.imageOverlayHeader}>
            <TouchableOpacity style={styles.overlayBtn} activeOpacity={0.8} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={COLORS.darkGray} />
            </TouchableOpacity>
            <View style={styles.overlayHeaderRight}>
              <TouchableOpacity style={styles.overlayBtn} activeOpacity={0.8}>
                <Feather name="share-2" size={18} color={COLORS.darkGray} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.overlayBtn}
                activeOpacity={0.8}
                onPress={() => setIsSaved((p) => !p)}
              >
                <Ionicons
                  name={isSaved ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isSaved ? COLORS.danger : COLORS.darkGray}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Rating Chip on Image */}
          <View style={styles.ratingChipOnImage}>
            <Ionicons name="star" size={12} color="#FBBF24" />
            <Text style={styles.ratingChipText}>{vehicle.rating}</Text>
          </View>
        </View>

        {/* ── Title Block ── */}
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.vehicleName}>{vehicle.name}</Text>
          </View>

          <View style={styles.titleMetaRow}>
            <StarRating rating={vehicle.rating} />
            <Text style={styles.reviewCount}>{vehicle.rating} ({vehicle.reviews} reviews)</Text>
          </View>

          <View style={styles.pickupRow}>
            <View style={styles.locationIconBox}>
              <Ionicons name="location" size={14} color={COLORS.primary} />
            </View>
            <Text style={styles.pickupText}>{vehicle.pickup}</Text>
          </View>
        </View>

        {/* ── Feature Badges ── */}
        <View style={styles.featuresRow}>
          {vehicle.features.map((f: any, idx: number) => (
            <FeatureBadgeItem key={idx} feature={f} />
          ))}
        </View>

        {/* ── Tab Toggle ── */}
        <View style={styles.tabToggleContainer}>
          {(['overview', 'specs'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabToggleBtn, activeTab === t && styles.tabToggleBtnActive]}
              onPress={() => setActiveTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabToggleText, activeTab === t && styles.tabToggleTextActive]}>
                {t === 'overview' ? 'Overview' : 'Specifications'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <View style={styles.card}>
            <Text style={styles.descriptionText}>{vehicle.description}</Text>
          </View>
        )}

        {/* ── Specs Tab ── */}
        {activeTab === 'specs' && (
          <View style={styles.card}>
            {vehicle.specs.length > 0 ? vehicle.specs.map((spec: any, idx: number) => (
              <SpecRow
                key={idx}
                label={spec.label}
                value={spec.value}
                isLast={idx === vehicle.specs.length - 1}
              />
            )) : (
              <Text style={styles.descriptionText}>No specifications listed.</Text>
            )}
          </View>
        )}

        {/* ── Select Dates ── */}
        {/* <View style={styles.section}>
          <SectionTitle title="Select Dates" />
          <View style={styles.dateRow}>
            <DateSelectorCard
              label="Pickup"
              date={formatDate(pickupDate)}
              time={formatTime(pickupDate)}
              icon="calendar-outline"
              onPress={() => setShowPicker({ visible: true, mode: 'date', type: 'pickup' })}
            />
            <View style={styles.dateSeparator}>
              <View style={styles.dateSeparatorLine} />
              <View style={styles.dateSeparatorDot} />
              <View style={styles.dateSeparatorLine} />
            </View>
            <DateSelectorCard
              label="Drop-off"
              date={formatDate(dropoffDate)}
              time={formatTime(dropoffDate)}
              icon="flag-outline"
              onPress={() => setShowPicker({ visible: true, mode: 'date', type: 'dropoff' })}
            />
          </View> */}

          {/* Duration Chip */}
          {/* <View style={styles.durationChip}>
            <Ionicons name="time-outline" size={14} color={COLORS.teal} />
            <Text style={styles.durationChipText}>
              Duration: <Text style={{ fontWeight: '700', color: COLORS.teal }}>{durationDays} Days</Text>
            </Text>
          </View>
        </View> */}

        {/* ── Price Breakdown ── */}
        {/* <View style={styles.section}>
          <SectionTitle title="Price Details" />
          <View style={styles.card}>
            {priceRows.map((row, idx) => (
              <View key={idx}>
                {row.isTotal && <View style={styles.priceDivider} />}
                <View style={[styles.priceRow, row.isTotal && styles.priceRowTotal]}>
                  <Text style={[styles.priceRowLabel, row.isTotal && styles.priceRowLabelTotal]}>
                    {row.label}
                  </Text>
                  <Text style={[styles.priceRowAmount, row.isTotal && styles.priceRowAmountTotal]}>
                    ₹{row.amount.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View> */}





        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Date Picker Modal */}
      {showPicker.visible && (
        <DateTimePicker
          value={showPicker.type === 'pickup' ? pickupDate : dropoffDate}
          mode={showPicker.mode}
          display="default"
          onChange={onChangePicker}
          minimumDate={showPicker.type === 'dropoff' ? pickupDate : new Date()}
        />
      )}

      {/* ── Sticky Bottom CTA ── */}
      <View style={styles.bottomCTA}>

        <TouchableOpacity
          style={styles.bookPayBtn}
          activeOpacity={0.88}
          onPress={() => {
            router.push({
              pathname: '/more/checkout',
              params: {
                bookingType: 'vehicle',
                itemId: id || '',
                itemName: vehicle.name,
                pricePerUnit: String(vehicle.pricePerDay),
                partnerId: vehicle.partnerId || id || '',
                unitLabel: 'day',
              },
            });
          }}
        >
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.white} />
          <Text style={styles.bookPayBtnText}>Book & Pay Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: COLORS.white,
  },

  // Loader & Error
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginTop: 16,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  vehicleFullImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // Image Section
  imageSection: {
    width: '100%',
    height: SCREEN_WIDTH * 0.7,
    backgroundColor: COLORS.lightGray,
    position: 'relative',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 10,
    color: COLORS.mediumGray,
    fontSize: 14,
    fontWeight: '500',
  },
  imageOverlayHeader: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayHeaderRight: {
    flexDirection: 'row',
    gap: 10,
  },
  ratingChipOnImage: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  ratingChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkGray,
  },

  // Scroll Content
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Title Block
  titleBlock: {
    padding: 24,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  vehicleName: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.darkGray,
    letterSpacing: -0.5,
    flex: 1,
  },
  titleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  starRow: {
    flexDirection: 'row',
    gap: 3,
  },
  reviewCount: {
    fontSize: 14,
    color: COLORS.mediumGray,
    fontWeight: '600',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  locationIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupText: {
    fontSize: 14,
    color: COLORS.darkGray,
    fontWeight: '500',
  },

  // Features
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  featureBadgeText: {
    fontSize: 13,
    color: COLORS.darkGray,
    fontWeight: '600',
  },

  // Tabs
  tabToggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.lightGray,
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabToggleBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tabToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mediumGray,
  },
  tabToggleTextActive: {
    color: COLORS.primary,
  },

  // Cards & Sections
  section: {
    marginTop: 28,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkGray,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.5)',
  },
  descriptionText: {
    fontSize: 16,
    color: COLORS.mediumGray,
    lineHeight: 26,
    letterSpacing: 0.2,
  },

  // Specs
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  specRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  specLabel: {
    fontSize: 15,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  specValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkGray,
  },

  // Dates
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateSelectorCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  dateSelectorIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateSelectorInfo: {
    flex: 1,
  },
  dateSelectorLabel: {
    fontSize: 11,
    color: COLORS.mediumGray,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dateSelectorDate: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.darkGray,
    marginTop: 2,
  },
  dateSelectorTime: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSeparatorLine: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.borderGray,
  },
  dateSeparatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginVertical: 4,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDFA',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  durationChipText: {
    fontSize: 14,
    color: COLORS.teal,
    fontWeight: '600',
  },

  // Price
  priceDivider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  priceRowTotal: {
    paddingVertical: 0,
  },
  priceRowLabel: {
    fontSize: 15,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  priceRowLabelTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkGray,
  },
  priceRowAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  priceRowAmountTotal: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
  },

  // Cancellation
  cancellationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    marginHorizontal: 24,
    marginTop: 32,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  cancellationIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cancellationTextBox: {
    flex: 1,
  },
  cancellationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkGray,
  },
  cancellationSubtitle: {
    fontSize: 13,
    color: COLORS.mediumGray,
    marginTop: 4,
    lineHeight: 18,
  },

  // Host Card
  hostCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.white,
    borderRadius:    20,
    padding:         18,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.04,
    shadowRadius:    12,
    elevation:       3,
    borderWidth:     1,
    borderColor:     COLORS.borderGray,
    gap:             16,
  },
  hostAvatarPlaceholder: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: COLORS.lightGray,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     COLORS.borderGray,
    borderStyle:     'dashed',
  },
  hostInfo: {
    flex: 1,
    gap:  6,
  },
  hostName: {
    fontSize:   17,
    fontWeight: '800',
    color:      COLORS.darkGray,
  },
  hostMetaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  hostMeta: {
    fontSize:   13,
    color:      COLORS.mediumGray,
    fontWeight: '600',
  },
  hostChatBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     '#DCFCE7',
  },
  hostChatBtnText: {
    fontSize:   14,
    fontWeight: '800',
    color:      COLORS.primary,
  },

  // Sticky Bottom CTA
  bottomCTA: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   COLORS.white,
    paddingHorizontal: 20,
    paddingVertical:   18,
    borderTopWidth:    1,
    borderTopColor:    '#F1F5F9',
   
  },
  bottomCTAPrice: {
    gap: 4,
  },
  bottomCTAPriceLabel: {
    fontSize:   12,
    color:      COLORS.mediumGray,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottomCTAPriceValue: {
    fontSize:      26,
    fontWeight:    '900',
    color:         COLORS.darkGray,
    letterSpacing: -1,
    lineHeight:    30,
  },
  bottomCTAPriceDays: {
    fontSize:   13,
    color:      COLORS.mediumGray,
    fontWeight: '600',
  },
  bookPayBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical:   16,
    borderRadius:    18,
    shadowColor:     COLORS.primary,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.3,
    shadowRadius:    12,
    elevation:       8,
  },
  bookPayBtnText: {
    fontSize:   16,
    fontWeight: '900',
    color:      COLORS.white,
    letterSpacing: 0.5,
  },
});
