import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { Landing } from './Landing.tsx';
import './index.css';

/**
 * A tiny hash router keeps the bundle dependency-free: the marketing landing
 * page lives at "/", and the live dashboard at "#app". The hub serves this same
 * index.html for every path, so the client decides what to show.
 */
function Root() {
  const [route, setRoute] = useState(() => (window.location.hash === '#app' ? 'app' : 'home'));
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash === '#app' ? 'app' : 'home');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route === 'app' ? <App /> : <Landing />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
