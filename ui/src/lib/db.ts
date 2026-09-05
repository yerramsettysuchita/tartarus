import { supabase } from './supabase.ts';

// Row shapes (mirror supabase/schema.sql). Every read is RLS-scoped, so these
// only ever return rows for organizations the signed-in user belongs to.
export interface Org { id: string; name: string; slug: string; created_at: string }
export interface Profile { id: string; email: string | null; full_name: string | null; avatar_url: string | null }
export interface Repo { id: string; org_id: string; full_name: string; provider: string; sentinel: boolean; created_at: string }
export interface Hunt { id: string; org_id: string; repo: string; trigger: string; status: string; created_at: string; updated_at: string }
export interface Finding { id: string; hunt_id: string; vuln_type: string; severity: string; file_path: string | null; confidence: number | null; created_at: string }

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

/** The signed-in user's organization. RLS returns only orgs they belong to. */
export async function getMyOrg(): Promise<Org | null> {
  const { data, error } = await client().from('organizations').select('*').order('created_at').limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth } = await client().auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data } = await client().from('profiles').select('*').eq('id', uid).maybeSingle();
  return (data as Profile) ?? null;
}

export async function updateMyProfile(fields: Partial<Pick<Profile, 'full_name'>>): Promise<void> {
  const { data: auth } = await client().auth.getUser();
  if (!auth.user) return;
  const { error } = await client().from('profiles').update(fields).eq('id', auth.user.id);
  if (error) throw error;
}

// ── Repositories ─────────────────────────────────────────────────────────────
export async function listRepos(): Promise<Repo[]> {
  const { data, error } = await client().from('repositories').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function addRepo(orgId: string, fullName: string): Promise<Repo> {
  const { data, error } = await client().from('repositories')
    .insert({ org_id: orgId, full_name: fullName }).select().single();
  if (error) throw error;
  return data;
}
export async function toggleSentinel(id: string, sentinel: boolean): Promise<void> {
  const { error } = await client().from('repositories').update({ sentinel }).eq('id', id);
  if (error) throw error;
}
export async function removeRepo(id: string): Promise<void> {
  const { error } = await client().from('repositories').delete().eq('id', id);
  if (error) throw error;
}

// ── Hunts ────────────────────────────────────────────────────────────────────
export async function listHunts(): Promise<Hunt[]> {
  const { data, error } = await client().from('hunts').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}
export async function createHunt(orgId: string, repo: string): Promise<Hunt> {
  const { data, error } = await client().from('hunts')
    .insert({ org_id: orgId, repo, trigger: 'manual', status: 'queued' }).select().single();
  if (error) throw error;
  return data;
}
export async function listFindings(): Promise<Finding[]> {
  const { data, error } = await client().from('findings').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

/** Subscribe to live changes on a table for this org. Returns an unsubscribe fn. */
export function subscribe(table: 'hunts' | 'repositories' | 'findings', onChange: () => void): () => void {
  const ch = client()
    .channel(`realtime:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe();
  return () => { client().removeChannel(ch); };
}
