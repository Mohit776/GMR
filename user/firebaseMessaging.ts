import messaging from '@react-native-firebase/messaging';
import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'gmr-default';

// ─── Register foreground handler at module load time (before any notification arrives) ───
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Ensure Android channel exists at startup ─────────────────────────────────
if (Platform.OS === 'android') {
  ExpoNotifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Guide My Route',
    importance: ExpoNotifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B35',
    sound: 'default',
  }).catch((err) => console.error('[Notif] Channel creation failed:', err));
}

// ─── Background handler ───────────────────────────────────────────────────────
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[BG] Push received:', remoteMessage.data);
  const title =
    (remoteMessage.data?.title as string) ||
    remoteMessage.notification?.title ||
    'Guide My Route';
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
  }).catch((err) => console.error('[BG] scheduleNotificationAsync failed:', err));
});
