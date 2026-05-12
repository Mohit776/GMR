import React from 'react';
import { View, StyleSheet, TouchableOpacity, ImageBackground, StatusBar } from 'react-native';
import { Text } from '../../components/Text';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

      <ImageBackground
        source={require('../../assets/images/slash.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
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
              <MaterialCommunityIcons name="map-marker" size={54} color={COLORS.white} />
              <View style={styles.pinDot} />
            </View>
            <Text style={styles.logoText}>
              Guide My <Text style={styles.logoTextGreen}>Route</Text>
            </Text>
            <Text style={styles.subtitle}>
              Travel Smarter. Ride Better.{'\n'}
              With Local Guides & Rentals.
            </Text>
          </View>

          {/* ── Features Card ── */}
          <View style={styles.featuresCard}>
            {/* Feature 1 */}
            <View style={styles.featureItem}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="account-outline" size={24} color={COLORS.primaryLight} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Local Guides</Text>
                <Text style={styles.featureDesc}>Real People. Real Stories.</Text>
              </View>
            </View>

            {/* Feature 2 */}
            <View style={styles.featureItem}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="moped" size={24} color={COLORS.primaryLight} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Bike, Scooty & Car Rentals</Text>
                <Text style={styles.featureDesc}>Ride Your Way.</Text>
              </View>
            </View>

            {/* Feature 3 */}
            <View style={styles.featureItem}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="map-marker-path" size={24} color={COLORS.primaryLight} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Custom Routes</Text>
                <Text style={styles.featureDesc}>Plan, Explore & Enjoy.</Text>
              </View>
            </View>
          </View>

          {/* ── Get Started Button ── */}
          <TouchableOpacity
            style={styles.getStartedButton}
            activeOpacity={0.85}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>

          {/* ── Login Link ── */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')} activeOpacity={0.7}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  backgroundImage: {
    flex: 1,
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
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logoPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  pinDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 7,
    top: 9,
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
  },

  // Features Card
  featuresCard: {
    backgroundColor: COLORS.glassBg,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 30,
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
  },

  // Button
  getStartedButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
