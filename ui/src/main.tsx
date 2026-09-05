import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import AppShell from './app/AppShell.tsx';
import { Landing } from './Landing.tsx';
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx';
import { Login } from './auth/Login.tsx';
import './index.css';

/** Full-screen spinner while the session is being restored. */
function Booting() {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div className="mesh"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>
      <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-sub">Loading your workspace...</div>
    </div>
  );
}

/**
 * A tiny hash router keeps the bundle dependency-free. The marketing landing
 * page at "/" is public; the dashboard at "#app" requires a signed-in user
 * whenever Supabase is configured.
 */
// After sign-in Supabase sends us back to "/?goto=app". Read that intent once,
// before anything strips the query, so we can land the user on the dashboard.
const cameFromAuth = new URLSearchParams(window.location.search).get('goto') === 'app';

function Routes() {
  const [route, setRoute] = useState(() =>
    window.location.hash.startsWith('#app') || cameFromAuth ? 'app' : 'home');
  const { user, loading, configured } = useAuth();

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.startsWith('#app') ? 'app' : 'home');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Once the session settles after an auth redirect, tidy the URL to a clean #app.
  useEffect(() => {
    if (cameFromAuth && !loading && user) {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('code')) {  // wait until Supabase has consumed the login code
        window.history.replaceState(null, '', `${url.pathname}#app`);
        setRoute('app');
      }
    }
  }, [loading, user]);

  if (route !== 'app') return <Landing />;
  if (loading) return <Booting />;
  if (configured && !user) return <Login />;
  return <AppShell />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <Routes />
    </AuthProvider>
  </React.StrictMode>,
);
