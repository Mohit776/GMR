import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize } from '../../constants/theme';
import { adminSupabase } from '../../services/adminSupabase';
import { supabase } from '../../services/supabase';
import { Bell, BellOff, RefreshCw, Calendar, Users, CreditCard } from 'lucide-react-native';

const db = adminSupabase ?? supabase;

type AdminNotification = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string;
  user_id: string;
  is_read: boolean;
  data: any;
};

type BookingSummary = {
  id: string;
  created_at: string;
  status: string;
  guest_name: string;
  partner_id: string;
  price: number;
  amount: number;
  type: string;
};

const EVENT_COLOR: Record<string, string> = {
  new_booking:    '#3B82F6',
  booking_update: '#F59E0B',
  payment:        '#10B981',
  partner_signup: '#8B5CF6',
};

const EVENT_ICON: Record<string, any> = {
  new_booking:    Calendar,
  booking_update: Calendar,
  payment:        CreditCard,
  partner_signup: Users,
};

export default function AdminNotifications() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    try {
      setLoading(true);

      // Pull recent bookings as the activity feed
      const [bookingsRes, partnersRes] = await Promise.all([
        db.from('bookings').select('id, created_at, status, guest_name, partner_id, price, amount, type, item_name, city')
          .order('created_at', { ascending: false })
          .limit(30),
        db.from('users').select('id, created_at, name, role, email')
          .in('role', ['guide', 'hotel', 'rental'])
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const bookingEvents = (bookingsRes.data || []).map((b: any) => ({
        id: `booking_${b.id}`,
        created_at: b.created_at,
        type: b.status === 'confirmed' ? 'booking_update' : 'new_booking',
        title: b.status === 'completed'
          ? `Booking Completed`
          : b.status === 'confirmed'
          ? `Booking Confirmed`
          : b.status === 'cancelled'
          ? `Booking Cancelled`
          : `New Booking Request`,
        body: `${b.guest_name || 'Guest'} · ${b.item_name || b.type || 'Trip'} · ₹${Number(b.price ?? b.amount ?? 0).toLocaleString('en-IN')}`,
        sub: b.city ? `📍 ${b.city}` : null,
        status: b.status,
        raw: b,
      }));

      const partnerEvents = (partnersRes.data || []).map((p: any) => ({
        id: `partner_${p.id}`,
        created_at: p.created_at,
        type: 'partner_signup',
        title: `New Partner Registered`,
        body: `${p.name || p.email || 'Unknown'} joined as ${p.role?.toUpperCase()}`,
        sub: null,
        raw: p,
      }));

      // Merge & sort
      const all = [...bookingEvents, ...partnerEvents].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setEvents(all);
    } catch (err: any) {
      console.error('Admin activity error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivity();
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const renderItem = ({ item }: { item: any }) => {
    const color = EVENT_COLOR[item.type] || Colors.primary;
    const Icon = EVENT_ICON[item.type] || Bell;

    return (
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
          <Icon size={20} color={color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.cardBody2} numberOfLines={2}>{item.body}</Text>
          {item.sub ? <Text style={styles.cardSub}>{item.sub}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header stats */}
      <View style={styles.header}>
        <View style={styles.statPill}>
          <Bell size={14} color={Colors.primary} />
          <Text style={styles.statPillText}>{events.length} activities</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <RefreshCw size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading activity…</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <BellOff size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No activity found</Text>
              {!adminSupabase && (
                <Text style={styles.warnText}>
                  ⚠️ Add EXPO_PUBLIC_SUPABASE_SERVICE_KEY to .env to see all data
                </Text>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statPillText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  refreshBtn: { padding: 6 },
  list: { padding: Spacing.md },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, flex: 1 },
  cardTime: { fontSize: 11, color: Colors.textLight, marginLeft: 8, flexShrink: 0 },
  cardBody2: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 18 },
  cardSub: { fontSize: 11, color: Colors.textLight, marginTop: 3 },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 8 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: '600' },
  warnText: { fontSize: FontSize.sm, color: '#F59E0B', textAlign: 'center', paddingHorizontal: Spacing.lg },
});
