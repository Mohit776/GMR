import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

import '../firebaseMessaging';

import { NetworkBanner } from '../components/NetworkBanner';

SplashScreen.preventAutoHideAsync();


function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      // Redirect to the welcome page.
      router.replace('/auth/welcome');
    } else if (user && inAuthGroup) {
      // Redirect to the home page.
      router.replace('/(tabs)/Home');
    }
  }, [user, loading, router, segments]);

  useEffect(() => {
    if (!user?.uid) return;
    let cleanup: (() => void) | undefined;

    import('../utils/notifications').then(({ initNotifications, handleNotificationTap }) => {
      initNotifications(user.uid).then((fn) => {
        cleanup = fn;
      });

      import('@react-native-firebase/messaging').then((messagingModule) => {
        const messaging = messagingModule.default;
        
        messaging().getInitialNotification().then((msg) => {
          handleNotificationTap(msg, router);
        });

        const unsub = messaging().onNotificationOpenedApp((msg) => {
          handleNotificationTap(msg, router);
        });

        const oldCleanup = cleanup;
        cleanup = () => {
          oldCleanup?.();
          unsub();
        };
      });
    });

    return () => {
      cleanup?.();
    };
  }, [user?.uid, router]);

  return (
    <>
      <NetworkBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="more" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    'Inter-ExtraBold': require('../assets/fonts/Inter-ExtraBold.ttf'),
    'Inter-Black': require('../assets/fonts/Inter-Black.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
