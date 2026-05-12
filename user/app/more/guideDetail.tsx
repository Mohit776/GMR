import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Text } from '../../components/Text';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { VideoView, useVideoPlayer } from 'expo-video';

const { width } = Dimensions.get('window');
const HEADER_IMAGE_HEIGHT = 380;

interface GuideListing {
  id: string;
  title: string;
  description: string;
  price: string | number;
  location: string;
  images: string[];
  details: any;
}

interface Guide {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  location: string;
  experience: string;
  about: string;
  languages: string;
  specialties: string[];
  price: number;
  perHourRate: number;
  isAvailable: boolean;
  image: string;
  images: string[];
  listings: GuideListing[];
  isApproved: boolean;
  isOnline: boolean;
  city: string;
  demoVideo: string;
}

export default function GuideDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [isSaved, setIsSaved] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [videoPlaying, setVideoPlaying] = useState(false);

  // expo-video player — initialised with empty URI, updated when guide loads
  const videoPlayer = useVideoPlayer('', player => {
    player.loop = false;
  });

  useEffect(() => {
    if (!id) return;

    const fetchGuide = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', id as string)
          .single();

        if (error) throw error;

        const { data: listingsData } = await supabase
          .from('listings')
          .select('*')
          .eq('partner_id', id as string)
          .eq('type', 'guide')
          .eq('is_active', true);

        let listingImages: string[] = [];
        let parsedListings: GuideListing[] = [];
        
        if (listingsData && listingsData.length > 0) {
          parsedListings = listingsData.map(item => {
            let detailsObj = {};
            try {
              detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {});
            } catch (e) {}

            let parsedImages: string[] = [];
            if (Array.isArray(item.images)) {
              parsedImages = item.images;
            } else if (typeof item.images === 'string') {
              try {
                const parsed = JSON.parse(item.images);
                if (Array.isArray(parsed)) parsedImages = parsed;
              } catch (e) {}
            }

            return {
              id: item.id,
              title: item.title,
              description: item.description,
              price: item.price,
              location: item.location,
              images: parsedImages,
              details: detailsObj,
            };
          });
          
          parsedListings.forEach(listing => {
            if (listing.images && listing.images.length > 0) {
              listingImages = [...listingImages, ...listing.images];
            }
          });
        }

        if (data) {
          let profileData = data.profile_data || {};
          if (typeof profileData === 'string') {
             try { profileData = JSON.parse(profileData); } catch (e) { profileData = {}; }
          }

          const perHourRate = parseFloat(profileData.per_hour_rate) || 0;
          const profilePrice = parseInt(profileData.price_per_day) || 0;
          const firstListingPrice = parsedListings.length > 0 ? (Number(parsedListings[0].price) || 0) : 0;
          const effectivePrice = perHourRate > 0 ? perHourRate : (profilePrice > 0 ? profilePrice : firstListingPrice);
          const effectiveAbout = profileData.bio || (parsedListings.length > 0 ? parsedListings[0].description : '') || '';
          const effectiveLocation = profileData.location || (parsedListings.length > 0 ? parsedListings[0].location : '') || '';
          const guideCity = (data.city || profileData.city || effectiveLocation || '').trim();

          const videoUrl = data.kyc_video_url || profileData.demo_video || profileData.kycVideoUrl || '';
          if (videoUrl) {
            videoPlayer.replace({ uri: videoUrl });
          }

          setGuide({
            id: data.id,
            name: data.name || 'Anonymous Guide',
            rating: data.rating || 0,
            reviews: data.reviews || 0,
            location: effectiveLocation,
            experience: profileData.experience ? `${profileData.experience}+ Years` : '',
            about: effectiveAbout,
            languages: Array.isArray(profileData.languages) ? profileData.languages.join(', ') : (profileData.languages || ''),
            specialties: Array.isArray(profileData.specialisations) ? profileData.specialisations : (profileData.specialisations ? String(profileData.specialisations).split(',').map((s: string) => s.trim()) : []),
            price: effectivePrice,
            perHourRate: perHourRate,
            isAvailable: profileData.is_available !== false,
            image: profileData.profile_image || data.profile_image || data.photo_url || '',
            images: listingImages,
            listings: parsedListings,
            isApproved: data.is_approved === true,
            isOnline: data.is_online === true,
            city: guideCity,
            demoVideo: videoUrl,
          });
        }
      } catch (error: any) {
        console.error('Error fetching guide details:', error);
        setErrorMsg(error.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchGuide();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  if (!guide) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Ionicons name="search-outline" size={64} color="#D1D5DB" />
        <Text style={styles.notFoundText}>Guide not found</Text>
        <Text style={styles.notFoundSub}>
          {errorMsg ? errorMsg : 'This guide might have been removed or is currently unavailable.'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Explore other guides</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.imageContainer}>
          {guide.image ? (
            <View style={{ width, height: HEADER_IMAGE_HEIGHT }}>
              <ExpoImage
                source={{ uri: guide.image }}
                style={styles.image}
                contentFit="cover"
              />
              <View style={styles.imageOverlay} />
            </View>
          ) : (
            <View style={[styles.image, styles.fallbackImage]}>
              <Ionicons name="person" size={80} color="#9CA3AF" />
            </View>
          )}

          <View style={[styles.floatingHeader, { top: Math.max(insets.top, 20) }]}>
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

        <View style={styles.contentContainer}>
          <View style={styles.headerSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>LOCAL GUIDE</Text>
              </View>
              {guide.isApproved && (
                <View style={[styles.typeBadge, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={[styles.typeText, { color: '#1D4ED8' }]}>VERIFIED</Text>
                </View>
              )}
              <View style={[styles.typeBadge, { backgroundColor: guide.isAvailable ? '#DCFCE7' : '#FEE2E2' }]}>
                <Text style={[styles.typeText, { color: guide.isAvailable ? '#15803D' : '#DC2626' }]}>
                  {guide.isAvailable ? '● AVAILABLE' : '● UNAVAILABLE'}
                </Text>
              </View>
            </View>
            
            <View style={styles.nameRow}>
              <Text style={styles.guideName}>{guide.name}</Text>
              {guide.isOnline && (
                <View style={styles.onlineBadge}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Online</Text>
                </View>
              )}
            </View>
            
            <View style={styles.metaRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={14} color="#FFFFFF" />
                <Text style={styles.ratingTextMain}>
                  {guide.rating > 0 ? guide.rating.toFixed(1) : 'New'}
                </Text>
              </View>
              {guide.rating > 0 && (
                <Text style={styles.reviewCount}>({guide.reviews} reviews)</Text>
              )}
              
              {guide.location ? (
                <>
                  <View style={styles.metaDot} />
                  <Ionicons name="location" size={14} color="#6B7280" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {guide.location}
                  </Text>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.highlightsWrapper}>
            <Text style={styles.sectionTitle}>Guide Overview</Text>
            <View style={styles.highlightsGrid}>
              {!!guide.experience && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="time" size={22} color="#16A34A" />
                  </View>
                  <Text style={styles.highlightLabel}>Experience</Text>
                  <Text style={styles.highlightValue}>{guide.experience}</Text>
                </View>
              )}
              {!!guide.languages && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightIconBg}>
                    <Ionicons name="language" size={22} color="#3B82F6" />
                  </View>
                  <Text style={styles.highlightLabel}>Languages</Text>
                  <Text style={styles.highlightValue} numberOfLines={2}>{guide.languages}</Text>
                </View>
              )}
              {guide.perHourRate > 0 && (
                <View style={styles.highlightCard}>
                  <View style={[styles.highlightIconBg, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="cash" size={22} color="#D97706" />
                  </View>
                  <Text style={styles.highlightLabel}>Hourly Rate</Text>
                  <Text style={styles.highlightValue}>₹{guide.perHourRate.toLocaleString('en-IN')}/hr</Text>
                </View>
              )}
              <View style={styles.highlightCard}>
                <View style={[styles.highlightIconBg, { backgroundColor: guide.isAvailable ? '#DCFCE7' : '#FEE2E2' }]}>
                  <Ionicons name={guide.isAvailable ? 'checkmark-circle' : 'close-circle'} size={22} color={guide.isAvailable ? '#16A34A' : '#EF4444'} />
                </View>
                <Text style={styles.highlightLabel}>Status</Text>
                <Text style={[styles.highlightValue, { color: guide.isAvailable ? '#15803D' : '#DC2626' }]}>
                  {guide.isAvailable ? 'Available' : 'Unavailable'}
                </Text>
              </View>
            </View>
          </View>

          {guide.specialties && guide.specialties.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specializes In</Text>
              <View style={styles.chipsContainer}>
                {guide.specialties.map((item: string, index: number) => (
                  <View key={index} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {guide.about ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.aboutText}>{guide.about}</Text>
            </View>
          ) : null}

          {guide.images && guide.images.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gallery</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.galleryContainer}
              >
                {guide.images.map((img: string, index: number) => (
                  <ExpoImage 
                    key={index} 
                    source={{ uri: img }} 
                    style={styles.galleryImage} 
                    contentFit="cover" 
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Demo Video ── */}
          {!!guide.demoVideo && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Demo Video</Text>
              <View style={styles.videoWrapper}>
                {!videoPlaying ? (
                  <TouchableOpacity
                    style={styles.videoThumbContainer}
                    activeOpacity={0.85}
                    onPress={() => {
                      videoPlayer.play();
                      setVideoPlaying(true);
                    }}
                  >
                    {guide.image ? (
                      <ExpoImage
                        source={{ uri: guide.image }}
                        style={styles.videoThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.videoThumb, { backgroundColor: '#1F2937' }]} />
                    )}
                    <View style={styles.videoOverlay} />
                    <View style={styles.playButtonCircle}>
                      <Ionicons name="play" size={28} color="#FFFFFF" />
                    </View>
                    <View style={styles.videoDemoTag}>
                      <Ionicons name="videocam" size={12} color="#FFFFFF" />
                      <Text style={styles.videoDemoTagText}>Demo Video</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.videoPlayerContainer}>
                    <VideoView
                      player={videoPlayer}
                      style={styles.videoPlayer}
                      contentFit="contain"
                      nativeControls
                      allowsFullscreen
                      allowsPictureInPicture={false}
                    />
                    <TouchableOpacity
                      style={styles.videoCloseBtn}
                      onPress={() => {
                        videoPlayer.pause();
                        setVideoPlaying(false);
                      }}
                    >
                      <Ionicons name="close-circle" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {guide.listings && guide.listings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tours & Packages</Text>
              {guide.listings.map((listing, idx) => (
                <View key={idx} style={styles.listingCard}>
                  {listing.images && listing.images.length > 0 && (
                    <ExpoImage 
                      source={{ uri: listing.images[0] }} 
                      style={styles.listingImage}
                      contentFit="cover" 
                    />
                  )}
                  <View style={styles.listingContent}>
                    <Text style={styles.listingTitle}>{listing.title}</Text>
                    {listing.details?.duration && (
                      <View style={styles.listingDetailRow}>
                        <Ionicons name="time-outline" size={14} color="#6B7280" />
                        <Text style={styles.listingDetailText}>{listing.details.duration}</Text>
                      </View>
                    )}
                    <Text style={styles.listingDesc} numberOfLines={2}>{listing.description}</Text>
                    <View style={styles.listingFooter}>
                      <Text style={styles.listingPrice}>₹{Number(listing.price).toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
          
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      <View style={[styles.bottomBarWrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.bottomBar}>
          <View style={styles.priceContainer}>
            {guide.price > 0 ? (
              <>
                <Text style={styles.priceLabel}>Rate</Text>
                <Text style={styles.priceText}>
                  ₹{guide.price.toLocaleString('en-IN')} <Text style={styles.perUnit}>/ hour</Text>
                </Text>
                <Text style={styles.priceSubtext}>Price may vary by group size</Text>
              </>
            ) : (
              <Text style={styles.priceText}>Price on request</Text>
            )}
          </View>
          
          <TouchableOpacity
            style={[styles.bookButton, (guide.price === 0 || !guide.isAvailable) && { backgroundColor: '#9CA3AF', shadowOpacity: 0 }]}
            activeOpacity={0.8}
            onPress={() => {
              if (!guide.isAvailable) {
                return;
              }
              if (guide.price > 0) {
                router.push({
                  pathname: '/more/checkout',
                  params: {
                    bookingType: 'guide',
                    itemId: guide.id,
                    itemName: guide.name,
                    pricePerUnit: String(guide.price),
                    partnerId: guide.id,
                    unitLabel: 'hour',
                    guideCity: guide.city,
                  },
                });
              }
            }}
          >
            <Text style={styles.bookButtonText}>{guide.isAvailable ? 'Book Now' : 'Unavailable'}</Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
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
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -30,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  headerSection: {
    marginBottom: 20,
  },
  typeBadge: {
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  guideName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 34,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
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
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4B5563',
  },
  galleryContainer: {
    gap: 12,
    paddingVertical: 8,
  },
  galleryImage: {
    width: 240,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  listingCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 120,
  },
  listingImage: {
    width: 110,
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  listingContent: {
    flex: 1,
    padding: 14,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  listingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  listingDetailText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  listingDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 8,
  },
  listingFooter: {
    marginTop: 'auto',
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16A34A',
  },
  bottomSpacer: {
    height: 120,
  },

  // Video section
  videoWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  videoThumbContainer: {
    height: 210,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumb: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  playButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(22,163,74,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    paddingLeft: 4, // optical center for play icon
  },
  videoDemoTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  videoDemoTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  videoPlayerContainer: {
    height: 240,
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: 240,
  },
  videoCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
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
  perUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  priceSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
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
});
