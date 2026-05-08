import { Text } from '../../components/Text';
import { Image as ExpoImage } from 'expo-image';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../utils/supabase';
// import * as Location from 'expo-location';
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppBar from '../../components/AppBar';
import * as Location from 'expo-location';
// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#16A34A',       // Forest Green
  teal: '#14B8A6',          // Teal Green
  skyBlue: '#0EA5E9',       // Sky Blue
  orange: '#F97316',        // Sunset Orange
  white: '#FFFFFF',
  lightGray: '#F1F5F9',
  darkGray: '#1F2937',
  mediumGray: '#6B7280',
  borderGray: '#d3dbe2',
  onlineDot: '#22C55E',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Guide {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  isOnline: boolean;
  verified: boolean;
  profileImage?: string;
}

interface Vehicle {
  id: string;
  type: string;
  pricePerDay: number;
  image: any;
}

interface Category {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

// Mock Data for fallback or other categories
const VEHICLES: Vehicle[] = [
  { id: '1', type: 'scooty', pricePerDay: 499, image: require('../../assets/images/scooty.png') },
  { id: '2', type: 'bike', pricePerDay: 899, image: require('../../assets/images/bike.png') },
  { id: '3', type: 'car', pricePerDay: 2499, image: require('../../assets/images/car.png') },
];

const CATEGORIES: Category[] = [
  { id: '1', label: 'Food Tours', emoji: '🍽️', color: '#FEF3C7' },
  { id: '2', label: 'City Walks', emoji: '🚶', color: '#DBEAFE' },
  { id: '3', label: 'Adventure', emoji: '⛰️', color: '#DCFCE7' },
  { id: '4', label: 'Hidden Gems', emoji: '💎', color: '#F3E8FF' },
];

// ─── Reusable Star Rating ─────────────────────────────────────────────────────
const StarRating = ({ rating }: { rating: number }) => (
  <View style={styles.starRow}>
    <Text style={styles.starIcon}>⭐</Text>
    <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
  </View>
);

// ─── Guide Card ───────────────────────────────────────────────────────────────
const GuideCard = ({ guide }: { guide: Guide }) => {
  const router = useRouter();

  return (
    <View style={styles.guideCard}>
      {/* Image Placeholder */}
      <View style={styles.guideImagePlaceholder}>
        {guide.profileImage ? (
          <ExpoImage source={{ uri: guide.profileImage }} style={{ width: '100%', height: '100%', borderRadius: 10 }} contentFit="cover" />
        ) : (
          <Text style={styles.placeholderEmoji}>👤</Text>
        )}
        {guide.isOnline && (
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.guideInfo}>
        <View style={styles.guideNameRow}>
          <Text style={styles.guideName} numberOfLines={1}>{guide.name}</Text>
          {guide.verified && <ExpoImage source={require('../../assets/svg/verify-svgrepo-com.svg')} style={{ width: 14, height: 14, tintColor: COLORS.skyBlue }} contentFit="contain" />}
        </View>
        <StarRating rating={guide.rating} />
        <Text style={styles.reviewCount}>({guide.reviews} Reviews)</Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.bookGuideBtn}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/more/guideDetail', params: { id: guide.id } })}
      >
        <Text style={styles.bookGuideBtnText}>Book Guide</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Vehicle Card ─────────────────────────────────────────────────────────────
const VehicleCard = ({ vehicle }: { vehicle: Vehicle }) => {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.vehicleCard}
      activeOpacity={0.85}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/RentAVehicle',
          params: { filter: vehicle.type },
        })
      }
    >
      {/* Image */}
      <View style={styles.vehicleImagePlaceholder}>
        <Image source={vehicle.image} style={styles.vehicleImage} resizeMode="contain" />
      </View>
      <Text style={styles.vehicleType}>{vehicle.type}</Text>
      <Text style={styles.vehiclePrice}>
        ₹ {vehicle.pricePerDay.toLocaleString()}<Text style={styles.perDay}>/Day</Text>
      </Text>
    </TouchableOpacity>
  );
};

