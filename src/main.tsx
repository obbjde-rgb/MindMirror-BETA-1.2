import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import AppQuantum from './AppQuantum.tsx';
import DeveloperGuide from './components/DeveloperGuide.tsx';
import PWAInstallPage from './components/PWAInstallPage.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { ToastProvider } from './components/Toast';

// Global capture for PWA installation event to ensure it's not missed if it fires early
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).deferredPWAEvent = e;
    window.dispatchEvent(new CustomEvent('pwa-prompt-ready', { detail: e }));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/quantum" element={<AppQuantum />} />
            <Route path="/docs" element={<DeveloperGuide />} />
            <Route path="/install" element={<PWAInstallPage />} />
            <Route path="*" element={<App />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Instant Live-Sync Watcher: detects any code/build revision change on server & updates preview automatically without manual refresh
if (typeof window !== 'undefined') {
  let baselineBuildToken: string | null = null;
  let isReloadScheduled = false;

  const performCacheCleanReload = async () => {
    if (isReloadScheduled) return;
    isReloadScheduled = true;

    try {
      const lastReloadTs = Number(sessionStorage.getItem('mm_last_auto_reload_ts') || '0');
      if (Date.now() - lastReloadTs < 2500) {
        isReloadScheduled = false;
        return;
      }
      sessionStorage.setItem('mm_last_auto_reload_ts', String(Date.now()));
    } catch {}

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        reg?.active?.postMessage({ type: 'FORCE_PURGE_CACHES' });
      }
    } catch {}

    window.location.reload();
  };

  const checkBuildVersion = async (forceTrigger = false) => {
    try {
      const res = await fetch(`/api/app-build-version?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const token = String(data?.token || '');
      if (!token) return;

      if (baselineBuildToken === null) {
        baselineBuildToken = token;
        return;
      }

      if (token !== baselineBuildToken || forceTrigger) {
        baselineBuildToken = token;
        await performCacheCleanReload();
      }
    } catch {}
  };

  // Establish initial baseline immediately
  checkBuildVersion(false);

  // Light visibility-aware polling so edits apply instantaneously without user refreshing manually
  const pollInterval = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkBuildVersion(false);
    }
  }, 3000);

  window.addEventListener('beforeunload', () => window.clearInterval(pollInterval));
  window.addEventListener('mindmirror-trigger-live-sync', () => {
    checkBuildVersion(true);
  });
}

// Register Service Worker for PWA cleanly with instant cache purge on update
if ('serviceWorker' in navigator) {
  const registerSW = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      if (registration) {
        registration.update().catch(() => {});

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: registration }));
              }
            });
          }
        });
      }
    } catch (error) {
      console.warn('[PWA] Service Worker registration notice:', error);
    }
  };

  registerSW();

  let refreshingOnController = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingOnController) return;
    refreshingOnController = true;
    try {
      const last = Number(sessionStorage.getItem('mm_sw_reload_ts') || '0');
      if (Date.now() - last > 4000) {
        sessionStorage.setItem('mm_sw_reload_ts', String(Date.now()));
        window.location.reload();
      }
    } catch {}
  });
}
