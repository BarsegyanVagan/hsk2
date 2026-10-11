// Установка приложения на устройство и обновление до новой версии.

import { toast } from './core.js';

let installEvent = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Можно ли показать свою кнопку «Установить» (Chrome, Edge, Android). */
export const canInstall = () => !!installEvent && !isStandalone();
export const onInstallChange = (fn) => listeners.add(fn);

export async function install() {
  if (!installEvent) return;
  const ev = installEvent;
  installEvent = null;
  ev.prompt();
  try { await ev.userChoice; } catch { /* ignore */ }
  notify();
}

window.addEventListener('beforeinstallprompt', (e) => {
  // Показываем установку своей кнопкой на главном экране
  e.preventDefault();
  installEvent = e;
  notify();
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  notify();
});

/* ---------- Офлайн-режим и обновления ---------- */
let reloadOnChange = false;

function offerUpdate(worker) {
  toast('Доступна новая версия приложения', {
    icon: '✨',
    timeout: 15000,
    action: {
      label: 'Обновить',
      fn: () => {
        reloadOnChange = true;
        worker.postMessage({ type: 'activate-update' });
      },
    },
  });
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadOnChange) window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch((err) => console.warn('Service worker:', err));
  });
}
