import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize } from '../../constants/theme';
import { adminSupabase } from '../../services/adminSupabase';
import { supabase } from '../../services/supabase';
import { Calendar, User, MapPin, RefreshCw, Activity, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react-native';

const db = adminSupabase ?? supabase;

type AdminBooking = {
  id: string;
  created_at: string;
  status: string;
  pre_payment_status: string;
  price: number;
  amount: number;
  date: string;
  guest_name: string;
  user_id: string;
  partner_id: string;
  type: string;
  item_name: string;
  city: string;
  note: string;
};

const STATUS_CONFIG: Record<string, { color: string, icon: any }> = {
  confirmed: { color: Colors.success, icon: CheckCircle2 },
  pending:   { color: '#F59E0B', icon: Clock },
  cancelled: { color: Colors.error, icon: XCircle },
  completed: { color: '#3B82F6', icon: FileText },
};

export default function AdminBookings() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const FILTERS = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const { data, error } = await db
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (err: any) {
      console.warn('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  const renderBooking = ({ item }: { item: AdminBooking }) => {
    const statusObj = STATUS_CONFIG[item.status] || { color: Colors.textLight, icon: FileText };
    const StatusIcon = statusObj.icon;
    const price = item.price ?? item.amount ?? 0;
    const formattedPrice = Number(price).toLocaleString('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0,
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Calendar size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guestName}>{item.guest_name || 'Guest Traveler'}</Text>
            <Text style={styles.itemName}>{item.item_name || item.type?.toUpperCase() || 'Booking'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.price}>{formattedPrice}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusObj.color + '15' }]}>
              <StatusIcon size={12} color={statusObj.color} style={{ marginRight: 4 }} />
              <Text style={[styles.statusText, { color: statusObj.color }]}>{(item.status || '').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <Calendar size={14} color={Colors.textLight} />
            <Text style={styles.infoText}>{item.date || item.created_at?.split('T')[0]}</Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={14} color={Colors.textLight} />
            <Text style={styles.infoText}>{item.city || 'Location not provided'}</Text>
          </View>
          <View style={styles.infoRow}>
            <User size={14} color={Colors.textLight} />
            <Text style={styles.infoText} numberOfLines={1}>User: {item.user_id?.substring(0, 12)}...</Text>
          </View>
        </View>

        {item.note ? (
          <View style={styles.noteContainer}>
            <Text style={styles.note} numberOfLines={2}>"{item.note}"</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Title Header */}
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle}>All Bookings</Text>
        <Text style={styles.headerSubtitle}>Manage and track all guest reservations</Text>
      </View>

      {/* Filter row */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Warning Banner */}
      {!adminSupabase && (
        <View style={styles.warningBanner}>
          <Activity size={16} color="#B45309" />
          <Text style={styles.warningText}>Service key missing. Missing data.</Text>
        </View>
      )}

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          Showing {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {loading && filtered.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchBookings} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No {filter !== 'all' ? filter : ''} bookings found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  headerTitleContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
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
  filterContainer: {
    backgroundColor: Colors.white,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterScroll: {
    paddingHorizontal: Spacing.xl,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.white },
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
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  statsText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  itemName: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  price: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'right' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  statusText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: Spacing.md },
  infoGrid: { gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  noteContainer: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
  },
  note: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: '500' },
});
