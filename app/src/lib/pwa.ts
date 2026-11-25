import { useEffect, useState } from 'react';

/**
 * Installability and update plumbing for the atlas.
 *
 * The manifest is the contract; this module only surfaces what the browser
 * already offers. Nothing here talks to a server of ours.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const installListeners = new Set<() => void>();
let deferredInstall: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser's mini-infobar out of the way and offer install where
    // it belongs in this interface.
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
    installListeners.forEach((listener) => listener());
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    installListeners.forEach((listener) => listener());
  });
}

function isStandaloneDisplay(): boolean {
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    iosStandalone ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

export function isIosDevice(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(
    () => deferredInstall !== null && !isStandaloneDisplay(),
  );
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplay());

  useEffect(() => {
    const syncInstall = () =>
      setCanInstall(deferredInstall !== null && !isStandaloneDisplay());
    const syncStandalone = () => setIsStandalone(isStandaloneDisplay());
    installListeners.add(syncInstall);
    window.addEventListener('appinstalled', syncStandalone);
    const modes = ['standalone', 'fullscreen', 'minimal-ui'].map((mode) =>
      window.matchMedia(`(display-mode: ${mode})`),
    );
    modes.forEach((media) => media.addEventListener('change', syncStandalone));
    syncInstall();
    syncStandalone();
    return () => {
      installListeners.delete(syncInstall);
      window.removeEventListener('appinstalled', syncStandalone);
      modes.forEach((media) => media.removeEventListener('change', syncStandalone));
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    const event = deferredInstall;
    if (!event) return false;
    deferredInstall = null;
    installListeners.forEach((listener) => listener());
    try {
      await event.prompt();
      const choice = await event.userChoice;
      return choice.outcome === 'accepted';
    } catch {
      return false;
    }
  };

  return { canInstall, isStandalone, promptInstall };
}

const updateListeners = new Set<(ready: boolean) => void>();
let waitingWorker: ServiceWorker | null = null;
let applyRequested = false;

function notifyUpdate() {
  updateListeners.forEach((listener) => listener(waitingWorker !== null));
}

export function onPwaUpdate(listener: (ready: boolean) => void): () => void {
  updateListeners.add(listener);
  listener(waitingWorker !== null);
  return () => {
    updateListeners.delete(listener);
  };
}

export function applyPwaUpdate(): void {
  if (!waitingWorker) return;
  applyRequested = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then((registration) => {
        const watchInstalling = (worker: ServiceWorker | null) => {
          if (!worker) return;
          const check = () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = worker;
              notifyUpdate();
            }
          };
          worker.addEventListener('statechange', check);
          check();
        };

        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting;
          notifyUpdate();
        }
        watchInstalling(registration.installing);
        registration.addEventListener('updatefound', () => {
          watchInstalling(registration.installing);
        });

        window.setInterval(() => {
          registration.update().catch(() => {
            /* Offline or rate-limited; the active shell still works. */
          });
        }, 60 * 60 * 1000);
      })
      .catch(() => {
        /* Registration fails on unsupported or insecure contexts. */
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applyRequested) return;
    applyRequested = false;
    window.location.reload();
  });
}
