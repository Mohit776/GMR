import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize } from '../../constants/theme';
import { supabase } from '../../services/supabase';
import { Image } from 'expo-image';
import { MapPin, Phone, Mail, Briefcase, Calendar, CheckCircle, XCircle } from 'lucide-react-native';

export default function AdminPartnerDetail() {
  const { id } = useLocalSearchParams();
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ listings: 0, bookings: 0 });

  useEffect(() => {
    if (id) {
      fetchPartnerData(id as string);
    }
  }, [id]);

  const fetchPartnerData = async (partnerId: string) => {
    try {
      setLoading(true);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (profileError) throw profileError;
      setPartner(profileData);

      // Fetch stats (listings)
      const { count: listingsCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', partnerId);

      // Fetch stats (bookings)
      const { count: bookingsCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', partnerId);

      setStats({
        listings: listingsCount || 0,
        bookings: bookingsCount || 0,
      });

    } catch (err: any) {
      console.error('Error fetching partner detail:', err);
      Alert.alert('Error', 'Failed to load partner details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!partner) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Partner not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Profile Section */}
      <View style={styles.headerCard}>
        <Image
          source={partner.avatar_url ? { uri: partner.avatar_url } : { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.name || 'Partner')}&background=random` }}
          style={styles.largeAvatar}
        />
        <Text style={styles.partnerName}>{partner.name || 'Unnamed Partner'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{partner.role ? partner.role.toUpperCase() : 'NO ROLE'}</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.listings}</Text>
          <Text style={styles.statLabel}>Listings</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.bookings}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{partner.is_onboarded ? 'Yes' : 'No'}</Text>
          <Text style={styles.statLabel}>Onboarded</Text>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact & Info</Text>
        
        <View style={styles.infoRow}>
          <Briefcase size={20} color={Colors.textLight} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Business Name</Text>
            <Text style={styles.infoValue}>{partner.profile_data?.businessName || partner.name || 'Not provided'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MapPin size={20} color={Colors.textLight} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{partner.city || partner.profile_data?.city || 'Not provided'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Phone size={20} color={Colors.textLight} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{partner.phone || 'Not provided'}</Text>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <Calendar size={20} color={Colors.textLight} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Joined Date</Text>
            <Text style={styles.infoValue}>{new Date(partner.created_at).toLocaleDateString()}</Text>
          </View>
        </View>
      </View>

      {/* Verification Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verification</Text>
        <View style={styles.verificationRow}>
          {partner.is_onboarded ? (
            <CheckCircle size={24} color={Colors.success} />
          ) : (
            <XCircle size={24} color={Colors.error} />
          )}
          <Text style={styles.verificationText}>
            {partner.is_onboarded 
              ? 'Partner has completed onboarding.' 
              : 'Partner has not completed onboarding.'}
          </Text>
        </View>
      </View>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: FontSize.lg,
    color: Colors.error,
    fontWeight: 'bold',
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  largeAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: Spacing.md,
    backgroundColor: Colors.inputBg,
  },
  partnerName: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  roleText: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: FontSize.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  dividerVertical: {
    width: 1,
    backgroundColor: Colors.border,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  infoContent: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  verificationText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
});
