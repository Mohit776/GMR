import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize } from '../../constants/theme';
import { adminSupabase } from '../../services/adminSupabase';
import { supabase } from '../../services/supabase';
import { CreditCard, Calendar, RefreshCw, TrendingUp, Clock, Activity, CheckCircle2 } from 'lucide-react-native';

const db = adminSupabase ?? supabase;

type BookingWithPayment = {
  id: string;
  created_at: string;
  status: string;
  pre_payment_status: string;
  price: number;
  amount: number;
  date: string;
  guest_name: string;
  partner_id: string;
  type: string;
  item_name: string;
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid:             Colors.success,
  awaiting_guide:   '#F59E0B',
  awaiting_payment: '#8B5CF6',
  cancelled:        Colors.error,
};

export default function AdminPayments() {
  const [bookings, setBookings] = useState<BookingWithPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, count: 0 });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await db
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = data || [];
      setBookings(rows);

      // Stats
      let total = 0;
      let pending = 0;
      rows.forEach((b: BookingWithPayment) => {
        const amt = Number(b.price ?? b.amount ?? 0);
        if (b.status === 'completed') total += amt;
        else if (b.status === 'confirmed' || b.status === 'pending') pending += amt;
      });
      setStats({ total, pending, count: rows.length });
    } catch (err: any) {
      console.warn('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatINR = (n: number) =>
    n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  const getPaymentColor = (b: BookingWithPayment) => {
    if (b.status === 'completed') return Colors.success;
    if (b.status === 'cancelled') return Colors.error;
    return PAYMENT_STATUS_COLORS[b.pre_payment_status] || '#F59E0B';
  };

  const getPaymentLabel = (b: BookingWithPayment) => {
    if (b.status === 'completed') return 'PAID';
    if (b.status === 'cancelled') return 'CANCELLED';
    if (b.pre_payment_status === 'paid') return 'PAID';
    if (b.pre_payment_status === 'awaiting_guide') return 'AWAITING GUIDE';
    if (b.pre_payment_status === 'awaiting_payment') return 'AWAITING PMT';
    return b.status?.toUpperCase() || 'UNKNOWN';
  };

  const renderItem = ({ item }: { item: BookingWithPayment }) => {
    const color = getPaymentColor(item);
    const label = getPaymentLabel(item);
    const amt = Number(item.price ?? item.amount ?? 0);

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.iconWrap}>
            <CreditCard size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1, paddingLeft: Spacing.sm }}>
            <Text style={styles.guestName}>{item.guest_name || 'Guest Traveler'}</Text>
            <Text style={styles.subText}>{item.item_name || item.type || 'Booking'} · {item.date || item.created_at?.split('T')[0]}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{formatINR(amt)}</Text>
            <View style={[styles.badge, { backgroundColor: color + '15' }]}>
              {label === 'PAID' && <CheckCircle2 size={10} color={color} style={{ marginRight: 4 }} />}
              <Text style={[styles.badgeText, { color }]}>{label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Calendar size={13} color={Colors.textLight} />
            <Text style={styles.metaText}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          <View style={styles.metaItem}>
            <Users size={13} color={Colors.textLight} />
            <Text style={styles.metaText}>Partner: {item.partner_id?.substring(0, 8)}...</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payments & Revenue</Text>
        <Text style={styles.headerSubtitle}>Monitor system-wide financial transactions</Text>
      </View>

      {!adminSupabase && (
        <View style={styles.warningBanner}>
          <Activity size={16} color="#B45309" />
          <Text style={styles.warningText}>Service key missing. Missing data.</Text>
        </View>
      )}

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrap}>
            <TrendingUp size={20} color={Colors.success} />
          </View>
          <Text style={styles.summaryLabel}>Completed Revenue</Text>
          <Text style={styles.summaryValue}>{formatINR(stats.total)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <Clock size={20} color="#F59E0B" />
          </View>
          <Text style={styles.summaryLabel}>Pending Value</Text>
          <Text style={styles.summaryValue}>{formatINR(stats.pending)}</Text>
        </View>
      </View>

      <View style={styles.statsBar}>
        <Text style={styles.statsText}>{stats.count} transaction records</Text>
      </View>

      {loading && bookings.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPayments} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No payment records found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// Temporary import for Users icon
import { Users } from 'lucide-react-native';

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
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  headerSubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
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
  summaryRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  summaryLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 24, fontWeight: '800', color: Colors.text },
  statsBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  statsText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  guestName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  subText: { fontSize: 13, color: Colors.textMuted, marginTop: 2, fontWeight: '500' },
  amount: { fontSize: 18, fontWeight: '800', color: Colors.text },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  badgeText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: Spacing.md },
  metaRow: { flexDirection: 'row', gap: Spacing.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: '500' },
});
