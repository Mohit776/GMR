import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
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

export default function VehicleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [isSaved, setIsSaved] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchVehicle = async () => {
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
      } catch (error) {
        console.error('Error fetching vehicle details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicle();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#16A34A" />
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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Image Header ── */}
        <View style={styles.imageContainer}>
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

        {/* ── Content Container (Overlapping Image) ── */}
        <View style={styles.contentContainer}>
          
          {/* Title & Type */}
          <View style={styles.headerSection}>
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
          </View>

          {/* ── Highlights Grid ── */}
          <View style={styles.highlightsWrapper}>
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
          </View>

          {/* ── About Section ── */}
          {vehicle.about ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this vehicle</Text>
              <Text style={styles.aboutText}>{vehicle.about}</Text>
            </View>
          ) : null}

          {/* ── Specifications ── */}
          {vehicle.specs && vehicle.specs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specifications</Text>
              <View style={styles.amenitiesList}>
                {vehicle.specs.map((item, index) => (
                  <View key={index} style={styles.amenityItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={styles.amenityText}>{item.label}: {item.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Photo Gallery ── */}
          {vehicle.images && vehicle.images.length > 0 && (
            <View style={styles.section}>
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
            </View>
          )}
          
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
                  },
                });
              }
            }}
          >
            <Text style={styles.bookButtonText}>Book Now</Text>
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
});
