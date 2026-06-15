import { useSyncExternalStore } from 'react';
import type { PartnerAuthUser, PartnerProfile } from '../services/auth';
import { getUserDoc } from '../services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ADMIN_PERSIST_KEY = '@gmr_is_admin';

type State = {
  user: PartnerAuthUser | null;
  profile: PartnerProfile | null;
  isInitialized: boolean;
  isProfileLoading: boolean;
  pendingRequestCount: number;
  isAdmin: boolean;
  adminInitialized: boolean; // true once we've read isAdmin from storage
};

let state: State = {
  user: null,
  profile: null,
  isInitialized: false,
  isProfileLoading: false,
  pendingRequestCount: 0,
  isAdmin: false,
  adminInitialized: false,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Restore isAdmin from storage on boot
AsyncStorage.getItem(ADMIN_PERSIST_KEY).then((value) => {
  setState({ isAdmin: value === 'true', adminInitialized: true });
}).catch(() => {
  setState({ adminInitialized: true });
});

// ── Stable setter references ─────────────────────────────────────────────────
const setUser = (user: PartnerAuthUser | null) => setState({ user });
const setProfile = (profile: PartnerProfile | null) => setState({ profile });
const setInitialized = (isInitialized: boolean) => setState({ isInitialized });
const setProfileLoading = (isProfileLoading: boolean) => setState({ isProfileLoading });
const setPendingRequestCount = (pendingRequestCount: number) => setState({ pendingRequestCount });

const setIsAdmin = (isAdmin: boolean) => {
  setState({ isAdmin });
  // Persist to AsyncStorage so it survives app reloads
  AsyncStorage.setItem(ADMIN_PERSIST_KEY, isAdmin ? 'true' : 'false').catch(console.warn);
};

const reset = () => {
  setState({
    user: null,
    profile: null,
    isInitialized: true,
    isProfileLoading: false,
    pendingRequestCount: 0,
    isAdmin: false,
  });
  AsyncStorage.removeItem(ADMIN_PERSIST_KEY).catch(console.warn);
};

const refreshProfile = async () => {
  if (!state.user) return null;
  const profile = await getUserDoc(state.user.uid);
  setState({ profile });
  return profile;
};

export function useAuthStore() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  return {
    ...snapshot,
    setUser,
    setProfile,
    setInitialized,
    setProfileLoading,
    setPendingRequestCount,
    setIsAdmin,
    reset,
    refreshProfile,
  };
}
