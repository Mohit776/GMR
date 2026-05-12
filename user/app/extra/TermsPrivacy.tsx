import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  primary: '#16A34A',
  white: '#FFFFFF',
  lightGray: '#F8FAFC',
  darkGray: '#0F172A',
  mediumGray: '#64748B',
  borderGray: '#E2E8F0',
};

const SHADOWS = {
  small: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
};

export default function TermsPrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.darkGray} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Privacy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* Card View */}
        <View style={styles.card}>
          <Text style={styles.lastUpdated}>Last Updated: May 2026</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Terms of Service</Text>
            <Text style={styles.paragraph}>
              Welcome to Guide My Route. By accessing or using our application, you agree to be bound by these functional terms of service and all applicable laws and regulations.
            </Text>
            <Text style={styles.paragraph}>
              You agree not to use the app for any unlawful purpose or in any way that interrupts, damages, or impairs the service. All bookings made through Guide My Route are subject to availability and acceptance.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Privacy Policy</Text>
            <Text style={styles.paragraph}>
              Your privacy is very important to us. This policy explains how we collect, use, and protect your personal information.
            </Text>
            <Text style={styles.paragraph}>
              • We collect information you provide directly (such as name and email) when you register.{"\n"}
              • We use location data to provide vehicle and guide suggestions near you.{"\n"}
              • We do not share your personal data with third-party marketers without your consent.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. User Accounts</Text>
            <Text style={styles.paragraph}>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Please notify us immediately if you suspect any unauthorized access.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Cancellations & Refunds</Text>
            <Text style={styles.paragraph}>
              Cancellations are subject to the terms agreed upon at the time of booking. Guides or vehicle owners may have individual cancellation policies which apply directly.
            </Text>
          </View>

        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    ...SHADOWS.small,
  },
  lastUpdated: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkGray,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: COLORS.mediumGray,
    lineHeight: 22,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderGray,
    marginVertical: 16,
  },
});
