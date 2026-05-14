import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as ExpoNotifications from 'expo-notifications';
import { Platform, PermissionsAndroid } from 'react-native';
import { supabase } from './supabase';
import { Router } from 'expo-router';

const CHANNEL_ID = 'gmr-default';

export async function initNotifications(userId: string): Promise<() => void> {
  // 1. Request Android 13+ POST_NOTIFICATIONS permission explicitly
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      console.log('[FCM] Android 13+ Notification permission:', granted);
    } catch (err) {
      console.warn('[FCM] Failed to request Android 13+ permissions:', err);
    }
  }

  // 2. Request local notification permissions via Expo (critical for Android 13+)
  try {
    const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await ExpoNotifications.requestPermissionsAsync();
      finalStatus = status;
    }
    console.log('[FCM] Expo notification status:', finalStatus);
  } catch (err) {
    console.warn('[FCM] Failed to request Expo notification permissions:', err);
  }

  // 3. Request FCM permissions via Firebase.
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[FCM] Firebase permission not granted');
    }
  } catch (err) {
    console.warn('[FCM] Firebase permission request failed, continuing token registration:', err);
  }

  try {
    // 4. Register for remote notifications (essential for iOS)
    if (Platform.OS === 'ios' && !messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }

    // 5. Retry token fetch — SERVICE_NOT_AVAILABLE is a transient GPS connectivity error
    const token = await getTokenWithRetry();
    if (token) {
      const { error } = await supabase.rpc('register_fcm_token', { p_token: token });
      if (error) {
        console.error('[FCM] RPC register_fcm_token failed:', error.message);
      } else {
        console.log('[FCM] Token registered successfully in DB');
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
    console.log('[FCM] Foreground message:', JSON.stringify(remoteMessage.data));
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

/**
 * Retries messaging().getToken() up to `maxAttempts` times with exponential backoff.
 * SERVICE_NOT_AVAILABLE is a transient Google Play Services error that usually
 * resolves on its own within a few seconds.
 */
async function getTokenWithRetry(maxAttempts = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const token = await messaging().getToken();
      console.log(`[FCM] Got token (attempt ${attempt}):`, token ? token.substring(0, 15) + '...' : 'null');
      return token;
    } catch (err: any) {
      const isRetryable =
        err?.message?.includes('SERVICE_NOT_AVAILABLE') ||
        err?.message?.includes('NETWORK_ERROR') ||
        err?.message?.includes('TIMEOUT');

      if (isRetryable && attempt < maxAttempts) {
        const delay = 2000 * attempt; // 2s, then 4s
        console.warn(`[FCM] getToken attempt ${attempt} failed (transient), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  return null;
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
