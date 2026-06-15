import React from 'react';
import { Tabs, router } from 'expo-router';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/useAuthStore';
import { LogOut, Home, Calendar, CreditCard, Users, ChevronLeft, Bell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({ Icon, focused }: { Icon: any; focused: boolean }) {
  return (
    <View style={tabStyles.iconWrap}>
      <Icon color={focused ? Colors.primary : Colors.textLight} size={22} />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
});

export default function AdminLayout() {
  const { setIsAdmin } = useAuthStore();
  const insets = useSafeAreaInsets();
  
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 12;
  const tabHeight = 60 + bottomPadding;

  const handleLogout = () => {
    setIsAdmin(false);
    router.replace('/auth/login');
  };

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.white,
        },
        headerTintColor: Colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <LogOut size={20} color={Colors.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        ),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Home} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Calendar} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={CreditCard} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="partners"
        options={{
          title: 'Partners',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Users} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Activity',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Bell} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="partner-detail"
        options={{
          href: null, // Hides this screen from the bottom tab bar
          title: 'Partner Details',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  logoutText: {
    color: Colors.error,
    fontWeight: '600',
    fontSize: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  backText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: -4,
  },
});
