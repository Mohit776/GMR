import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  registerFCMToken,
  onTokenRefresh,
  onForegroundMessage,
  setBackgroundMessageHandler,
} from '../utils/notifications';

SplashScreen.preventAutoHideAsync();

// Register background handler at module level (required by FCM)
setBackgroundMessageHandler();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const tokenRefreshUnsub = useRef<(() => void) | null>(null);
  const foregroundUnsub = useRef<(() => void) | null>(null);

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

  // ─── FCM Setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      // Clean up listeners when logged out
      if (tokenRefreshUnsub.current) {
        tokenRefreshUnsub.current();
        tokenRefreshUnsub.current = null;
      }
      if (foregroundUnsub.current) {
        foregroundUnsub.current();
        foregroundUnsub.current = null;
      }
      return;
    }

    // Register token
    registerFCMToken(user.uid);

    // Listen for token refresh
    tokenRefreshUnsub.current = onTokenRefresh(user.uid);

    // Listen for foreground messages
    foregroundUnsub.current = onForegroundMessage((title, body, data) => {
      Alert.alert(title, body);
    });

    return () => {
      if (tokenRefreshUnsub.current) {
        tokenRefreshUnsub.current();
        tokenRefreshUnsub.current = null;
      }
      if (foregroundUnsub.current) {
        foregroundUnsub.current();
        foregroundUnsub.current = null;
      }
    };
  }, [user]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="more" />
    </Stack>
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
