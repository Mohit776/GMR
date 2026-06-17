import React from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';
import { Text } from '../../components/Text';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';

const COLORS = {
  primary: '#16A34A',      // Forest Green
  primaryLight: '#4ADE80', // Lighter Green for icons
  iconBg: '#1B4332',       // Darker Green for icon background
  white: '#FFFFFF',
  textSecondary: '#D1D5DB', // Light gray
  glassBg: 'rgba(30, 30, 30, 0.65)',
};

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Video
        source={require('../../assets/sp/WhatsApp Video 2026-06-17 at 13.15.34.mp4')}
        style={styles.backgroundImage}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      <View style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
          style={[
            styles.gradient,
            { paddingBottom: Math.max(insets.bottom, 20) + 20 }
          ]}
        >
          {/* ── Header Section (Logo/Title) ── */}
          <View style={styles.headerContainer}>
           
            <View style={styles.logoPinContainer}>
              <Image 
                source={require('../../assets/images/gmr_logo.png')} 
                style={styles.welcomeLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.logoText}>
              Guide My <Text style={styles.logoTextGreen}>Route</Text>
            </Text>
            <Text style={styles.subtitle}>
              Book local guides, rentals and stays with a travel flow built for faster decisions.
            </Text>
          </View>

          

          {/* ── Get Started Button ── */}
          <TouchableOpacity
            style={styles.getStartedButton}
            activeOpacity={0.85}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color={COLORS.white} />
          </TouchableOpacity>

          {/* ── Login Link ── */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')} activeOpacity={0.7}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 80,
  },

  // Header
  headerContainer: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  welcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 34, 24, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  welcomeBadgeText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '800',
  },
  logoPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  welcomeLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#E5E7EB',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  logoTextGreen: {
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    maxWidth: 310,
  },

  // Features Card
  featuresCard: {
    backgroundColor: COLORS.glassBg,
    borderRadius: 20,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  featureDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  assuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginTop: 10,
    paddingVertical: 12,
  },
  assuranceItem: {
    flex: 1,
    alignItems: 'center',
  },
  assuranceValue: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 3,
  },
  assuranceLabel: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
  },
  assuranceDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  // Button
  getStartedButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  getStartedText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },

  // Login link
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  loginText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
