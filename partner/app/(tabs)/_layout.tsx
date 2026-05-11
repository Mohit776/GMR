import { Tabs } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/colors';
import { View, StyleSheet } from 'react-native';
import { Home, Calendar, Compass, Hotel, Bike, User } from 'lucide-react-native';
import Header from '../../components/Header';
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
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 2,
  },
});

export default function TabsLayout() {
  const { profile } = useAuthStore();
  const role = profile?.role ?? 'guide';
  const insets = useSafeAreaInsets();
  
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 12;
  const tabHeight = 60 + bottomPadding;

  const listingLabel =
    role === 'guide' ? 'Services' : role === 'hotel' ? 'Rooms' : 'Vehicles';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => (
          <View style={{ backgroundColor: Colors.white, paddingTop: insets.top }}>
            <Header />
          </View>
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
        name="listings"
        options={{
          title: listingLabel,
          tabBarIcon: ({ focused }) => {
            const Icon = role === 'guide' ? Compass : role === 'hotel' ? Hotel : Bike;
            return <TabIcon Icon={Icon} focused={focused} />;
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={User} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
