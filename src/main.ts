import { bootstrapApplication } from '@angular/platform-browser';
import { filter, take } from 'rxjs/operators';
import { appConfig } from './app/app.config';
import { App } from './app/app';

declare global {
  interface Window {
    __PLANETA_BOOT_TS__?: number;
  }
}

function setupStartupReveal() {
  if (typeof window === 'undefined') return null;

  const root = document.documentElement;
  const splash = document.getElementById('startup-splash');
  const startedAt = Number(window.__PLANETA_BOOT_TS__ ?? Date.now());
  const minVisibleMs = 340;

  let revealed = false;

  const reveal = () => {
    if (revealed) return;
    revealed = true;

    root.classList.add('app-ready');
    root.classList.remove('app-booting');

    if (splash) {
      window.setTimeout(() => splash.remove(), 420);
    }
  };

  const scheduleReveal = () => {
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, minVisibleMs - elapsed);

    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => reveal()));
    }, wait);
  };

  return { reveal, scheduleReveal };
}

const startupReveal = setupStartupReveal();

bootstrapApplication(App, appConfig)
  .then((appRef) => {
    if (!startupReveal || typeof window === 'undefined') return;

    const hardTimeout = window.setTimeout(() => {
      startupReveal.reveal();
    }, 5000);

    appRef.isStable.pipe(filter(Boolean), take(1)).subscribe({
      next: () => {
        clearTimeout(hardTimeout);
        startupReveal.scheduleReveal();
      },
      error: () => {
        clearTimeout(hardTimeout);
        startupReveal.reveal();
      },
    });
  })
  .catch((err) => {
    startupReveal?.reveal();
    console.error(err);
  });
