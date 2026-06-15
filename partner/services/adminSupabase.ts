import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

// Service role key bypasses Row Level Security — for admin use only.
// Set EXPO_PUBLIC_SUPABASE_SERVICE_KEY in your .env file.
// Get it from: Supabase Dashboard → Settings → API → service_role (secret)
const serviceKey =
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY || '';

export const adminSupabase = serviceKey
  ? createClient(supabaseUrl, serviceKey, {
      auth: {
        // Do not persist the service role session to storage
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : null;
