import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when Supabase credentials are present. The app stays runnable without
 * them (useful for local UI work), and auth is only enforced when configured.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * The browser Supabase client. Reads only the public anon key, which is safe to
 * ship: every table is protected by Row Level Security, so a session can only
 * ever read rows for organizations the signed-in user belongs to.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
