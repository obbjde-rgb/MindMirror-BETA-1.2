import { useEffect, useState } from 'react';
import { PERMANENT_PRODUCTION_APP_URL } from '../constants';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const [isIframe, setIsIframe] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect iframe
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }

    // Detect standalone mode (already installed)
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        const isStandalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true;
        setIsInstalled(isStandalone);
      }
    } catch (e) {
      console.warn('[PWA] Standalone detection failed:', e);
      setIsInstalled(false);
    }

    // Detect iOS devices
    try {
      if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent) {
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIOSDevice);
      }
    } catch (e) {
      setIsIOS(false);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA] beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] appinstalled event fired');
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Check if the event was already captured in main.tsx
    if ((window as any).deferredPWAEvent) {
      console.log('[PWA] Using pre-captured deferredPWAEvent');
      setDeferredPrompt((window as any).deferredPWAEvent);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Also listen for the custom event from main.tsx
    const handlePromptReady = (e: any) => {
      console.log('[PWA] Received pwa-prompt-ready custom event');
      setDeferredPrompt(e.detail);
    };
    window.addEventListener('pwa-prompt-ready', handlePromptReady);

    // Listen for update available event from main.tsx
    const handleUpdateAvailable = (e: any) => {
      console.log('[PWA] Update available');
      setIsUpdateAvailable(true);
      setRegistration(e.detail);
    };
    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) {
      console.warn('[PWA] Install called but no deferredPrompt available');
      return false;
    }
    try {
      console.log('[PWA] Triggering install prompt...');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] User choice: ${outcome}`);
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        (window as any).deferredPWAEvent = null;
        return true;
      }
    } catch (err) {
      console.error('[PWA] Install failed:', err);
    }
    return false;
  };

  const applyUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  const getDirectInstallUrl = () => {
    try {
      // Always guarantee the production / shared URL is returned so that installing from browser
      // uses the permanent production application and never the temporary developer environment.
      if (typeof window !== 'undefined' && window.location.host) {
        if (window.location.host.includes('ais-dev-')) {
          return window.location.origin.replace('ais-dev-', 'ais-pre-') + '/';
        }
        if (window.location.host.includes('ais-pre-')) {
          return window.location.origin + '/';
        }
      }
      return PERMANENT_PRODUCTION_APP_URL;
    } catch (e) {
      return PERMANENT_PRODUCTION_APP_URL;
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isIframe,
    isUpdateAvailable,
    install,
    applyUpdate,
    getDirectInstallUrl,
  };
}
