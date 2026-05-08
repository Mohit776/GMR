import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View
} from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
import AppBar from '../../components/AppBar';
import { Text } from '../../components/Text';
import { useAuth } from '../../contexts/AuthContext';
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
  danger: '#EF4444',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface StatItem {
  label: string;
  value: string | number;
}

interface MenuItem {
  id: string;
  icon: string;
  iconSource?: any;
  label: string;
  type: 'navigate' | 'badge' | 'toggle' | 'danger';
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// ─── Data ──────────────────────────────────────────────────────────────────────
const STATS: StatItem[] = [
  { label: 'Trips', value: 12 },
  { label: 'Rating', value: 4.9 },
  { label: 'Reviews', value: 28 },
];

const MENU_SECTIONS: MenuSection[] = [
  {
    title: 'Account',
    items: [
      { id: '1', icon: '👤', label: 'Personal Information', type: 'navigate' },
      { id: '2', icon: '💳', iconSource: require('../../assets/svg/payment-card-svgrepo-com.svg'), label: 'Payment Methods', type: 'navigate' },
      { id: '3', icon: '📋', iconSource: require('../../assets/svg/calender-svgrepo-com.svg'), label: 'My Bookings', type: 'navigate' },
      { id: '4', icon: '❤️', label: 'Saved Places', type: 'navigate' },
    ],
  },

  {
    title: 'Preferences',
    items: [
      { id: '7', icon: '🔔', iconSource: require('../../assets/svg/bell-svgrepo-com.svg'), label: 'Notifications', type: 'toggle' },
      { id: '8', icon: '🌐', label: 'Language', type: 'navigate' },
      { id: '9', icon: '⚙️', iconSource: require('../../assets/svg/setting-svgrepo-com.svg'), label: 'Settings', type: 'navigate' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: '10', icon: '❓', iconSource: require('../../assets/svg/phone-call-svgrepo-com.svg'), label: 'Help & Support', type: 'navigate' },
      { id: '11', icon: '📄', iconSource: require('../../assets/svg/license-svgrepo-com.svg'), label: 'Terms & Privacy', type: 'navigate' },
      { id: '12', icon: '🚪', iconSource: require('../../assets/svg/logout-2-svgrepo-com.svg'), label: 'Log Out', type: 'danger' },
    ],
  },
];

// ─── Menu Row ──────────────────────────────────────────────────────────────────
const MenuRow = ({
  item,
  isLast,
  notifEnabled,
  onToggle,
  onLogout,
  onPress,
}: {
  item: MenuItem;
  isLast: boolean;
  notifEnabled?: boolean;
  onToggle?: () => void;
  onLogout?: () => void;
  onPress?: () => void;
}) => {
  const isDanger = item.type === 'danger';

  return (
    <TouchableOpacity
      style={[styles.menuRow, isLast && styles.menuRowLast]}
      activeOpacity={0.7}
      onPress={isDanger ? onLogout : onPress}
    >
      {/* Icon Box */}
      <View
        style={[
          styles.menuIconBox,
          isDanger && { backgroundColor: '#FEE2E2' },
        ]}
      >
        {item.iconSource ? (
          <ExpoImage source={item.iconSource} style={{ width: 22, height: 22, tintColor: isDanger ? COLORS.danger : COLORS.darkGray }} contentFit="contain" />
        ) : (
          <Text style={styles.menuIcon}>{item.icon}</Text>
        )}
      </View>

      {/* Label */}
      <Text
        style={[styles.menuLabel, isDanger && { color: COLORS.danger }]}
      >
        {item.label}
      </Text>

      {/* Right Side */}
      <View style={styles.menuRight}>
        {item.type === 'badge' && item.badge && (
          <View style={[styles.menuBadge, { backgroundColor: item.badgeBg }]}>
            <Text style={[styles.menuBadgeText, { color: item.badgeColor }]}>
              {item.badge}
            </Text>
          </View>
        )}
        {item.type === 'toggle' && (
          <Switch
            value={notifEnabled}
            onValueChange={onToggle}
            trackColor={{ false: COLORS.borderGray, true: '#86EFAC' }}
            thumbColor={notifEnabled ? COLORS.primary : COLORS.mediumGray}
          />
        )}
        {(item.type === 'navigate' || item.type === 'badge') && (
          <Text style={styles.menuChevron}>›</Text>
        )}
        {item.type === 'danger' && (
          <Text style={[styles.menuChevron, { color: COLORS.danger }]}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getProviderLabel(user: any): string {
  if (!user?.providerData?.length) return '';
  const providerId = user.providerData[0].providerId;
  if (providerId === 'google.com') return 'Google Account';
  if (providerId === 'password') return 'Email Account';
  return providerId;
}

// ─── Main ProfileScreen ────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [notifEnabled, setNotifEnabled] = useState<boolean>(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await supabase.auth.getUser();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const displayName = user?.displayName || 'Traveller';
  const email = user?.email || '';
  const providerLabel = getProviderLabel(user);
  const isVerified = user?.emailVerified ?? false;

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut();
            router.replace('/auth/login');
          } catch {
            Alert.alert('Error', 'Could not log out. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleMenuPress = (item: MenuItem) => {
    if (item.id === '1') {
      router.push('../more/personalInformation');
    } else if (item.id === '3') {
      router.push('../more/MyBookings');
    }
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── Header Banner ── */}
      <AppBar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
            </View>
            <View style={styles.onlineIndicator} />
          </View>

          {/* Name & Email */}
          <Text style={styles.profileName}>{displayName}</Text>
          {email ? (
            <View style={styles.emailRow}>
              <Text style={styles.emailIcon}>✉️</Text>
              <Text style={styles.profileEmail}>{email}</Text>
            </View>
          ) : null}

          {/* Provider Tag & Verified */}
          <View style={styles.chipRow}>
            {providerLabel ? (
              <View style={styles.providerChip}>
                {providerLabel === 'Google Account' ? (
                  <ExpoImage source={require('../../assets/svg/icons8-google.svg')} style={{ width: 14, height: 14 }} contentFit="contain" />
                ) : (
                  <Text style={styles.providerIcon}>📧</Text>
                )}
                <Text style={styles.providerText}>{providerLabel}</Text>
              </View>
            ) : null}

            {isVerified && (
              <View style={styles.verifiedChip}>
                <ExpoImage source={require('../../assets/svg/verify-svgrepo-com.svg')} style={{ width: 14, height: 14, tintColor: COLORS.primary }} contentFit="contain" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {STATS.map((stat, idx) => (
              <React.Fragment key={stat.label}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
                {idx < STATS.length - 1 && (
                  <View style={styles.statDivider} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Active Trip Banner ── */}
        <TouchableOpacity style={styles.activeTripBanner} activeOpacity={0.88}>
          <View style={styles.activeTripLeft}>
            <View style={styles.activeDot} />
            <View>
              <Text style={styles.activeTripTitle}>Active Trip</Text>
              <Text style={styles.activeTripSub}>
                Royal Enfield · UK14F 7722 · Rishikesh
              </Text>
            </View>
          </View>
          <View style={styles.activeTripBtn}>
            <Text style={styles.activeTripBtnText}>View →</Text>
          </View>
        </TouchableOpacity>

        {/* ── Menu Sections ── */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, idx) => (
                <MenuRow
                  key={item.id}
                  item={item}
                  isLast={idx === section.items.length - 1}
                  notifEnabled={notifEnabled}
                  onToggle={() => setNotifEnabled((prev) => !prev)}
                  onLogout={handleLogout}
                  onPress={() => handleMenuPress(item)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* ── App Version ── */}
        <Text style={styles.appVersion}>Guide My Route · v1.0.0</Text>

        {/* devloper info */}
        <Text style={styles.appVersion}>Developed by Mohit Aggarwal</Text>
       

        {/* Logging Out Overlay */}
        {loggingOut && (
          <View style={styles.loggingOutOverlay}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={styles.loggingOutText}>Logging out...</Text>
          </View> 
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // Header Banner
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.primary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Profile Card
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 20,
    marginTop: 50,
    borderWidth: 1.5,
    borderColor: COLORS.borderGray,
    overflow: 'visible',
  },

  // Avatar
  avatarWrapper: {
    marginTop: -36,
    marginBottom: 14,
    position: 'relative',
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
   
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: COLORS.white,
  },

  // Name & Email
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.darkGray,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  emailIcon: {
    fontSize: 13,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  providerIcon: {
    fontSize: 11,
  },
  providerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  verifiedIcon: {
    fontSize: 11,
    color: COLORS.primary,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 14,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
    width: '88%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.darkGray,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.mediumGray,
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: COLORS.borderGray,
  },

  // Active Trip Banner
  activeTripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.darkGray,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: COLORS.borderGray,
  },
  activeTripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  activeTripTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 2,
  },
  activeTripSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  activeTripBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  activeTripBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Menu Section
  menuSection: {
    marginTop: 20,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.mediumGray,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.borderGray,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
    gap: 12,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 18,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  menuChevron: {
    fontSize: 22,
    color: COLORS.mediumGray,
    fontWeight: '300',
    lineHeight: 24,
  },

  // Version
  appVersion: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: 24,
    fontWeight: '500',
  },

  // Logging out overlay
  loggingOutOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  loggingOutText: {
    fontSize: 13,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
});