// ─── Category Pill ────────────────────────────────────────────────────────────
const CategoryPill = ({ category }: { category: Category }) => (
  <TouchableOpacity
    style={[styles.categoryPill, { backgroundColor: category.color }]}
    activeOpacity={0.8}
  >
    <Text style={styles.categoryEmoji}>{category.emoji}</Text>
    <Text style={styles.categoryLabel}>{category.label}</Text>
  </TouchableOpacity>
);



// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
        <Text style={styles.seeAllText}>See All &gt;</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Main HomeScreen ──────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState<string>('');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<string>('Fetching location...');

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setCurrentLocation('Location permission denied');
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        let geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        if (geocode && geocode.length > 0) {
          const { city, region, country, district } = geocode[0];
          const displayCity = city || district || region || 'Unknown';
          setCurrentLocation(`${displayCity}, ${country || 'Unknown'}`);
        } else {
          setCurrentLocation('Location not found');
        }
      } catch (error) {
        console.warn('Error fetching location:', error);
        setCurrentLocation('Rishikesh, India'); // Fallback
      }
    })();
  }, []);

  useEffect(() => {
    setLoadingGuides(true);

    // Initial fetch
    const fetchGuides = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, rating, reviews, is_online, is_approved, profile_data, photo_url')
        .eq('role', 'guide')
        .eq('is_approved', true)
        .limit(5);

      if (!error && data) {
        const guidesData: Guide[] = data.map((row) => ({
          id: row.id,
          name: row.name || 'Anonymous',
          rating: row.rating || 4.5,
          reviews: row.reviews || 0,
          isOnline: row.is_online || false,
          verified: row.is_approved || false,
          profileImage: row.profile_data?.profileImage || row.photo_url || null,
        }));
        setGuides(guidesData);
      } else if (error) {
        console.warn('Home fetch guides issue:', error.message);
      }

      setLoadingGuides(false);
      setRefreshing(false);
    };

    fetchGuides();
  }, [refreshKey]);

  const onRefresh = () => {
    setRefreshing(true);
    setGuides([]);
    setRefreshKey(k => k + 1);
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── Top App Bar ── */}
      <AppBar />

      {/* ── Location Selector ── */}
      <TouchableOpacity style={styles.locationBar} activeOpacity={0.8}>
        <ExpoImage source={require('../../assets/svg/location-pin-svgrepo-com.svg')} style={{ width: 16, height: 16, marginRight: 6, tintColor: COLORS.darkGray }} contentFit="contain" />
        <Text style={styles.locationText}>{currentLocation}</Text>
        <Text style={styles.locationChevron}>▾</Text>
      </TouchableOpacity>





      {/* ── Scrollable Content ── */}
      <ScrollView
        style={styles.scrollView}
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
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Where do you want to go?"
            placeholderTextColor={COLORS.mediumGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity style={styles.searchBtn} activeOpacity={0.85}>
            <ExpoImage source={require('../../assets/svg/search-svgrepo-com.svg')} style={{ width: 20, height: 20, tintColor: COLORS.white }} contentFit="contain" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroPanel}>

          <ExpoImage
            source={require('../../assets/images/banner1.jpeg')}
            style={styles.heroImage}
            contentFit="contain"
          />
        </View>

        {/* Search Bar */}

        {/* ── Featured Guides ── */}
        <SectionHeader title="Featured Guides" onSeeAll={() => router.push('/(tabs)/AllGuides')} />
        <FlatList
          data={guides}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          renderItem={({ item }) => <GuideCard guide={item} />}
          ListEmptyComponent={
            !loadingGuides ? (
              <Text style={{ marginLeft: 16, color: COLORS.mediumGray }}>No guides available</Text>
            ) : null
          }
        />

        {/* ── Rent a Vehicle ── */}
        <SectionHeader title="Rent a Vehicle" onSeeAll={() => router.push('/(tabs)/RentAVehicle')} />
        <FlatList
          data={VEHICLES}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          renderItem={({ item }) => <VehicleCard vehicle={item} />}
        />

        {/* ── Quick Categories ── */}
        <SectionHeader title="Quick Categories" />
        <View style={styles.categoriesGrid}>
          {CATEGORIES.map((cat) => (
            <CategoryPill key={cat.id} category={cat} />
          ))}
        </View>

        {/* ── Promo Banner ── */}
        <View style={styles.promoBanner}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTag}>Limited offer</Text>
            <Text style={styles.promoTitle}>Free delivery</Text>
            <Text style={styles.promoSubtitle}>
              We'll deliver your rented vehicle to your location!
            </Text>
            <TouchableOpacity
              style={styles.promoBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/RentAVehicle')}
            >
              <Text style={styles.promoBtnText}>Explore Rentals</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.promoImageWrap}>
            <Image
              source={require('../../assets/images/scooty.png')}
              style={styles.promoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // App Bar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  menuButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    gap: 5,
  },
  menuLine: {
    height: 2,
    width: 22,
    backgroundColor: COLORS.darkGray,
    borderRadius: 2,
    marginVertical: 2,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkGray,
    letterSpacing: -0.3,
  },
  appBarTitleGreen: {
    color: COLORS.primary,
  },
  notifButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifIcon: {
    fontSize: 22,
  },
  notifDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.orange,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },

  // Location Bar
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  locationPin: {
    fontSize: 16,
    marginRight: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  locationChevron: {
    fontSize: 16,
    color: COLORS.mediumGray,
  },

  // Scroll
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  heroPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 170,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,

    borderRadius: 20,

  },
  heroCopy: {
    position: 'relative',
    zIndex: 1,
    padding: 18,
    paddingRight: 96,
    minHeight: 170,
    justifyContent: 'flex-end',
  },
  heroKicker: {
    color: '#BBF7D0',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  heroMetaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroMetaText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginTop: 12,

  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: COLORS.darkGray,

  },
  searchBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    margin: 1.5,
    marginRight: 2.5,
  },
  searchIcon: {
    fontSize: 18,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkGray,
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Horizontal List
  horizontalList: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingBottom: 12,
  },

  // Guide Card
  guideCard: {
    width: 160,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginRight: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',

  },
  guideImagePlaceholder: {
    width: '100%',
    height: 110,
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  placeholderEmoji: {
    fontSize: 36,
    opacity: 0.4,
  },
  onlineBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.onlineDot,
  },
  onlineText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '600',
  },
  guideInfo: {
    marginBottom: 10,
  },
  guideNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  guideName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkGray,
    flex: 1,
  },
  verifiedBadge: {
    fontSize: 12,
    color: COLORS.skyBlue,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  starIcon: {
    fontSize: 12,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  reviewCount: {
    fontSize: 11,
    color: COLORS.mediumGray,
    marginTop: 2,
  },
  bookGuideBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookGuideBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.2,
  },

  // Vehicle Card
  vehicleCard: {
    width: 130,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginRight: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',

  },
  vehicleImagePlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  vehicleType: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  vehiclePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  perDay: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.mediumGray,
  },

  // Quick Categories
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(31,41,55,0.08)',
  },
  categoryEmoji: {
    fontSize: 18,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkGray,
  },

  // Promo Banner
  promoBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,

  },
  promoContent: {
    flex: 1,
    justifyContent: 'center',
  },
  promoTag: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  promoTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 17,
    marginBottom: 14,
  },
  promoBtn: {
    backgroundColor: COLORS.white,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  promoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  promoImageWrap: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    alignSelf: 'center',
  },
  promoImage: {
    width: 94,
    height: 82,
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
  },
  tabEmoji: {
    fontSize: 20,
    opacity: 0.45,
  },
  tabEmojiActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.mediumGray,
    marginTop: 3,
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
