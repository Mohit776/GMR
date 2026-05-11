import React, { useEffect, useRef } from 'react';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/useAuthStore';
import { listenToUserDoc } from '../services/auth';
import { View, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { NetworkBanner } from '../components/NetworkBanner';

import '../firebaseMessaging';

export default function RootLayout() {
  const { user, profile, isInitialized, isProfileLoading, setUser, setProfile, setInitialized, setProfileLoading } =
    useAuthStore();
  const userUid = user?.uid;

  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // Track redirect to prevent loops
  const lastRedirect = useRef<string | null>(null);

  // ─── Auth initialization ─────────────────────────────────────────────────────
  // Only use onAuthStateChange (it fires INITIAL_SESSION on startup in modern
  // Supabase, so we don't need a separate getSession call that races with it).
  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;
    let currentUid: string | null = null;

    let hasFired = false;

    // Safety timeout: if auth never resolves in 10 seconds, force init
    const safetyTimer = setTimeout(() => {
      if (!hasFired) {
        console.warn('[Auth] Safety timeout – forcing initialization after 10s');
        setProfileLoading(false);
        setInitialized(true);
      }
    }, 10000);

    const handleSession = (session: any) => {
      console.log('[Auth] handleSession called, user:', session?.user?.id ?? 'none');
      hasFired = true;
      clearTimeout(safetyTimer);
      const newUid = session?.user?.id ?? null;

      // Skip if same user (avoid duplicate channel subscriptions)
      if (newUid === currentUid && unsubscribeDoc) {
        console.log('[Auth] Same user, skipping re-init');
        return;
      }

      // Clean up previous listener
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }
      currentUid = newUid;

      if (session?.user) {
        const authUser = Object.assign(session.user, {
          uid: session.user.id,
          displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || null,
        });
        setUser(authUser);
        setProfileLoading(true); // Mark profile as loading before the async fetch
        console.log('[Auth] Listening to user doc for:', session.user.id);
        unsubscribeDoc = listenToUserDoc(session.user.id, (doc) => {
          console.log('[Auth] User doc callback, profile:', doc ? 'found' : 'null', 'isOnboarded:', doc?.isOnboarded);
          setProfile(doc);
          setProfileLoading(false);
          setInitialized(true);
        });
      } else {
        console.log('[Auth] No user session, setting initialized');
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
        setInitialized(true);
      }
    };

    console.log('[Auth] Setting up onAuthStateChange listener');
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] onAuthStateChange event:', _event);

      // If token refresh failed (stale/invalid refresh token), sign out to clear
      // the bad token from AsyncStorage and redirect to login cleanly.
      if (_event === 'TOKEN_REFRESHED' && !session) {
        console.warn('[Auth] Token refresh returned no session – signing out to clear stale tokens');
        supabase.auth.signOut();
        return;
      }

      handleSession(session);
    });

    // Fallback if onAuthStateChange doesn't fire immediately
    console.log('[Auth] Calling getSession as fallback');
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.log('[Auth] getSession error:', error.message);
          if (
            error.message.includes('Refresh Token Not Found') ||
            error.message.includes('Invalid Refresh Token')
          ) {
            console.warn('[Auth] Invalid refresh token detected – signing out');
            supabase.auth.signOut();
            return;
          }
        }
        console.log('[Auth] getSession result, hasFired:', hasFired, 'session:', !!session);
        if (!hasFired) {
          handleSession(session);
        }
      })
      .catch((err) => {
        console.warn('[Auth] getSession exception:', err);
        if (
          err?.message?.includes('Refresh Token Not Found') ||
          err?.message?.includes('Invalid Refresh Token')
        ) {
          console.warn('[Auth] Clearing stale tokens via signOut');
          supabase.auth.signOut();
        }
        if (!hasFired) {
          handleSession(null);
        }
      });

    return () => {
      clearTimeout(safetyTimer);
      authListener.subscription.unsubscribe();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // ─── Navigate after initialization ──────────────────────────────────────────
  useEffect(() => {
    // Don't make routing decisions while auth is uninitialised or profile is loading
    if (!isInitialized || !navigationState?.key) return;
    if (isProfileLoading) return; // Wait for profile fetch to complete

    const routeSegments = (segments ?? []) as string[];
    const currentPath = '/' + routeSegments.join('/');
    
    const currentGroup = routeSegments[0];
    const inAuthGroup = currentGroup === 'auth';
    const inOnboardingGroup = currentGroup === 'onboarding';
    const inTabsGroup = currentGroup === '(tabs)';
    
    // Normalize dashboard check - it might appear as '/dashboard' or '/(tabs)/dashboard'
    const isAtDashboard = inTabsGroup && routeSegments[1] === 'dashboard';
    const isUploadDocs = inOnboardingGroup && routeSegments[1] === 'upload-docs';

    let target: string | null = null;

    if (!userUid) {
      // Not logged in: force to login if not already in auth/onboarding
      if (!inAuthGroup && !inOnboardingGroup) {
        target = '/auth/login';
      }
    } else if (!profile?.isOnboarded) {
      // Logged in but not onboarded: force to onboarding
      if (!inOnboardingGroup) {
        target = '/onboarding';
      }
    } else {
      // User is logged in and onboarded: force to tabs
      if (!inTabsGroup && !isUploadDocs) {
        target = '/(tabs)/dashboard';
      }
    }

    if (target && target !== currentPath && target !== lastRedirect.current) {
      console.log(`[Router] Redirecting from ${currentPath} to ${target}`);
      lastRedirect.current = target;
      
      // We use setTimeout(..., 0) without clearing it to avoid race conditions
      // where the timeout gets cleared before it executes.
      setTimeout(() => {
        router.replace(target as any);
      }, 0);
    }
  }, [isInitialized, isProfileLoading, navigationState?.key, userUid, profile?.isOnboarded, segments]);

  // Reset redirect tracking only when auth state changes (not on tab switches)
  useEffect(() => {
    lastRedirect.current = null;
  }, [userUid, profile?.isOnboarded]);

  useEffect(() => {
    if (!userUid || !isInitialized) return;
    let cleanup: (() => void) | undefined;

    import('../services/notifications').then(({ initNotifications, handleNotificationTap }) => {
      initNotifications(userUid).then((fn) => {
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
  }, [userUid, isInitialized]);

  // Show splash while initializing
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color={Colors.white} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <NetworkBanner />
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}
