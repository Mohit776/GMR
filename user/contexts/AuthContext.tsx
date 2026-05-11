import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

WebBrowser.maybeCompleteAuthSession();

type AppUser = User & {
  uid: string;
  displayName: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  providerData: Array<{ providerId: string }>;
};

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toAppUser(user: User | null): AppUser | null {
  if (!user) return null;
  return Object.assign(user, {
    uid: user.id,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || null,
    phoneNumber: user.user_metadata?.phone || user.phone || null,
    emailVerified: Boolean(user.email_confirmed_at),
    providerData: (user.app_metadata?.providers || []).map((providerId: string) => ({ providerId })),
  });
}

async function upsertUserProfile(user: User) {
  // Check if user already has a profile with a partner role
  const { data: existing } = await supabase
    .from('users')
    .select('id, role, is_approved')
    .eq('id', user.id)
    .maybeSingle();

  // Partners (guide/hotel/rental) can also use the user app — don't overwrite their role
  const partnerRoles = ['guide', 'hotel', 'rental'];
  const isExistingPartner = existing && partnerRoles.includes(existing.role);

  const profileData: Record<string, any> = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
    phone: user.user_metadata?.phone || user.phone || null,
    role: isExistingPartner ? existing.role : (existing?.role || 'user'),
    is_onboarded: true,
    profile_data: user.user_metadata || {},
    photo_url: user.user_metadata?.avatar_url || null,
    updated_at: new Date().toISOString(),
  };

  // Only set is_approved for new users (not existing partners)
  if (!isExistingPartner) {
    profileData.is_approved = true;
  }

  await supabase.from('users').upsert(profileData, { onConflict: 'id' });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(toAppUser(data.session?.user ?? null));
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAppUser(session?.user ?? null));
      setLoading(false);
      if (session?.user) {
        upsertUserProfile(session.user).catch((error) =>
          console.warn('Unable to sync user profile:', error.message)
        );
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signInWithEmail: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await upsertUserProfile(data.user);
    },
    signUpWithEmail: async (email, password, displayName) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName } },
      });
      if (error) throw error;
      if (data.user) await upsertUserProfile(data.user);
    },
    signInWithGoogle: async () => {
      if (Platform.OS === 'web') {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
        return;
      }

      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '56738663423-0l2ojldhf8l71rjr4k78j4a9p16ocl08.apps.googleusercontent.com';
      const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

      GoogleSignin.configure({
        webClientId,
        ...(iosClientId ? { iosClientId } : {}),
      });

      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const userInfo = await GoogleSignin.signIn();

      let idToken: string | null = null;
      if (userInfo && 'type' in userInfo) {
        if (userInfo.type === 'cancelled') {
          throw new Error('Google login was cancelled.');
        } else if ((userInfo as any).type === 'noSavedCredentialFound') {
          throw new Error('No saved credential found.');
        }
        idToken = userInfo.data?.idToken || null;
      } else {
        // @ts-ignore
        idToken = userInfo.idToken || userInfo.data?.idToken || null;
      }

      if (!idToken) {
        throw new Error('No ID token present in Google Sign-In response!');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;
      if (data.user) await upsertUserProfile(data.user);
    },
    signOut: async () => {
      try {
        const { unregisterFCMToken } = await import('../utils/notifications');
        await unregisterFCMToken();
      } catch (err) {
        console.warn('Unable to unregister FCM token:', err);
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
