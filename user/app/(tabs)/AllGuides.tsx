import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Text } from '../../components/Text';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2; // 2-column grid

const COLORS = {
  primary: '#16A34A',
  primaryLight: '#DCFCE7',
  white: '#FFFFFF',
  lightGray: '#F1F5F9',
  darkGray: '#111827',
  mediumGray: '#6B7280',
  borderGray: '#E2E8F0',
  skyBlue: '#0EA5E9',
  star: '#FBBF24',
  cardBg: '#FFFFFF',
};

const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  hourlyRate?: number;
}

const StarRating = ({ rating }: { rating: number }) => (
  <View style={styles.starRow}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Ionicons
        key={s}
        name={s <= Math.round(rating) ? 'star' : 'star-outline'}
        size={11}
        color={COLORS.star}
      />
    ))}
    <Text style={styles.ratingValue}>{rating?.toFixed(1) || '0.0'}</Text>
  </View>
);

const SpecialtyChip = ({ label }: { label: string }) => (
  <View style={styles.chip}>
    <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
  </View>
);

const GuideCard = ({ item, onPress }: { item: Guide; onPress: () => void }) => {
  const specialties: string[] = item.specialty
    ? item.specialty.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2)
    : [];

  return (
    <TouchableOpacity
      style={styles.guideCard}
      activeOpacity={0.92}
      onPress={onPress}
    >
      {/* Cover Photo */}
      <View style={styles.coverContainer}>
        {item.profileImage ? (
          <ExpoImage
            source={{ uri: item.profileImage }}
            style={styles.coverImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="person" size={48} color={COLORS.mediumGray} style={{ opacity: 0.35 }} />
          </View>
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.62)']}
          style={styles.coverGradient}
        />

        {/* Online badge — top right */}
        {item.isOnline && (
          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlinePillText}>Online</Text>
          </View>
        )}

        {/* Name + verified — bottom over gradient */}
        <View style={styles.coverBottom}>
          <View style={styles.nameRow}>
            <Text style={styles.guideName} numberOfLines={1}>{item.name}</Text>
            {item.verified && (
              <Ionicons name="shield-checkmark" size={14} color="#60F5A1" style={{ marginLeft: 4 }} />
            )}
          </View>
          {item.hourlyRate ? (
            <Text style={styles.rateLabel}>From ₹{item.hourlyRate}/hr</Text>
          ) : null}
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.cardBody}>
        {/* Specialty chips */}
        {specialties.length > 0 && (
          <View style={styles.chipsRow}>
            {specialties.map((s, i) => (
              <SpecialtyChip key={i} label={s} />
            ))}
          </View>
        )}

        {/* Rating row */}
        <View style={styles.metaRow}>
          <StarRating rating={item.rating} />
          <Text style={styles.reviewCount}>({item.reviews || 0})</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={onPress}>
          <Text style={styles.ctaBtnText}>View Profile</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.white} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

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
          hourlyRate: row.profile_data?.hourlyRate || row.profile_data?.hourly_rate || null,
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
    setRefreshKey((k) => k + 1);
  };

  const filteredGuides = guides.filter((guide) => {
    const q = searchText.toLowerCase();
    const nameMatch = (guide.name || '').toLowerCase().includes(q);
    const specialty = typeof guide.specialty === 'string' ? guide.specialty : '';
    const specialtyMatch = specialty.toLowerCase().includes(q);
    return nameMatch || specialtyMatch;
  });

  const navigateToGuide = (id: string) =>
    router.push({ pathname: '/more/guideDetail', params: { id } });

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Search + Filter bar */}
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.mediumGray} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search guides or specialties..."
            placeholderTextColor={COLORS.mediumGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.mediumGray} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
          <Ionicons name="options-outline" size={21} color={COLORS.darkGray} />
        </TouchableOpacity>
      </View>

      {/* Results count */}
      {!loading && !fetchError && (
        <Text style={styles.resultsCount}>
          {filteredGuides.length} guide{filteredGuides.length !== 1 ? 's' : ''} available
        </Text>
      )}

      {/* Content */}
      {loading ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
          }
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading guides...</Text>
        </ScrollView>
      ) : fetchError ? (
        <ScrollView
          contentContainerStyle={styles.emptyStateWrap}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
          }
        >
          <Ionicons name="cloud-offline-outline" size={52} color={COLORS.mediumGray} style={{ opacity: 0.5, marginBottom: 12 }} />
          <Text style={styles.emptyStateTitle}>Could not load guides</Text>
          <Text style={styles.emptyStateText}>{fetchError}</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredGuides}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => (
            <GuideCard item={item} onPress={() => navigateToGuide(item.id)} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyStateWrap}>
              <Ionicons name="person-outline" size={52} color={COLORS.mediumGray} style={{ opacity: 0.4, marginBottom: 12 }} />
              <Text style={styles.emptyStateTitle}>No guides found</Text>
              <Text style={styles.emptyStateText}>Try a different search term.</Text>
            </View>
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

  /* ── Search bar ── */
  searchFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.darkGray,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },

  /* ── Results count ── */
  resultsCount: {
    fontSize: 12,
    color: COLORS.mediumGray,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },

  /* ── List ── */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },

  /* ── Card ── */
  guideCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    overflow: 'hidden',
    ...SHADOWS.card,
  },

  /* Cover */
  coverContainer: {
    width: '100%',
    height: 170,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E9EFF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },

  /* Online pill — top right */
  onlinePill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  onlinePillText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },

  /* Name over gradient */
  coverBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guideName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
    flex: 1,
    letterSpacing: -0.2,
  },
  rateLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '600',
    marginTop: 2,
  },

  /* Body */
  cardBody: {
    padding: 10,
    gap: 8,
  },

  /* Chips */
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: CARD_WIDTH - 28,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },

  /* Rating */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginLeft: 3,
  },
  reviewCount: {
    fontSize: 11,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },

  /* CTA */
  ctaBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  ctaBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },

  /* Loading */
  loadingText: {
    color: COLORS.mediumGray,
    marginTop: 12,
    fontSize: 14,
  },

  /* Empty / error */
  emptyStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: COLORS.mediumGray,
    textAlign: 'center',
    lineHeight: 19,
  },
});
