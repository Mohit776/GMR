import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Modal,
  FlatList,
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
  image: string;
  images: string[];
  location: string;
  about: string;
  amenities: string[];
  bedConfig?: string;
  maxOccupancy?: string;
  floorView?: string;
  cancellation?: string;
  partnerName?: string;
  partnerDesc?: string;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  created_at?: string;
  user_id?: string;
}

export default function HotelDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [isSaved, setIsSaved] = useState(false);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [reviewsList, setReviewsList] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);
  const [partnerListings, setPartnerListings] = useState<{ id: string; name: string; type: string; price: number; image: string; rating: number }[]>([]);

  useEffect(() => {
    if (!id) return;

    const fetchHotelAndReviews = async () => {
      try {
        // Fetch hotel details
        const { data: row, error } = await supabase
          .from('listings')
          .select('*')
          .eq('id', id as string)
          .single();

        if (!error && row) {
          const propertyType = row.details?.roomType || row.details?.propertyType || 'Hotel Room';

          // Fetch partner name from users table via partner_id
          let partnerName: string | undefined;
          if (row.partner_id) {
            const { data: partnerRow } = await supabase
              .from('users')
              .select('name')
              .eq('id', row.partner_id)
              .single();
            partnerName = partnerRow?.name || undefined;

            // Fetch other listings by the same partner
            const { data: moreRows } = await supabase
              .from('listings')
              .select('id, title, details, price, images')
              .eq('partner_id', row.partner_id)
              .eq('is_active', true)
              .neq('id', row.id)
              .limit(10);

            if (moreRows && moreRows.length > 0) {
              setPartnerListings(
                moreRows.map((r: any) => ({
                  id: r.id,
                  name: r.title || 'Unnamed Stay',
                  type: r.details?.roomType || r.details?.propertyType || 'Stay',
                  price: r.price || 0,
                  image: r.images?.[0] || '',
                  rating: r.details?.rating || 4.5,
                }))
              );
            }
          }

          setHotel({
            id: row.id,
            name: row.title || 'Unknown Stay',
            type: propertyType,
            rating: row.details?.rating || 4.5,
            reviews: row.details?.reviews || 0,
            pricePerNight: row.price || 0,
            emoji: row.details?.emoji || (propertyType === 'Resort' ? '🌴' : propertyType === 'Villa' ? '🏡' : '🏨'),
            image: row.images?.[0] || '',
            images: row.images || [],
            tags: row.details?.tags || [{ label: 'Verified', color: '#10B981' }],
            location: row.location || row.details?.address || '',
            about: row.description || row.details?.description || '',
            amenities: typeof row.details?.roomAmenities === 'string'
              ? row.details.roomAmenities.split(',').map((a: string) => a.trim()).filter(Boolean)
              : Array.isArray(row.details?.amenities) ? row.details.amenities : [],
            bedConfig: row.details?.bedConfig || '',
            maxOccupancy: row.details?.maxOccupancy || '',
            floorView: row.details?.floorView || '',
            cancellation: row.details?.cancellation || '',
            partnerName: partnerName || row.details?.partnerName || row.details?.provider,
            partnerDesc: row.details?.partnerDesc || 'This stay is managed and verified by our premium booking partner, ensuring a seamless experience.',
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
      } catch (error) {
        console.error('Error fetching hotel details or reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHotelAndReviews();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <LoadingSpinner size="large" color="#16A34A" />
      </View>
    );
  }

  if (!hotel) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Ionicons name="search-outline" size={64} color="#D1D5DB" />
        <Text style={styles.notFoundText}>Stay not found</Text>
        <Text style={styles.notFoundSub}>This listing might have been removed or is currently unavailable.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Explore other stays</Text>
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
        {hotel.images.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {hotel.images.map((img, index) => (
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
        ) : hotel.image ? (
          <View style={{ width, height: HEADER_IMAGE_HEIGHT }}>
            <ExpoImage
              source={{ uri: hotel.image }}
              style={styles.image}
              contentFit="cover"
            />
            <View style={styles.imageOverlay} />
          </View>
        ) : (
          <View style={[styles.image, styles.fallbackImage]}>
            <Text style={{ fontSize: 80 }}>{hotel.emoji}</Text>
          </View>
        )}
      </View>

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
              <Text style={styles.typeText}>{hotel.type.toUpperCase()}</Text>
            </View>
            <Text style={styles.hotelName}>{hotel.name}</Text>
            
            <View style={styles.metaRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={14} color="#FFFFFF" />
                <Text style={styles.ratingTextMain}>
                  {hotel.rating > 0 ? hotel.rating.toFixed(1) : 'New'}
                </Text>
              </View>
              {hotel.rating > 0 && (
                <Text style={styles.reviewCount}>({hotel.reviews} reviews)</Text>
              )}
              {hotel.location ? (
                <>
                  <View style={styles.metaDot} />
                  <Ionicons name="location" size={14} color="#6B7280" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {hotel.location}
                  </Text>
                </>
              ) : null}
            </View>
          </Animated.View>

          <Animated.View style={styles.highlightsWrapper} entering={FadeInDown.delay(200).springify()}>
            {/* ── Highlights Grid ── */}
            <Text style={styles.sectionTitle}>What's included</Text>
            <View style={styles.highlightsGrid}>
              {!!hotel.maxOccupancy && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="people" size={22} color="#16A34A" />
                  </View>
                  <Text style={styles.highlightLabel}>Guests</Text>
                  <Text style={styles.highlightValue}>Up to {hotel.maxOccupancy}</Text>
                </View>
              )}
              {!!hotel.bedConfig && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="bed" size={22} color="#3B82F6" />
                  </View>
                  <Text style={styles.highlightLabel}>Beds</Text>
                  <Text style={styles.highlightValue}>{hotel.bedConfig}</Text>
                </View>
              )}
              {!!hotel.floorView && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="image" size={22} color="#8B5CF6" />
                  </View>
                  <Text style={styles.highlightLabel}>View</Text>
                  <Text style={styles.highlightValue}>{hotel.floorView}</Text>
                </View>
              )}
              {!!hotel.cancellation && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="shield-checkmark" size={22} color="#F59E0B" />
                  </View>
                  <Text style={styles.highlightLabel}>Cancellation</Text>
                  <Text style={styles.highlightValue}>{hotel.cancellation}</Text>
                </View>
              )}
            </View>
            {(!hotel.maxOccupancy && !hotel.bedConfig && !hotel.floorView && !hotel.cancellation) && (
              <Text style={styles.emptyText}>Standard room configuration applies.</Text>
            )}
          </Animated.View>
          {hotel.about ? (
            <Animated.View style={styles.section} entering={FadeInDown.delay(300).springify()}>
              <Text style={styles.sectionTitle}>About this stay</Text>
              <Text style={styles.aboutText}>{hotel.about}</Text>
            </Animated.View>
          ) : null}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <Animated.View style={styles.section} entering={FadeInDown.delay(400).springify()}>
              <Text style={styles.sectionTitle}>Popular amenities</Text>
              <View style={styles.amenitiesList}>
                {hotel.amenities.map((item: string, index: number) => (
                  <View key={index} style={styles.amenityItem}>
                    <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                    <Text style={styles.amenityText}>{item}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

      
          {hotel.images && hotel.images.length > 0 && (
            <Animated.View style={styles.section} entering={FadeInDown.delay(500).springify()}>
              <Text style={styles.sectionTitle}>Photo Gallery</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.galleryContainer}
              >
                {hotel.images.map((img: string, index: number) => (
                  <TouchableOpacity key={index} activeOpacity={0.8} onPress={() => setFullScreenIndex(index)}>
                    <ExpoImage 
                      source={{ uri: img }} 
                      style={styles.galleryImage} 
                      contentFit="cover" 
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}




              {/* Partner Info */}
          {hotel.partnerName && (
            <Animated.View style={[styles.section, styles.partnerSection]} entering={FadeInDown.delay(600).springify()}>
              <Text style={styles.sectionTitle}>Booking Partner</Text>
              <View style={styles.partnerCard}>
                <View style={styles.partnerIconBg}>
                  <Ionicons name="business" size={24} color="#3B82F6" />
                </View>
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerName}>{hotel.partnerName}</Text>
                  <Text style={styles.partnerDesc}>
                    {hotel.partnerDesc}
                  </Text>
                </View>
                <Ionicons name="shield-checkmark" size={24} color="#10B981" style={styles.partnerBadge} />
              </View>
            </Animated.View>
          )}

          {/* ── More from Partner ── */}
          {partnerListings.length > 0 && hotel?.partnerName && (
            <Animated.View style={styles.section} entering={FadeInDown.delay(700).springify()}>
              <Text style={styles.sectionTitle}>More from {hotel.partnerName}</Text>
              {partnerListings.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.partnerListingCard}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/more/hotel', params: { id: item.id } })}
                >
                  <ExpoImage
                    source={{ uri: item.image }}
                    style={styles.partnerListingImage}
                    contentFit="cover"
                  />
                  <View style={styles.partnerListingInfo}>
                    <Text style={styles.partnerListingName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.partnerListingType}>{item.type}</Text>
                    <View style={styles.partnerListingMeta}>
                      <View style={styles.partnerListingRating}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={styles.partnerListingRatingText}>{item.rating.toFixed(1)}</Text>
                      </View>
                      {item.price > 0 && (
                        <Text style={styles.partnerListingPrice}>₹{item.price.toLocaleString('en-IN')}/night</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* ── Guest Reviews ── */}
          <Animated.View style={styles.section} entering={FadeInDown.delay(800).springify()}>
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
                        "{item.comment || 'Great experience!'}"
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
            {hotel.pricePerNight > 0 ? (
              <>
                <Text style={styles.priceLabel}>Price</Text>
                <Text style={styles.priceText}>
                  ₹{hotel.pricePerNight.toLocaleString('en-IN')} <Text style={styles.perNight}>/ night</Text>
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
              if (hotel.pricePerNight > 0) {
                router.push({
                  pathname: '/more/checkout',
                  params: {
                    bookingType: 'hotel',
                    itemId: hotel.id,
                    itemName: hotel.name,
                    pricePerUnit: String(hotel.pricePerNight),
                    partnerId: hotel.id,
                    unitLabel: 'night',
                    guideCity: hotel.location || '',
                  },
                });
              }
            }}
          >
            <Text style={styles.bookButtonText}>Request Booking</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Full Screen Image Modal ── */}
      <Modal
        visible={fullScreenIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullScreenIndex(null)}
      >
        <View style={styles.fullScreenModal}>
          <TouchableOpacity 
            style={[styles.closeModalButton, { top: Math.max(insets.top, 20) }]} 
            onPress={() => setFullScreenIndex(null)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {fullScreenIndex !== null && hotel.images && (
            <FlatList
              data={hotel.images}
              keyExtractor={(item, index) => index.toString()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={fullScreenIndex}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              renderItem={({ item }) => (
                <View style={{ width, height: '100%', justifyContent: 'center' }}>
                  <ExpoImage 
                    source={{ uri: item }} 
                    style={styles.fullScreenImage} 
                    contentFit="contain" 
                  />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
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
  hotelName: {
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  amenityItem: {
    width: '23%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    borderColor: '#E5E7EB',
  },
  amenityText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Partner Info
  partnerSection: {
    marginTop: 4,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  partnerIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  partnerDesc: {
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },
  partnerBadge: {
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
  perNight: {
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

  // Modal Full Screen Image
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: '100%',
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

  // Partner Listings
  partnerListingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 12,
    overflow: 'hidden',
  },
  partnerListingImage: {
    width: 80,
    height: 80,
    backgroundColor: '#E5E7EB',
  },
  partnerListingInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  partnerListingName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  partnerListingType: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 6,
  },
  partnerListingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  partnerListingRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  partnerListingRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  partnerListingPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
});
