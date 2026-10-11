// Точка входа: экраны, общие обработчики, оформление, запуск.

import { $ } from './ui.js';
import { settings, favs } from './store.js';
import { loadWords, W, dueWords } from './data.js';
import { app, nav, toast, closeModal, isModalOpen } from './core.js';
import { syncSoundButtons, syncFavButtons } from './components.js';
import { registerServiceWorker, onInstallChange } from './pwa.js';
import * as audio from './audio.js';

import home from './screens/home.js';
import learn from './screens/learn.js';
import combo from './screens/combo.js';
import cards from './screens/cards.js';
import quiz from './screens/quiz.js';
import blitz from './screens/blitz.js';
import tones from './screens/tones.js';
import match from './screens/match.js';
import result from './screens/result.js';
import dict from './screens/dict.js';
import word from './screens/word.js';
import stats from './screens/stats.js';
import historyScreen from './screens/history.js';
import settingsScreen from './screens/settings.js';

app.screens = {
  home, learn, combo, cards, quiz, blitz, tones, match, result, dict, word, stats,
  history: historyScreen,
  settings: settingsScreen,
};

/* ---------- Оформление ---------- */
function applyAppearance() {
  const s = settings.get();
  const root = document.documentElement;
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme;
  else delete root.dataset.theme;
  if (s.accent && s.accent !== 'violet') root.dataset.accent = s.accent;
  else delete root.dataset.accent;
  if (s.hanziSize && s.hanziSize !== 'm') root.dataset.hz = s.hanziSize;
  else delete root.dataset.hz;
  const bg = getComputedStyle(document.body).backgroundColor;
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', bg);
}

settings.onChange((s, patch) => {
  if ('theme' in patch || 'accent' in patch || 'hanziSize' in patch) applyAppearance();
  if ('sound' in patch) syncSoundButtons();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyAppearance);

/* ---------- Общие действия (кнопки с data-act) ---------- */
const GLOBAL = {
  back() { nav.back('home'); },
  tab(el) { nav.tab(el.dataset.tab); },
  sound() {
    const on = !settings.get().sound;
    settings.set({ sound: on });
    if (on) {
      audio.prepare();
      audio.play('toggle');
    }
  },
  speak(el) {
    if (!audio.speak(el.dataset.text)) toast('Китайский голос на устройстве не найден', { icon: '🔇' });
  },
  fav(el) {
    const key = el.dataset.key;
    const on = favs.toggle(key);
    syncFavButtons(key);
    audio.play('tap');
    toast(on ? 'Добавлено в избранное' : 'Убрано из избранного', { icon: on ? '⭐' : '☆', timeout: 1400 });
  },
  word(el) { nav.push('word', { key: el.dataset.key }); },
  reload() { window.location.reload(); },
  'modal-ok'() { closeModal(true); },
  'modal-cancel'() { closeModal(false); },
};

const current = () => app.screens[app.current];

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  if (act === 'modal-ok' || act === 'modal-cancel') { GLOBAL[act](el, e); return; }
  const scr = current();
  if (scr && scr.actions && scr.actions[act]) scr.actions[act](el, e);
  else if (GLOBAL[act]) GLOBAL[act](el, e);
});

document.addEventListener('change', (e) => {
  const scr = current();
  if (scr && scr.onChange) scr.onChange(e, $('#view'));
});
document.addEventListener('input', (e) => {
  const scr = current();
  if (scr && scr.onInput) scr.onInput(e, $('#view'));
});
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const scr = current();
  if (scr && scr.onSubmit) scr.onSubmit(e);
});

document.addEventListener('keydown', (e) => {
  if (isModalOpen()) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const next = document.activeElement === $('#modal-cancel') ? $('#modal-ok') : $('#modal-cancel');
      next.focus();
    }
    return;
  }
  const scr = current();
  if (scr && scr.onKey) scr.onKey(e);
});

// Звук в Safari включается только по действию пользователя
for (const type of ['touchend', 'click', 'keydown']) {
  document.addEventListener(type, audio.prepare, { capture: true, passive: true });
}
// Без случайного зума щипком
document.addEventListener('gesturestart', (e) => e.preventDefault());

/* ---------- Значок повторений на вкладке «Учить» ---------- */
app.afterShow = () => {
  const badge = $('#due-badge');
  if (!badge) return;
  const n = W.words.length ? dueWords().length : 0;
  badge.hidden = n === 0;
  badge.textContent = n > 99 ? '99+' : String(n);
};

onInstallChange(() => {
  if (app.current === 'home') nav.refresh();
});

/* ---------- Запуск ---------- */
async function init() {
  applyAppearance();
  try {
    await loadWords();
  } catch (err) {
    console.error('Не удалось загрузить слова:', err);
    $('#view').innerHTML = `<div class="empty"><p>Не удалось загрузить слова (data/words.json).</p>
      <button type="button" class="btn btn-primary" data-act="reload">Обновить страницу</button></div>`;
    return;
  }
  nav.init('home');
}

registerServiceWorker();
init();
