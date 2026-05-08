import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function setBackgroundMessageHandler() {
  return undefined;
}

export async function registerFCMToken(userId: string) {
  if (!userId || Platform.OS === 'web' || !Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16A34A',
    });
  }

  // Get raw device push token (FCM token on Android, APNs token on iOS)
  const tokenResponse = await Notifications.getDevicePushTokenAsync();
  const token = tokenResponse.data;

  await supabase.from('push_tokens').upsert(
    {
      token,
      user_id: userId,
      platform: Platform.OS,
      device_name: Device.deviceName,
      app: 'user',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' }
  );

  const { data: profile } = await supabase.from('users').select('fcm_tokens').eq('id', userId).maybeSingle();
  const tokens = Array.from(new Set([...(profile?.fcm_tokens || []), token]));
  await supabase.from('users').update({ fcm_tokens: tokens }).eq('id', userId);

  console.log('[Push] FCM token successfully saved in the DB:', token);

  return token;
}

export function onTokenRefresh(_userId: string) {
  return () => undefined;
}

export function onForegroundMessage(handler: (title: string, body: string, data?: unknown) => void) {
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    handler(
      notification.request.content.title || 'Notification',
      notification.request.content.body || '',
      notification.request.content.data
    );
  });
  return () => subscription.remove();
}

export async function notifyUser(userId: string, title: string, body: string, data?: Record<string, string>) {
  const { error } = await supabase.functions.invoke('send-push', {
    body: { userId, title, body, data },
  });
  if (error) console.warn('Push function error:', error.message);
}
