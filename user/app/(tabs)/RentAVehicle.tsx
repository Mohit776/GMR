import { Text } from '../../components/Text';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

interface Vehicle {
  id: string;
  name: string;
  type: string;
  rating: number;
  reviews: number;
  pricePerDay: number;
  emoji: string;
  tags: FeatureTag[];
  image?: string;
  fuelType?: string;
  helmet?: string;
  minDuration?: string;
  deposit?: string;
  vehicleMake?: string;
}

const FILTER_TABS = ['All', 'Scooty', 'Bike', 'Car'];

// ─── Vehicle Card ──────────────────────────────────────────────────────────────
const VehicleCard = ({ vehicle }: { vehicle: Vehicle }) => {
  const router = useRouter();
  
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => router.push({ pathname: '/more/vehicle', params: { id: vehicle.id } })}
    >
      <View style={styles.cardContent}>
        <View style={styles.vehicleImagePlaceholder}>
          {vehicle.image ? (
            <Image source={{ uri: vehicle.image }} style={styles.vehicleImage} />
          ) : (
            <Text style={styles.vehicleEmoji}>{vehicle.emoji}</Text>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.vehicleName} numberOfLines={1}>
            {vehicle.name}
          </Text>

          <View style={styles.ratingChip}>
            <Text style={styles.starIcon}>⭐</Text>
            <Text style={styles.ratingValue}>{vehicle.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({vehicle.reviews})</Text>
          </View>

          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.priceValue}>₹{vehicle.pricePerDay}</Text>
              <Text style={styles.perDay}>per day</Text>
            </View>
            
            <View style={styles.bookNowBtn}>
              <Text style={styles.bookNowText}>View Details</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function RentAVehicleScreen() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    FILTER_TABS.includes(filter ?? '') ? (filter as string) : 'All'
  );
  const [activeMake, setActiveMake] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('type', 'rental')
        .eq('is_active', true);

      if (error) {
        console.error('Supabase Fetch Error:', error);
      } else {
        const mapRow = (doc: any): Vehicle => {
        const vehicleType = doc.details?.vehicleType || 'Bike';
        return {
          id: doc.id,
          name: doc.title,
          type: vehicleType,
          rating: doc.details?.rating || 4.5,
          reviews: doc.details?.reviews || Math.floor(Math.random() * 50) + 10,
          pricePerDay: doc.price,
          emoji: doc.details?.emoji || (vehicleType === 'Car' ? '🚗' : vehicleType === 'Scooty' ? '🛵' : '🏍️'),
          image: doc.images?.[0],
          tags: doc.details?.tags || [{ label: 'Verified', color: '#10B981' }],
          fuelType: doc.details?.fuelType,
          helmet: doc.details?.helmet,
          minDuration: doc.details?.minDuration,
          deposit: doc.details?.deposit,
          vehicleMake: doc.details?.vehicleMake,
        };
        };
        setVehicles((data || []).map(mapRow));
      }
    } catch (err) {
      console.error('Unexpected error fetching vehicles:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVehicles();
  };

  const uniqueMakes = ['All', ...Array.from(new Set(
    vehicles.map(v => v.vehicleMake).filter(Boolean) as string[]
  )).sort()];

  const filtered = vehicles.filter((v) => {
    if (activeTab !== 'All' && v.type !== activeTab) return false;
    if (activeMake !== 'All' && v.vehicleMake !== activeMake) return false;
    return true;
  });

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <AppBar />

      <View style={styles.filterTabsContainer}>
        {/* Vehicle type filter */}
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

        {/* Vehicle make filter — only shown when makes exist */}
        {uniqueMakes.length > 1 && (
          <View style={styles.makeFilterRow}>
            <MaterialCommunityIcons name="car-cog" size={14} color={COLORS.mediumGray} style={{ marginRight: 4 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.makeFilterScroll}>
              {uniqueMakes.map((make) => (
                <TouchableOpacity
                  key={make}
                  style={[styles.makeTab, activeMake === make && styles.makeTabActive]}
                  onPress={() => setActiveMake(make)}
                >
                  <Text style={[styles.makeTabText, activeMake === make && styles.makeTabTextActive]}>
                    {make === 'All' ? 'All Makes' : make}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
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
          <Text style={styles.loaderText}>Finding best vehicles for you...</Text>
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
          <MaterialCommunityIcons name="car-off" size={60} color={COLORS.mediumGray} />
          <Text style={styles.emptyText}>No vehicles found</Text>
          <Text style={styles.emptySubText}>Try adjusting your filters</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VehicleCard vehicle={item} />}
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
    backgroundColor: COLORS.white,
  },
  filterTabsContainer: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  makeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  makeFilterScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 16,
  },
  makeTab: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  makeTabActive: {
    backgroundColor: '#FFF7ED',
    borderColor: COLORS.orange,
  },
  makeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mediumGray,
  },
  makeTabTextActive: {
    color: COLORS.orange,
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
    backgroundColor: COLORS.lightGray,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: '#DCFCE7',
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.mediumGray,
  },
  filterTabTextActive: {
    color: COLORS.primary,
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
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
   
    borderWidth: 2,
    borderColor: COLORS.borderGray,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  vehicleImagePlaceholder: {
    width: 110,
    height: 110,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  vehicleEmoji: {
    fontSize: 48,
  },
  cardBody: {
    flex: 1,
    paddingLeft: 16,
    justifyContent: 'space-between',
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  starIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  ratingCount: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginLeft: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  perDay: {
    fontSize: 12,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  bookNowBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bookNowText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
