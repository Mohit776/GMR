import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize } from '../../constants/theme';
import { adminSupabase } from '../../services/adminSupabase';
import { supabase } from '../../services/supabase';
import { Image } from 'expo-image';
import { ChevronRight, MapPin, Briefcase, Star, Activity } from 'lucide-react-native';

const db = adminSupabase ?? supabase;

export default function AdminPartners() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const { data, error } = await db
        .from('users')
        .select('*')
        .in('role', ['guide', 'hotel', 'rental'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (err: any) {
      console.warn('Error fetching partners:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderPartner = ({ item }: { item: any }) => {
    const isApproved = item.is_onboarded;
    const profile = item.profile_data || {};
    
    let RoleIcon = Briefcase;
    if (item.role === 'hotel') RoleIcon = Briefcase; // Change to hotel icon if available, reusing Briefcase for now
    
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/(admin)/partner-detail', params: { id: item.id } })}
        activeOpacity={0.7}
      >
        <Image
          source={item.photo_url ? { uri: item.photo_url } : require('../../assets/images/placeholder-avatar.png')}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.cardContent}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name || profile?.businessName || 'Unnamed Partner'}
            </Text>
            {isApproved && (
              <View style={styles.approvedBadge}>
                <Star size={10} color="#fff" />
              </View>
            )}
          </View>

          <View style={styles.roleRow}>
            <RoleIcon size={12} color={Colors.primary} />
            <Text style={styles.roleText}>{(item.role || 'Unknown').toUpperCase()}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={[styles.statusText, { color: isApproved ? Colors.success : '#F59E0B' }]}>
              {isApproved ? 'Active' : 'Pending'}
            </Text>
          </View>

          <View style={styles.locationRow}>
            <MapPin size={12} color={Colors.textLight} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.city || profile?.city || 'Location not set'}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color={Colors.border} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Partners Directory</Text>
        <Text style={styles.headerSubtitle}>Manage guides, hotels, and rentals</Text>
      </View>

      {!adminSupabase && (
        <View style={styles.warningBanner}>
          <Activity size={16} color="#B45309" />
          <Text style={styles.warningText}>Service key missing. Missing data.</Text>
        </View>
      )}

      {loading && partners.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={partners}
          keyExtractor={(item) => item.id}
          renderItem={renderPartner}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPartners} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No partners found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
  },
  warningText: { flex: 1, fontSize: 13, color: '#B45309', fontWeight: '500' },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Spacing.md,
    backgroundColor: '#F1F5F9',
  },
  cardContent: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  approvedBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  roleText: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginLeft: 4, letterSpacing: 0.5 },
  dot: { fontSize: 12, color: Colors.textLight, marginHorizontal: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationText: { fontSize: 13, color: Colors.textMuted, marginLeft: 4 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: '500' },
});
