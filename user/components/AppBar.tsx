import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useRouter } from 'expo-router';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  timestamp: number;
}

const NOTIFICATIONS_STORAGE_KEY = '@gmr_notifications';

interface AppBarProps {
  transparent?: boolean;
}

export default function AppBar({ transparent = false }: AppBarProps = {}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    // Load notifications from storage
    const loadNotifications = async () => {
      try {
        const storedStr = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        if (storedStr) {
          setNotifications(JSON.parse(storedStr));
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    };

    loadNotifications();

    // Listen for foreground notifications and add them dynamically
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      const newNotif: AppNotification = {
        id: remoteMessage.messageId || Date.now().toString(),
        title: (remoteMessage.notification?.title as string) || (remoteMessage.data?.title as string) || 'New Notification',
        message: (remoteMessage.notification?.body as string) || (remoteMessage.data?.body as string) || '',
        time: 'Just now',
        timestamp: Date.now(),
      };

      setNotifications((prev) => {
        const updated = [newNotif, ...prev].slice(0, 3); // Keep only latest 3
        AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated)).catch(console.error);
        return updated;
      });
    });

    return () => unsubscribe();
  }, []);

  const Container = transparent ? View : BlurView;
  const containerProps = transparent ? {} : { intensity: 80, tint: "light" as const };

  return (
    <Container {...containerProps} style={[styles.safe, transparent && { backgroundColor: 'transparent' }]}>
      <View style={[styles.bar, transparent && { backgroundColor: 'transparent', borderBottomWidth: 0 }]}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/Home')}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Image
                source={require('../assets/images/gmr_logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={[styles.eyebrow, { fontFamily: 'Inter-Bold', fontWeight: 'normal' }]}>Explore with confidence</Text>
              <Text style={[styles.title, { fontFamily: 'Inter-Bold', fontWeight: 'normal' }]}>Guide My <Text style={{ color: '#16A34A', fontFamily: 'Inter-Bold', fontWeight: 'normal' }}>Route</Text></Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.75}
            onPress={() => router.push('/extra/notifications')}
          >
            <Ionicons name="notifications-outline" size={20} color="#1F2937" />
            {notifications.length > 0 && <View style={styles.dot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { marginRight: 8 }]}
            activeOpacity={0.75}
            onPress={() => router.push('/more/Profile')}
          >
            <Ionicons name="person-outline" size={20} color="#1F2937" />
          </TouchableOpacity>


        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#FFFFFF',
  },
  bar: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
   // borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#14B8A6',
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F97316',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
