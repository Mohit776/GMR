import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { Text } from '../../components/Text';
// import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AppBar from '../../components/AppBar';

const COLORS = {
  primary: '#16A34A',
  white: '#FFFFFF',
  lightGray: '#F1F5F9',
  darkGray: '#1F2937',
  mediumGray: '#6B7280',
  borderGray: '#d3dbe2',
  onlineDot: '#22C55E',
  skyBlue: '#0EA5E9',
};

const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
};

interface Guide {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  isOnline: boolean;
  verified: boolean;
  specialty?: string;
  profileImage?: string;
}

const StarRating = ({ rating }: { rating: number }) => (
  <View style={styles.starRow}>
    <Ionicons name="star" size={14} color="#FBBF24" />
    <Text style={styles.ratingText}>{rating?.toFixed(1) || '0.0'}</Text>
  </View>
);

export default function AllGuidesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setGuides([]);
      setFetchError('Please sign in to view guides.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fetchGuides = async () => {
      setFetchError(null);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, rating, reviews, is_online, is_approved, profile_data, photo_url')
        .eq('role', 'guide')
        .eq('is_approved', true);

      if (error) {
        setFetchError('Unable to load guides right now. Please try again.');
        console.warn('AllGuides fetch issue:', error.message);
        setGuides([]);
      } else {
        const guidesData: Guide[] = (data || []).map((row) => ({
          id: row.id,
          name: row.name || 'Anonymous',
          rating: row.rating || 0,
          reviews: row.reviews || 0,
          isOnline: row.is_online || false,
          verified: row.is_approved || false,
          specialty: Array.isArray(row.profile_data?.specialisations)
            ? row.profile_data.specialisations.join(', ')
            : (row.profile_data?.specialisations || row.profile_data?.specialty || 'General Guide'),
          profileImage: row.profile_data?.profileImage || row.photo_url || null,
        }));
        setGuides(guidesData);
      }

      setLoading(false);
      setRefreshing(false);
    };

    fetchGuides();
  }, [user, refreshKey]);

  const onRefresh = () => {
    setRefreshing(true);
    setGuides([]);
    setRefreshKey(k => k + 1);
  };

  const filteredGuides = guides.filter(guide => {
    const q = searchText.toLowerCase();
    const nameMatch = (guide.name || '').toLowerCase().includes(q);
    const specialty = typeof guide.specialty === 'string' ? guide.specialty : '';
    const specialtyMatch = specialty.toLowerCase().includes(q);
    return nameMatch || specialtyMatch;
  });

  const renderGuide = ({ item }: { item: Guide }) => (
    <View style={styles.guideCard}>
      {/* Left Side: Large Image with Badge */}
      <View style={styles.guideImageContainer}>
        {item.profileImage ? (
          <ExpoImage source={{ uri: item.profileImage }} style={styles.guideImage} contentFit="cover" />
        ) : (
          <View style={styles.guideImagePlaceholder}>
            <Ionicons name="person" size={40} color={COLORS.mediumGray} style={{ opacity: 0.5 }} />
          </View>
        )}
        {item.verified && (
          <View style={styles.imageVerifiedBadge}>
            <Ionicons name="shield-checkmark" size={10} color={COLORS.white} />
            <Text style={styles.imageVerifiedText}>VERIFIED GUIDE</Text>
          </View>
        )}
      </View>

      {/* Right Side: Info and Actions */}
      <View style={styles.guideInfo}>
        <View style={styles.guideTitleRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.guideNameRow}>
              <Text style={styles.guideName} numberOfLines={1}>{item.name}</Text>
              {item.verified ? (
                <ExpoImage source={require('../../assets/svg/verify-svgrepo-com.svg')} style={{ width: 14, height: 14, tintColor: COLORS.skyBlue }} contentFit="contain" />
              ) : null}
            </View>
            {item.specialty ? (
              <Text style={styles.specialtyText} numberOfLines={2}>{item.specialty}</Text>
            ) : null}
          </View>

          <TouchableOpacity 
            style={styles.bookGuideBtn} 
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/more/guideDetail', params: { id: item.id } })}
          >
            <Text style={styles.bookGuideBtnText}>Book</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.bottomMetaRow}>
          <View style={styles.ratingReviewRow}>
            <StarRating rating={item.rating} />
            <Text style={styles.reviewCount}> ({item.reviews || 0} Reviews)</Text>
          </View>
          {item.isOnline ? (
            <View style={styles.onlineBadgeRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      

  
      {/* Search and Filter */}
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={COLORS.mediumGray} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or specialty..."
            placeholderTextColor={COLORS.mediumGray}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
           <Ionicons name="options-outline" size={22} color={COLORS.darkGray} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
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
        </ScrollView>
      ) : fetchError ? (
        <ScrollView
          contentContainerStyle={styles.emptyStateWrap}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          <Text style={styles.emptyStateTitle}>Could not load guides</Text>
          <Text style={styles.emptyStateText}>{fetchError}</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredGuides}
          keyExtractor={(item) => item.id}
          renderItem={renderGuide}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: COLORS.mediumGray }}>
              No guides found.
            </Text>
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
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  searchFilterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },

  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.darkGray,
  },
  filterBtn: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  guideCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'stretch',
    ...SHADOWS.small,
  },
  guideImageContainer: {
    width: 100,
    height: 120,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    marginRight: 14,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  guideImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageVerifiedBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(22, 163, 74, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    gap: 4,
  },
  imageVerifiedText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  guideInfo: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  guideTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  guideNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guideName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkGray,
    letterSpacing: -0.3,
  },
  specialtyText: {
    fontSize: 13,
    color: COLORS.mediumGray,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderGray,
    marginVertical: 12,
  },
  bottomMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingReviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  reviewCount: {
    fontSize: 12,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  onlineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  bookGuideBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookGuideBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
});
