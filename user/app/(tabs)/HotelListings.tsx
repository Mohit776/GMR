import { Text } from '../../components/Text';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import AppBar from '../../components/AppBar';
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
  borderGray: '#d3dbe2',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FeatureTag {
  label: string;
  color: string;
}

interface Hotel {
  id: string;
  name: string;
  type: string;
  rating: number;
  reviews: number;
  pricePerNight: number;
  emoji: string;
  tags: FeatureTag[];
  image?: string;
  location?: string;
  distance?: string;
  originalPrice?: number;
  taxes?: number;
  isGenius?: boolean;
  scoreText?: string;
  roomType?: string;
  cancellationPolicy?: string;
  paymentPolicy?: string;
}

const FILTER_TABS = ['All', 'Hotel', 'Resort', 'Villa', 'Homestay'];

const HotelCard = ({ hotel }: { hotel: Hotel }) => {
  const router = useRouter();

  // Mock data for missing fields to match the image
  const distance = hotel.distance || '1.3 km from centre';
  const originalPrice = hotel.originalPrice || hotel.pricePerNight + 1000;
  const taxes = hotel.taxes || 93;
  const isGenius = hotel.isGenius !== undefined ? hotel.isGenius : true;
  const scoreText = hotel.scoreText || 'Exceptional';
  const roomType = hotel.roomType || '1 bed';
  const cancellationPolicy = hotel.cancellationPolicy || 'Free cancellation';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.95}
      onPress={() => router.push({ pathname: '/more/hotel', params: { id: hotel.id } })}
    >
      {/* Top Image Section */}
      <View style={styles.imageContainer}>
        {hotel.image ? (
          <Image source={{ uri: hotel.image }} style={styles.hotelImage} />
        ) : (
          <View style={styles.emojiContainer}>
            <Text style={styles.hotelEmoji}>{hotel.emoji}</Text>
          </View>
        )}
        
        {/* Gradient Overlay for text readability if we add anything at the bottom of the image, and subtle dark overlay on top */}
        <View style={styles.imageGradientTop} />
        <View style={styles.imageGradientBottom} />

        {/* Top Overlay: Badges and Heart */}
        <View style={styles.imageOverlayTop}>
          {isGenius ? (
             <View style={styles.geniusBadge}>
                <Ionicons name="sparkles" size={12} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.geniusText}>Premium</Text>
             </View>
          ) : <View/>}
          <TouchableOpacity style={styles.heartButton} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Ionicons name="heart-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        {/* Bottom Overlay: Rating and Deal */}
        <View style={styles.imageOverlayBottom}>
          <View style={styles.dealBadge}>
            <Text style={styles.dealText}>Getaway Deal</Text>
          </View>
          <View style={styles.ratingBadgeImage}>
            <Ionicons name="star" size={14} color="#FBBF24" />
            <Text style={styles.ratingTextImage}>{hotel.rating.toFixed(1)}</Text>
          </View>
        </View>
      </View>

      {/* Details Section */}
      <View style={styles.detailsContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.hotelName} numberOfLines={1}>{hotel.name}</Text>
        </View>

        {/* Subtitle: Location and Distance */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.mediumGray} />
          <Text style={styles.locationText} numberOfLines={1}>
            {hotel.location || 'New Delhi'} <Text style={styles.bullet}>•</Text> {distance}
          </Text>
        </View>

        {/* Room Info */}
        <View style={styles.roomInfoRow}>
          <View style={styles.roomInfoTag}>
            <Ionicons name="bed-outline" size={14} color={COLORS.darkGray} />
            <Text style={styles.roomInfoText}>{roomType}</Text>
          </View>
          <View style={[styles.roomInfoTag, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.primary} />
            <Text style={styles.policyText}>{cancellationPolicy}</Text>
          </View>
        </View>

        {/* Footer: Reviews and Price */}
        <View style={styles.footerRow}>
           <View style={styles.reviewsContainer}>
             <Text style={styles.scoreText}>{scoreText}</Text>
             <Text style={styles.reviewCountText}>{hotel.reviews} verified reviews</Text>
           </View>
           <View style={styles.priceContainer}>
             <View style={styles.priceRow}>
               <Text style={styles.originalPrice}>₹{originalPrice.toLocaleString()}</Text>
               <Text style={styles.currentPrice}>₹{hotel.pricePerNight.toLocaleString()}</Text>
             </View>
             <Text style={styles.taxesText}>+ ₹{taxes} taxes / night</Text>
           </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function HotelListingsScreen() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const mapRow = useCallback((doc: any): Hotel => {
    const propertyType = doc.details?.propertyType || 'Hotel';
    return {
      id: doc.id,
      name: doc.title,
      type: propertyType,
      rating: doc.details?.rating || 4.5,
      reviews: doc.details?.reviews || 0,
      pricePerNight: doc.price,
      emoji: doc.details?.emoji || (propertyType === 'Resort' ? '🌴' : propertyType === 'Villa' ? '🏡' : '🏨'),
      image: doc.images?.[0],
      tags: doc.details?.tags || [{ label: 'Verified', color: '#10B981' }],
      location: doc.location?.address || doc.details?.address || '',
    };
  }, []);

  const fetchHotels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('type', 'hotel')
        .eq('is_active', true);

      if (error) {
        console.error('Supabase Fetch Error:', error);
      } else {
        setHotels((data || []).map(mapRow));
      }
    } catch (err) {
      console.error('Unexpected error fetching hotels:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mapRow]);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHotels();
  };

  const filtered = hotels.filter((h) => activeTab === 'All' || h.type === activeTab);

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <AppBar />

      <View style={styles.filterTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsScroll}>
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, activeTab === tab && styles.filterTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.filterTabText, activeTab === tab && styles.filterTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.loaderContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Finding best stays for you...</Text>
        </ScrollView>
      ) : filtered.length === 0 ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          <MaterialCommunityIcons name="bed-empty" size={60} color={COLORS.mediumGray} />
          <Text style={styles.emptyText}>No stays found</Text>
          <Text style={styles.emptySubText}>Try adjusting your filters</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HotelCard hotel={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  filterTabsContainer: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  filterTabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  filterTabActive: {
    backgroundColor: COLORS.darkGray,
    borderColor: COLORS.darkGray,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mediumGray,
  },
  filterTabTextActive: {
    color: COLORS.white,
  },
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.mediumGray,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    gap: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    overflow: 'hidden',
   
  },
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  emojiContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotelImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  imageGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
   // backgroundColor: 'rgba(0,0,0,0.4)',
  },
  hotelEmoji: {
    fontSize: 80,
  },
  imageOverlayTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  geniusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backdropFilter: 'blur(4px)',
  },
  geniusText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heartButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  imageOverlayBottom: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dealBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dealText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  ratingBadgeImage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  ratingTextImage: {
    color: COLORS.darkGray,
    fontWeight: '800',
    fontSize: 14,
  },
  detailsContainer: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  hotelName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkGray,
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  bullet: {
    color: COLORS.borderGray,
    marginHorizontal: 4,
  },
  roomInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  roomInfoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  roomInfoText: {
    fontSize: 13,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  policyText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 16,
  },
  reviewsContainer: {
    flex: 1,
  },
  scoreText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginBottom: 2,
  },
  reviewCountText: {
    fontSize: 12,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  originalPrice: {
    fontSize: 13,
    color: COLORS.mediumGray,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  currentPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.darkGray,
  },
  taxesText: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: 2,
    fontWeight: '500',
  },
});
