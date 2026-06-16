import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import LoadingSpinner from '../../components/LoadingSpinner';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../../components/Text';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';

const { width } = Dimensions.get('window');
const HEADER_IMAGE_HEIGHT = 380;

interface Vehicle {
  id: string;
  name: string;
  type: string;
  rating: number;
  reviews: number;
  pricePerDay: number;
  emoji: string;
  image: string;
  images: string[];
  location: string;
  about: string;
  fuelType?: string;
  helmet?: string;
  minDuration?: string;
  deposit?: string;
  specs: { label: string; value: string }[];
  partnerId: string;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  created_at?: string;
  user_id?: string;
}

export default function VehicleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [isSaved, setIsSaved] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [reviewsList, setReviewsList] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreListings, setMoreListings] = useState<{ id: string; name: string; price: number; image: string; type: string }[]>([]);

  useEffect(() => {
    if (!id) return;

    const fetchVehicleAndReviews = async () => {
      try {
        const { data: row, error } = await supabase
          .from('listings')
          .select('*')
          .eq('id', id as string)
          .single();

        if (!error && row) {
          const propertyType = row.category || 'Bike';
          const details = row.details || {};
          
          setVehicle({
            id: row.id,
            name: row.title || details.vehicleMake || 'Unknown Vehicle',
            type: propertyType,
            rating: row.rating || 4.8,
            reviews: row.reviews || 0,
            pricePerDay: row.price || 0,
            emoji: propertyType === 'Car' ? '🚗' : '🏍️',
            image: row.images?.[0] || '',
            images: row.images || [],
            location: row.location || row.details?.address || 'Arambol, Goa',
            about: row.description || row.details?.description || '',
            fuelType: details.fuelType || '',
            helmet: details.helmet || '',
            minDuration: details.minDuration || '',
            deposit: details.deposit ? `₹${details.deposit}` : '',
            partnerId: row.partner_id || row.id,
            specs: [
              { label: 'Vehicle Make', value: details.vehicleMake || 'N/A' },
              { label: 'Fuel Type', value: details.fuelType || 'N/A' },
              { label: 'Helmet Provided', value: details.helmet || 'No' },
              { label: 'Security Deposit', value: details.deposit ? `₹${details.deposit}` : 'N/A' },
              { label: 'Min Duration', value: details.minDuration ? `${details.minDuration} Day(s)` : '1 Day' },
            ].filter(s => s.value !== 'N/A'),
          });
        }

        // Fetch dynamic reviews for this item
        const { data: revsData, error: revsError } = await supabase
          .from('reviews')
          .select('*')
          .eq('item_id', id as string)
          .order('created_at', { ascending: false });

        if (!revsError && revsData) {
          setReviewsList(revsData);
        }

        // Fetch more listings by same partner
        if (!error && row?.partner_id) {
          const { data: partnerListings } = await supabase
            .from('listings')
            .select('id, title, price, images, details, category')
            .eq('partner_id', row.partner_id)
            .eq('type', 'rental')
            .eq('is_active', true)
            .neq('id', id as string)
            .limit(6);

          if (partnerListings) {
            setMoreListings(partnerListings.map((l: any) => ({
              id: l.id,
              name: l.title || 'Vehicle',
              price: l.price || 0,
              image: l.images?.[0] || '',
              type: l.category || l.details?.vehicleType || 'Vehicle',
            })));
          }
        }
      } catch (error) {
        console.error('Error fetching vehicle details or reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicleAndReviews();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <LoadingSpinner size="large" color="#16A34A" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.notFoundText}>Vehicle not found</Text>
        <Text style={styles.notFoundSub}>This listing might have been removed or is currently unavailable.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: '#FFFFFF', zIndex: 20 }} />

      {/* ── Image Header ── */}
      <View style={[styles.imageContainer, { position: 'absolute', top: insets.top, left: 0, right: 0, height: HEADER_IMAGE_HEIGHT, zIndex: 0 }]}>
        {vehicle.images.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {vehicle.images.map((img, index) => (
              <View key={index} style={{ width, height: HEADER_IMAGE_HEIGHT }}>
                <ExpoImage
                  source={{ uri: img }}
                  style={styles.image}
                  contentFit="cover"
                />
                <View style={styles.imageOverlay} />
              </View>
            ))}
          </ScrollView>
        ) : vehicle.image ? (
          <View style={{ width, height: HEADER_IMAGE_HEIGHT }}>
            <ExpoImage
              source={{ uri: vehicle.image }}
              style={styles.image}
              contentFit="cover"
            />
            <View style={styles.imageOverlay} />
          </View>
        ) : (
          <View style={[styles.image, styles.fallbackImage]}>
            <Text style={{ fontSize: 80 }}>{vehicle.emoji}</Text>
          </View>
        )}

        {/* Floating Action Buttons */}
        <View style={[styles.floatingHeader, { top: insets.top + 16, zIndex: 10 }]}>
          <TouchableOpacity 
            style={styles.glassButton} 
            onPress={() => router.back()} 
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.floatingRight}>
            <TouchableOpacity style={styles.glassButton} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.glassButton, { marginLeft: 12 }]} 
              onPress={() => setIsSaved(!isSaved)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isSaved ? "heart" : "heart-outline"} 
                size={22} 
                color={isSaved ? "#EF4444" : "#FFFFFF"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        style={[styles.scroll, { zIndex: 1 }]} 
        contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_IMAGE_HEIGHT + insets.top - 30 }]} 
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Content Container (Overlapping Image) ── */}
        <View style={styles.contentContainer}>
          
          {/* Title & Type */}
          <Animated.View style={styles.headerSection} entering={FadeInDown.delay(100).springify()}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{vehicle.type.toUpperCase()}</Text>
            </View>
            <Text style={styles.vehicleName}>{vehicle.name}</Text>
            
            <View style={styles.metaRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={14} color="#FFFFFF" />
                <Text style={styles.ratingTextMain}>
                  {vehicle.rating > 0 ? vehicle.rating.toFixed(1) : 'New'}
                </Text>
              </View>
              {vehicle.rating > 0 && (
                <Text style={styles.reviewCount}>({vehicle.reviews} reviews)</Text>
              )}
              
              {vehicle.location ? (
                <>
                  <View style={styles.metaDot} />
                  <Ionicons name="location" size={14} color="#6B7280" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {vehicle.location}
                  </Text>
                </>
              ) : null}
            </View>
          </Animated.View>

          {/* ── Highlights Grid ── */}
          <Animated.View style={styles.highlightsWrapper} entering={FadeInDown.delay(200).springify()}>
            <Text style={styles.sectionTitle}>Key features</Text>
            <View style={styles.highlightsGrid}>
              {!!vehicle.fuelType && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="water" size={22} color="#16A34A" />
                  </View>
                  <Text style={styles.highlightLabel}>Fuel Type</Text>
                  <Text style={styles.highlightValue}>{vehicle.fuelType}</Text>
                </View>
              )}
              {!!vehicle.helmet && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="shield-checkmark" size={22} color="#3B82F6" />
                  </View>
                  <Text style={styles.highlightLabel}>Helmet</Text>
                  <Text style={styles.highlightValue}>{vehicle.helmet}</Text>
                </View>
              )}
              {!!vehicle.minDuration && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="time" size={22} color="#8B5CF6" />
                  </View>
                  <Text style={styles.highlightLabel}>Min. Duration</Text>
                  <Text style={styles.highlightValue}>{vehicle.minDuration} Day(s)</Text>
                </View>
              )}
              {!!vehicle.deposit && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="wallet" size={22} color="#F59E0B" />
                  </View>
                  <Text style={styles.highlightLabel}>Deposit</Text>
                  <Text style={styles.highlightValue}>{vehicle.deposit}</Text>
                </View>
              )}
            </View>
            
            {/* Fallback if no highlights */}
            {(!vehicle.fuelType && !vehicle.helmet && !vehicle.minDuration && !vehicle.deposit) && (
              <Text style={styles.emptyText}>Standard vehicle conditions apply.</Text>
            )}
          </Animated.View>

          {/* ── About Section ── */}
          {vehicle.about ? (
            <Animated.View style={styles.section} entering={FadeInDown.delay(300).springify()}>
              <Text style={styles.sectionTitle}>About this vehicle</Text>
              <Text style={styles.aboutText}>{vehicle.about}</Text>
            </Animated.View>
          ) : null}

          {/* ── Specifications ── */}
          {vehicle.specs && vehicle.specs.length > 0 && (
            <Animated.View style={styles.section} entering={FadeInDown.delay(400).springify()}>
              <Text style={styles.sectionTitle}>Specifications</Text>
              <View style={styles.amenitiesList}>
                {vehicle.specs.map((item, index) => (
                  <View key={index} style={styles.amenityItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={styles.amenityText}>{item.label}: {item.value}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* ── Photo Gallery ── */}
          {vehicle.images && vehicle.images.length > 0 && (
            <Animated.View style={styles.section} entering={FadeInDown.delay(500).springify()}>
              <Text style={styles.sectionTitle}>Photo Gallery</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.galleryContainer}
              >
                {vehicle.images.map((img: string, index: number) => (
                  <ExpoImage 
                    key={index} 
                    source={{ uri: img }} 
                    style={styles.galleryImage} 
                    contentFit="cover" 
                  />
                ))}
              </ScrollView>
            </Animated.View>
          )}
             
          {/* ── More from this Partner ── */}
          {moreListings.length > 0 && (
            <Animated.View style={styles.section} entering={FadeInDown.delay(600).springify()}>
              <Text style={styles.sectionTitle}>More from this partner</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.moreListingsScroll}
              >
                {moreListings.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.moreCard}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/more/vehicle', params: { id: item.id } })}
                  >
                    {item.image ? (
                      <ExpoImage
                        source={{ uri: item.image }}
                        style={styles.moreCardImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.moreCardImage, styles.moreCardImagePlaceholder]}>
                        <Text style={styles.moreCardEmoji}>{item.type === 'Car' ? '🚗' : item.type === 'Scooty' ? '🛵' : '🏍️'}</Text>
                      </View>
                    )}
                    <View style={styles.moreCardBody}>
                      <Text style={styles.moreCardName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.moreCardPrice}>₹{item.price}<Text style={styles.moreCardPerDay}>/day</Text></Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* ── Guest Reviews ── */}
          <Animated.View style={styles.section} entering={FadeInDown.delay(700).springify()}>
            <Text style={styles.sectionTitle}>Guest Reviews</Text>
            <View style={styles.reviewsList}>
              {reviewsList.length > 0 ? (
                reviewsList.map((item, index) => {
                  const dateStr = item.created_at 
                    ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Recently';
                  return (
                    <View key={item.id || index} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewerAvatar}>
                          <Text style={styles.reviewerInitials}>G</Text>
                        </View>
                        <View style={styles.reviewerInfo}>
                          <Text style={styles.reviewerName}>Guest</Text>
                          <Text style={styles.reviewDate}>{dateStr}</Text>
                        </View>
                        <View style={styles.reviewRating}>
                          <Ionicons name="star" size={14} color="#F59E0B" />
                          <Text style={styles.reviewRatingText}>{item.rating?.toFixed(1) || '5.0'}</Text>
                        </View>
                      </View>
                      <Text style={styles.reviewText}>
                        {item.comment || 'Great experience!'}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyReviewsText}>No reviews yet. Be the first to leave one!</Text>
              )}
            </View>
          </Animated.View>
       

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {/* ── Bottom Booking Bar ── */}
      <View style={[styles.bottomBarWrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.bottomBar}>
          <View style={styles.priceContainer}>
            {vehicle.pricePerDay > 0 ? (
              <>
                <Text style={styles.priceLabel}>Price</Text>
                <Text style={styles.priceText}>
                  ₹{vehicle.pricePerDay.toLocaleString('en-IN')} <Text style={styles.perDay}>/ day</Text>
                </Text>
                <Text style={styles.priceSubtext}>Taxes & fees not included</Text>
              </>
            ) : (
              <Text style={styles.priceText}>Price on request</Text>
            )}
          </View>
          
          <TouchableOpacity
            style={styles.bookButton}
            activeOpacity={0.8}
            onPress={() => {
              if (vehicle.pricePerDay > 0) {
                router.push({
                  pathname: '/more/checkout',
                  params: {
                    bookingType: 'vehicle',
                    itemId: vehicle.id,
                    itemName: vehicle.name,
                    pricePerUnit: String(vehicle.pricePerDay),
                    partnerId: vehicle.partnerId,
                    unitLabel: 'day',
                    guideCity: vehicle.location || '',
                  },
                });
              }
            }}
          >
            <Text style={styles.bookButtonText}>Request Booking</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  notFoundText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
  },
  notFoundSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goBackText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 16,
  },

  // Scroll Content
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Image Header
  imageContainer: {
    width: width,
    height: HEADER_IMAGE_HEIGHT,
    backgroundColor: '#1F2937',
    position: 'relative',
  },
  image: {
    width: width,
    height: HEADER_IMAGE_HEIGHT,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  fallbackImage: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  floatingRight: {
    flexDirection: 'row',
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // Content Container
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -30,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  
  // Header Section
  headerSection: {
    marginBottom: 28,
  },
  typeBadge: {
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  vehicleName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 34,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingTextMain: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 4,
  },
  reviewCount: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 10,
  },
  locationText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
    flex: 1,
  },

  // General Section
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },

  // Highlights Grid
  highlightsWrapper: {
    marginBottom: 32,
  },
  highlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  highlightCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  highlightIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  highlightLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },

  // About Section
  aboutText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4B5563',
  },

  // Amenities
  amenitiesList: {
    gap: 12,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amenityText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    marginLeft: 12,
  },
  
  // Gallery
  galleryContainer: {
    gap: 12,
    paddingVertical: 8,
  },
  galleryImage: {
    width: 240,
    height: 160,
    borderRadius: 12,
  },

  bottomSpacer: {
    height: 120, // space for bottom bar
  },

  // Bottom Booking Bar
  bottomBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  priceText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  perDay: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  priceSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    textDecorationLine: 'underline',
  },
  bookButton: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Reviews
  reviewsList: {
    gap: 16,
  },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reviewRatingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 4,
  },
  reviewText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  emptyReviewsText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  moreListingsScroll: {
    gap: 12,
    paddingRight: 4,
  },
  moreCard: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  moreCardImage: {
    width: '100%',
    height: 100,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  moreCardImagePlaceholder: {
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreCardEmoji: {
    fontSize: 36,
  },
  moreCardBody: {
    padding: 10,
    gap: 4,
  },
  moreCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
  },
  moreCardPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16A34A',
  },
  moreCardPerDay: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6B7280',
  },
});
