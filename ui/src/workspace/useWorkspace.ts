import { useEffect, useState, useCallback } from 'react';
import { getMyOrg, getMyProfile, type Org, type Profile } from '../lib/db.ts';

export interface Workspace {
  org: Org | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads the signed-in user's organization and profile once. */
export function useWorkspace(): Workspace {
  const [org, setOrg] = useState<Org | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [o, p] = await Promise.all([getMyOrg(), getMyProfile()]);
      setOrg(o); setProfile(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { org, profile, loading, error, reload: load };
}
