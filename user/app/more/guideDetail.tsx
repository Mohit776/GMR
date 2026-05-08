import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Text } from '../../components/Text';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';

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
  image: string;
  images: string[];
  listings: GuideListing[];
  isApproved: boolean;
  isOnline: boolean;
}

export default function GuideDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [isSaved, setIsSaved] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

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

        // Fetch guide listings
        const { data: listingsData, error: listingsError } = await supabase
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

          // Determine price: prefer profile price_per_day, fall back to first listing price
          const profilePrice = parseInt(profileData.price_per_day) || 0;
          const firstListingPrice = parsedListings.length > 0 ? (Number(parsedListings[0].price) || 0) : 0;
          const effectivePrice = profilePrice > 0 ? profilePrice : firstListingPrice;

          // Determine about: prefer profile bio, fall back to first listing description
          const effectiveAbout = profileData.bio ||
            (parsedListings.length > 0 ? parsedListings[0].description : '') || '';

          // Determine location: prefer profile, fall back to first listing location
          const effectiveLocation = profileData.location ||
            (parsedListings.length > 0 ? parsedListings[0].location : '') || '';

          setGuide({
            id: data.id,
            name: data.name || 'Anonymous Guide',
            rating: data.rating || 0,
            reviews: data.reviews || 0,
            location: effectiveLocation,
            experience: profileData.experience
              ? `${profileData.experience}+ Years`
              : '',
            about: effectiveAbout,
            languages: Array.isArray(profileData.languages)
              ? profileData.languages.join(', ')
              : (profileData.languages || ''),
            specialties: Array.isArray(profileData.specialisations)
              ? profileData.specialisations
              : profileData.specialisations
                ? String(profileData.specialisations).split(',').map((s: string) => s.trim())
                : [],
            price: effectivePrice,
            image: profileData.profile_image || data.profile_image || data.photo_url || '',
            images: listingImages,
            listings: parsedListings,
            isApproved: data.is_approved === true,
            isOnline: data.is_online === true,
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
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
         <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  if (!guide) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
         <Text>Guide not found.</Text>
         {errorMsg ? <Text style={{ marginTop: 10, color: 'red' }}>{errorMsg}</Text> : null}
         <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: '#16A34A' }}>Go Back</Text>
         </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Guide Details</Text>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerBtn, { marginLeft: 8 }]} 
            onPress={() => setIsSaved(!isSaved)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={isSaved ? "heart" : "heart-outline"} 
              size={24} 
              color={isSaved ? "#EF4444" : "#1F2937"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Image Section ── */}
        <View style={styles.imageContainer}>
          {guide.image ? (
            <ExpoImage
              source={{ uri: guide.image }}
              style={styles.image}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.image, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={80} color="#9CA3AF" />
            </View>
          )}
          {/* Verified Badge — only when approved */}
          {guide.isApproved && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>VERIFIED GUIDE</Text>
            </View>
          )}
        </View>

        {/* ── Guide Info ── */}
        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={styles.guideName}>{guide.name}</Text>
            {guide.isOnline && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            )}
          </View>
          
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#FBBF24" />
            <Text style={styles.ratingText}>
              <Text style={styles.ratingNumber}>
                {guide.rating > 0 ? guide.rating.toFixed(1) : 'No rating yet'}
              </Text>
              {guide.rating > 0 ? ` (${guide.reviews} Reviews)` : ''}
            </Text>
          </View>

          {guide.location ? (
            <View style={styles.iconRow}>
              <Ionicons name="location-outline" size={18} color="#6B7280" style={styles.rowIcon} />
              <Text style={styles.rowText}>{guide.location}</Text>
            </View>
          ) : null}

          {guide.experience ? (
            <View style={styles.iconRow}>
              <Ionicons name="time-outline" size={18} color="#6B7280" style={styles.rowIcon} />
              <Text style={styles.rowText}>{guide.experience}</Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          {/* ── About Section ── */}
          {guide.about ? (
            <>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.aboutText}>{guide.about}</Text>
            </>
          ) : null}
          
          {guide.languages ? (
            <Text style={styles.languagesText}>
              <Text style={styles.languagesLabel}>Languages: </Text>
              {guide.languages}
            </Text>
          ) : null}

          {/* ── Specializes In ── */}
          {guide.specialties.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Specializes In</Text>
              <View style={styles.chipsContainer}>
                {guide.specialties.map((item: string, index: number) => (
                  <View key={index} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Gallery Section ── */}
          {guide.images && guide.images.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Gallery</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryContainer}>
                {guide.images.map((imgUrl, idx) => (
                  <ExpoImage 
                    key={idx}
                    source={{ uri: imgUrl }}
                    style={styles.galleryImage}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
            </>
          )}

          {/* ── Tours & Packages ── */}
          {guide.listings && guide.listings.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 32, marginBottom: 16 }]}>Tours & Packages</Text>
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
                    {listing.details?.meetingPoint && (
                      <View style={styles.listingDetailRow}>
                        <Ionicons name="location-outline" size={14} color="#6B7280" />
                        <Text style={styles.listingDetailText}>Meets at {listing.details.meetingPoint}</Text>
                      </View>
                    )}
                    <Text style={styles.listingDesc} numberOfLines={2}>{listing.description}</Text>
                    <View style={styles.listingFooter}>
                      <Text style={styles.listingPrice}>₹{Number(listing.price).toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

        </View>
      </ScrollView>

      {/* ── Bottom Booking Bar ── */}
      <View style={styles.bottomBarContainer}>
        <View style={styles.bottomBar}>
          <View style={styles.priceContainer}>
            {guide.price > 0 ? (
              <>
                <Text style={styles.priceText}>
                  ₹{guide.price.toLocaleString('en-IN')} <Text style={styles.perDay}>/ Day</Text>
                </Text>
                <Text style={styles.priceSubtext}>Price may vary by group size</Text>
              </>
            ) : (
              <Text style={styles.priceText}>Price on request</Text>
            )}
          </View>
          
          <TouchableOpacity
            style={[styles.bookButton, guide.price === 0 && { backgroundColor: '#9CA3AF' }]}
            activeOpacity={0.85}
            onPress={() => {
              router.push({
                pathname: '/more/checkout',
                params: {
                  bookingType: 'guide',
                  itemId: guide.id,
                  itemName: guide.name,
                  pricePerUnit: String(guide.price),
                  partnerId: guide.id,
                  unitLabel: 'day',
                },
              });
            }}
          >
            <Text style={styles.bookButtonText}>Book with {guide.name.split(' ')[0]}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Scroll Content
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 200, // padding for the bottom bar
  },

  // Image Section
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: '#1E88E5', // the blue from the design
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopRightRadius: 8,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Info Section
  infoSection: {
    padding: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  guideName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  ratingNumber: {
    color: '#374151',
    fontWeight: '700',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowIcon: {
    marginRight: 8,
  },
  rowText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 20,
  },

  // About Section
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 12,
  },
  languagesText: {
    fontSize: 14,
    color: '#6B7280',
  },
  languagesLabel: {
    fontWeight: '700',
    color: '#1F2937',
  },

  // Specialties Chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8, // Requires React Native 0.71+, typically fine in modern Expo
  },
  chip: {
    backgroundColor: '#ECFDF5', // Light green background
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    color: '#065F46', // Dark green text
    fontSize: 13,
    fontWeight: '600',
  },

  // Bottom Booking Bar
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 24, 
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    gap: 16, // using gap for spacing between price and button
    // The design has price at top, button at bottom inside a lighter container maybe, or just stacked
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  priceContainer: {
    marginBottom: 4,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  perDay: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  priceSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500', // Making subtext a bit bolder for readability
  },
  bookButton: {
    backgroundColor: '#16A34A', // Forest Green
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Gallery Section
  galleryContainer: {
    gap: 12,
    paddingRight: 20, // Add padding to the end of scroll
  },
  galleryImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  // Listings Section
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
});
