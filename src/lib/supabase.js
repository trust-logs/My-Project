import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
}) : null;

export async function currentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password, profile = {}) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.signUp({ email, password, options: { data: profile } });
}

export async function signOut() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}
