import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Router } from 'expo-router';

const CHANNEL_ID = 'gmr-default';

export async function initNotifications(userId: string): Promise<() => void> {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log('[FCM] Permission not granted');
    return () => {};
  }

  try {
    const token = await messaging().getToken();
    console.log('[FCM] Got token:', token ? token.substring(0, 20) + '...' : 'null');
    if (token) {
      const { error } = await supabase.rpc('register_fcm_token', { p_token: token });
      if (error) {
        console.error('[FCM] Failed to register token via RPC:', error.message);
      } else {
        console.log('[FCM] Token registered successfully for user:', userId);
      }
    }
  } catch (err) {
    console.error('[FCM] Failed to get or register FCM token:', err);
  }

  const unsubscribeRefresh = messaging().onTokenRefresh(async (newToken) => {
    try {
      await supabase.rpc('register_fcm_token', { p_token: newToken });
    } catch (err) {
      console.error('[FCM] Failed to update refreshed token:', err);
    }
  });

  // Foreground FCM messages — schedule a local notification so it shows as a heads-up banner
  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    console.log('[FCM] ▶ Foreground message:', JSON.stringify(remoteMessage.data));
    const title =
      (remoteMessage.data?.title as string) ||
      remoteMessage.notification?.title ||
      'GMR Partner';
    const body =
      (remoteMessage.data?.body as string) ||
      remoteMessage.notification?.body ||
      'You have a new notification.';

    await ExpoNotifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: remoteMessage.data ?? {},
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: null,
    }).catch((err) => console.error('[FCM] foreground scheduleNotification failed:', err));
  });

  return () => {
    unsubscribeRefresh();
    unsubscribeForeground();
  };
}

export async function handleNotificationTap(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage | null,
  router: Router
): Promise<void> {
  if (!remoteMessage) return;
  router.push('/(tabs)/bookings');
}

export async function unregisterFCMToken(): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (token) {
      await supabase.rpc('unregister_fcm_token', { p_token: token });
    }
  } catch (err) {
    console.error('[FCM] Failed to unregister FCM token:', err);
  }
}
