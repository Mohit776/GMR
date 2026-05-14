import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function AppBar() {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
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
  
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.bar}>
           <TouchableOpacity 
           onPress={() => router.push('/(tabs)/Home')}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Ionicons name="navigate" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.eyebrow}>Explore with confidence</Text>
            <Text style={styles.title}>Guide My Route</Text>
          </View>
        </View>
</TouchableOpacity>
        <View style={styles.rightActions}>
          <TouchableOpacity 
            style={[styles.iconButton, { marginRight: 8 }]} 
            activeOpacity={0.75}
            onPress={() => router.push('/more/MyBookings')}
          >
            <Ionicons name="calendar-outline" size={20} color="#1F2937" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton} 
            activeOpacity={0.75}
            onPress={() => setShowNotifications(true)}
          >
            <Ionicons name="notifications-outline" size={20} color="#1F2937" />
            {notifications.length > 0 && <View style={styles.dot} />}
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showNotifications}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowNotifications(false)}
        >
          <View style={styles.dropdownMenu}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Recent Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            {notifications.length === 0 ? (
               <View style={styles.notificationItem}>
                 <Text style={[styles.notificationMessage, { textAlign: 'center' }]}>No recent notifications</Text>
               </View>
            ) : (
              notifications.map((notif, index) => (
                <View 
                  key={notif.id} 
                  style={[
                    styles.notificationItem, 
                    index !== notifications.length - 1 && styles.notificationDivider
                  ]}
                >
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>{notif.title}</Text>
                    <Text style={styles.notificationTime}>{notif.time}</Text>
                  </View>
                  <Text style={styles.notificationMessage} numberOfLines={2}>{notif.message}</Text>
                </View>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: '#ffffff' },
  bar: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    marginRight: 12,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 110,
    right: 16,
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    padding: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  notificationItem: {
    padding: 12,
    borderRadius: 8,
  },
  notificationDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  notificationTime: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
});
