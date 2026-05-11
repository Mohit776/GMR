import 'react-native-url-polyfill/auto';
import { supabase } from './supabase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

export type UserRole = 'guide' | 'hotel' | 'rental';

export interface PartnerAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

export interface PartnerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isOnboarded: boolean;
  isApproved: boolean;
  hasUploadedDocs: boolean;
  profileData: any;
  documents?: string[];
  kycVideoUrl?: string | null;
  createdAt: string;
}

function toPartnerUser(user: any): PartnerAuthUser {
  return {
    uid: user.id,
    email: user.email || null,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || null,
    photoURL: user.user_metadata?.avatar_url || null,
  };
}

function extractCity(value: unknown) {
  return String(value || '').trim().split(',')[0]?.trim() || '';
}

export async function signInUser(email: string, password: string): Promise<PartnerAuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Authentication failed: No user data returned');
  return toPartnerUser(data.user);
}

export async function registerUser(email: string, password: string): Promise<PartnerAuthUser> {
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Registration failed: No user data returned');
  return toPartnerUser(data.user);
}

export async function getUserDoc(uid: string): Promise<PartnerProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching partner profile:', error.message);
    throw error;
  }
  
  if (!data) return null;
  
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    isOnboarded: data.is_onboarded,
    isApproved: data.is_approved,
    hasUploadedDocs: data.has_uploaded_docs,
    profileData: data.profile_data || {},
    documents: data.documents || [],
    kycVideoUrl: data.kyc_video_url || null,
    createdAt: data.created_at,
  };
}

export async function createUserDoc(uid: string, name: string, email: string, phone: string, role: string) {
  const { error } = await supabase.from('users').upsert({
    id: uid,
    name,
    email,
    phone,
    role,
    is_onboarded: false,
    is_approved: false,
    has_uploaded_docs: false,
    profile_data: {},
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  
  if (error) {
    console.error('Error creating partner profile:', error.message);
    throw error;
  }
}

export async function signInWithGoogle(): Promise<PartnerAuthUser | null> {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) throw error;
    return null;
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '56738663423-0l2ojldhf8l71rjr4k78j4a9p16ocl08.apps.googleusercontent.com';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

  GoogleSignin.configure({
    webClientId,
    ...(iosClientId ? { iosClientId } : {}),
  });

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const userInfo = await GoogleSignin.signIn();
    
    let idToken: string | null = null;
    if (userInfo && 'type' in userInfo) {
      if (userInfo.type === 'cancelled') {
        throw { code: 'SIGN_IN_CANCELLED', message: 'User cancelled the login flow' };
      }
      idToken = userInfo.data?.idToken || null;
    } else {
      // @ts-ignore - Handle older SDK versions if necessary
      idToken = (userInfo as any).idToken || (userInfo as any).data?.idToken || null;
    }

    if (!idToken) {
      throw new Error('No ID token present in Google Sign-In response');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned from Supabase after Google Sign-In');

    return toPartnerUser(data.user);
  } catch (err: any) {
    if (err.code === 'SIGN_IN_CANCELLED') {
      throw err;
    }
    console.error('Google Sign-In Error:', err);
    throw err;
  }
}

export async function signOut() {
  try {
    const { unregisterFCMToken } = await import('./notifications');
    await unregisterFCMToken();
  } catch (err) {
    console.warn('Unable to unregister FCM token:', err);
  }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateUserProfile(uid: string, updates: Partial<PartnerProfile>) {
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.isOnboarded !== undefined) dbUpdates.is_onboarded = updates.isOnboarded;
  if (updates.isApproved !== undefined) dbUpdates.is_approved = updates.isApproved;
  if (updates.hasUploadedDocs !== undefined) dbUpdates.has_uploaded_docs = updates.hasUploadedDocs;
  if (updates.profileData !== undefined) {
    dbUpdates.profile_data = updates.profileData;
    const profileData = updates.profileData as Record<string, unknown>;
    const city = extractCity(profileData.city || profileData.location);
    if (city) dbUpdates.city = city;
  }
  if (updates.documents !== undefined) dbUpdates.documents = updates.documents;
  if (updates.kycVideoUrl !== undefined) dbUpdates.kyc_video_url = updates.kycVideoUrl;
  if (updates.createdAt !== undefined) dbUpdates.created_at = updates.createdAt;

  const { error } = await supabase.from('users').update(dbUpdates).eq('id', uid);
  if (error) {
    console.error('Error updating profile:', error.message);
    throw error;
  }
}

export function listenToUserDoc(uid: string, callback: (profile: PartnerProfile | null) => void) {
  // Initial fetch
  console.log('[listenToUserDoc] Fetching profile for uid:', uid);
  getUserDoc(uid).then((doc) => {
    console.log('[listenToUserDoc] getUserDoc resolved, doc:', doc ? 'found' : 'null');
    callback(doc);
  }).catch((err) => {
    console.error('[listenToUserDoc] getUserDoc error:', err?.message || err);
    callback(null);
  });

  // Subscribe to changes using Supabase Realtime
  const channel = supabase
    .channel(`partner_profile_${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${uid}`,
      },
      (payload) => {
        const data = payload.new as any;
        if (!data || Object.keys(data).length === 0) {
          // If deleted or empty, we might want to fetch again or set null
          // but for now let's just try to fetch to be sure
          getUserDoc(uid).then(callback).catch(console.error);
          return;
        }
        callback({
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          isOnboarded: data.is_onboarded,
          isApproved: data.is_approved,
          hasUploadedDocs: data.has_uploaded_docs,
          profileData: data.profile_data || {},
          documents: data.documents || [],
          kycVideoUrl: data.kyc_video_url || null,
          createdAt: data.created_at,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
