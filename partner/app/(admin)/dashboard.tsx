import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize } from '../../constants/theme';
import { Calendar, CreditCard, Users, ChevronRight, Bell, Activity, TrendingUp } from 'lucide-react-native';
import { adminSupabase } from '../../services/adminSupabase';
import { supabase } from '../../services/supabase';

const db = adminSupabase ?? supabase;

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    partners: 0,
    bookings: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Run queries in parallel
      const [partnersRes, bookingsRes] = await Promise.all([
        db.from('users').select('id', { count: 'exact', head: true }).in('role', ['guide', 'hotel', 'rental']),
        db.from('bookings').select('price, amount, status'),
      ]);

      const partnersCount = partnersRes.count || 0;
      const bookingsList = bookingsRes.data || [];
      const bookingsCount = bookingsList.length;
      
      const revenue = bookingsList
        .filter((b: any) => b.status === 'completed')
        .reduce((sum: number, b: any) => sum + Number(b.price ?? b.amount ?? 0), 0);

      setStats({
        partners: partnersCount,
        bookings: bookingsCount,
        revenue,
      });
    } catch (err) {
      console.warn('Could not fetch stats', err);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (route: string) => {
    router.push(`/(admin)/${route}` as any);
  };

  const AdminCard = ({ title, icon: Icon, description, route, color }: any) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigateTo(route)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <Icon size={24} color={color} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{description}</Text>
      </View>
      <ChevronRight size={20} color={Colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchStats} tintColor={Colors.primary} />}
    >
      <LinearGradient
        colors={[Colors.primary, '#1E3A8A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Welcome back! Here's what's happening.</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Users size={20} color={Colors.white} opacity={0.8} style={{ marginBottom: 4 }} />
              <Text style={styles.statValue}>{stats.partners}</Text>
              <Text style={styles.statLabel}>Partners</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Calendar size={20} color={Colors.white} opacity={0.8} style={{ marginBottom: 4 }} />
              <Text style={styles.statValue}>{stats.bookings}</Text>
              <Text style={styles.statLabel}>Bookings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <TrendingUp size={20} color={Colors.white} opacity={0.8} style={{ marginBottom: 4 }} />
              <Text style={styles.statValue}>₹{stats.revenue > 1000 ? (stats.revenue/1000).toFixed(1) + 'k' : stats.revenue}</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {!adminSupabase && (
          <View style={styles.warningBanner}>
            <Activity size={18} color="#B45309" />
            <Text style={styles.warningText}>Service key missing! Some data may be hidden by RLS policies.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Management Console</Text>

        <AdminCard
          title="All Bookings"
          description="View and manage all system bookings"
          icon={Calendar}
          route="bookings"
          color="#3B82F6"
        />
        <AdminCard
          title="Payments Overview"
          description="Monitor revenue and partner payouts"
          icon={CreditCard}
          route="payments"
          color="#10B981"
        />
        <AdminCard
          title="Partners Directory"
          description="Manage guides, hotels, and rentals"
          icon={Users}
          route="partners"
          color="#8B5CF6"
        />
        <AdminCard
          title="System Activity"
          description="Live notification feed and recent events"
          icon={Bell}
          route="notifications"
          color="#F59E0B"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    paddingHorizontal: Spacing.xl,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.white,
    opacity: 0.8,
    marginTop: 4,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.white,
    opacity: 0.8,
    fontWeight: '500',
  },
  content: {
    padding: Spacing.lg,
    marginTop: -10,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#B45309',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginLeft: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
