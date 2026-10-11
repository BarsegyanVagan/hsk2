// Всё, что приложение хранит на устройстве (localStorage).
// Префикс отличается от первой версии приложения, чтобы данные не смешивались.

import { dayIndex } from './ui.js';

const PREFIX = 'hsk2b:';
const memory = new Map();

function read(key, fallback) {
  let raw = memory.has(key) ? memory.get(key) : null;
  if (raw === null) {
    try { raw = localStorage.getItem(PREFIX + key); } catch { raw = null; }
  }
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
function write(key, value) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try { localStorage.setItem(PREFIX + key, raw); } catch { /* остаётся в памяти */ }
}
function remove(key) {
  memory.delete(key);
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/* ---------- Настройки ---------- */
export const DEFAULTS = {
  mode: 'cards',          // cards | quiz | tones | match | blitz
  direction: 'hz2ru',     // hz2ru | ru2hz | py2hz | audio
  shuffle: false,
  pinyinInput: false,
  showExample: true,
  excludeExtra: false,
  dailyGoal: 20,
  sound: true,
  vibrate: true,
  ttsAuto: true,
  ttsRate: 'normal',      // slow | normal
  theme: 'system',        // system | light | dark
  accent: 'violet',
  hanziSize: 'm',         // s | m | l
};
let S = { ...DEFAULTS, ...(isObj(read('settings', null)) ? read('settings', {}) : {}) };
const settingsListeners = new Set();
export const settings = {
  get: () => S,
  set(patch) {
    S = { ...S, ...patch };
    write('settings', S);
    settingsListeners.forEach((fn) => fn(S, patch));
  },
  onChange(fn) { settingsListeners.add(fn); },
};

/* ---------- Интервальное повторение ----------
   Для каждого слова: b — коробка (0..6), d — день следующего повторения,
   c/w — верных/неверных ответов, l — день последнего ответа.
   Верный ответ в день повторения (или раньше срока не считается) двигает слово
   в следующую коробку; ошибка возвращает в начало. */
const INTERVALS = [0, 1, 2, 4, 7, 15, 30];
export const LEARNED_BOX = 4;
let P = read('progress', {});
if (!isObj(P)) P = {};
export const progress = {
  get: (key) => P[key] || null,
  all: () => P,
  status(key) {
    const p = P[key];
    if (!p || p.c + p.w === 0) return 'new';
    return p.b >= LEARNED_BOX ? 'learned' : 'learning';
  },
  isDue(key, t = dayIndex()) {
    const p = P[key];
    return !!p && p.c + p.w > 0 && p.d <= t;
  },
  record(key, correct, useSrs) {
    const t = dayIndex();
    const prev = P[key] ? { ...P[key] } : null;
    const p = P[key] ? { ...P[key] } : { b: 0, d: t, c: 0, w: 0, l: t };
    if (correct) p.c += 1; else p.w += 1;
    if (useSrs) {
      if (correct) {
        if (p.d <= t) {
          p.b = Math.min(p.b + 1, INTERVALS.length - 1);
          p.d = t + INTERVALS[p.b];
        }
      } else {
        p.b = 0;
        p.d = t;
      }
    }
    p.l = t;
    P[key] = p;
    write('progress', P);
    return prev;
  },
  restore(key, prev) {
    if (prev) P[key] = prev; else delete P[key];
    write('progress', P);
  },
};

/* ---------- Избранное ---------- */
let F = new Set(Array.isArray(read('favs', [])) ? read('favs', []) : []);
export const favs = {
  has: (k) => F.has(k),
  toggle(k) {
    if (F.has(k)) F.delete(k); else F.add(k);
    write('favs', [...F]);
    return F.has(k);
  },
  list: () => [...F],
  count: () => F.size,
};

/* ---------- История тестов ---------- */
const isEntry = (x) => x && typeof x === 'object' && Number.isFinite(x.percent)
  && Number.isFinite(x.total) && x.total > 0 && Number.isFinite(x.correct);
let H = read('history', []);
H = Array.isArray(H) ? H.filter(isEntry) : [];
export const history = {
  list: () => H,
  add(entry) {
    H = [entry, ...H].slice(0, 500);
    write('history', H);
  },
  clear() {
    H = [];
    remove('history');
  },
};

/* ---------- Активность по дням ---------- */
let A = read('activity', {});
if (!isObj(A)) A = {};
export const activity = {
  all: () => A,
  day: (d) => A[d] || { a: 0, c: 0, t: 0 },
  today: () => A[dayIndex()] || { a: 0, c: 0, t: 0 },
  add(correct, delta = 1) {
    const t = dayIndex();
    const r = { a: 0, c: 0, t: 0, ...(A[t] || {}) };
    r.a = Math.max(0, r.a + delta);
    if (correct) r.c = Math.max(0, r.c + delta);
    A[t] = r;
    write('activity', A);
  },
  addTest() {
    const t = dayIndex();
    const r = { a: 0, c: 0, t: 0, ...(A[t] || {}) };
    r.t += 1;
    A[t] = r;
    write('activity', A);
  },
  streak() {
    let t = dayIndex();
    if (!(A[t] && A[t].a > 0)) t -= 1;
    let n = 0;
    while (A[t] && A[t].a > 0) { n += 1; t -= 1; }
    return n;
  },
  bestStreak() {
    const days = Object.keys(A).map(Number).filter((d) => A[d].a > 0).sort((x, y) => x - y);
    let best = 0;
    let cur = 0;
    let prev = null;
    for (const d of days) {
      cur = prev !== null && d === prev + 1 ? cur + 1 : 1;
      best = Math.max(best, cur);
      prev = d;
    }
    return best;
  },
  totals() {
    let a = 0; let c = 0; let t = 0;
    for (const r of Object.values(A)) { a += r.a || 0; c += r.c || 0; t += r.t || 0; }
    return { a, c, t };
  },
};

/* ---------- Достижения ---------- */
let C = read('ach', {});
if (!isObj(C)) C = {};
export const achievements = {
  all: () => C,
  has: (id) => !!C[id],
  unlock(id) {
    if (C[id]) return false;
    C[id] = new Date().toISOString();
    write('ach', C);
    return true;
  },
};

/* ---------- Прочее ---------- */
let M = { bestBlitz: 0, viewed: [], written: 0, lastLesson: null, ...(isObj(read('meta', null)) ? read('meta', {}) : {}) };
export const meta = {
  get: () => M,
  set(patch) {
    M = { ...M, ...patch };
    write('meta', M);
  },
};

export const combo = {
  get: () => (Array.isArray(read('combo', [])) ? read('combo', []) : []),
  set: (ids) => write('combo', ids),
};

export const flags = {
  get: (name) => read(`flag.${name}`, false) === true,
  set: (name) => write(`flag.${name}`, true),
};

/* ---------- Экспорт / импорт ---------- */
const KEYS = ['settings', 'progress', 'favs', 'history', 'activity', 'ach', 'meta', 'combo'];
export const APP_ID = 'hsk2-cards';

export function exportData() {
  const data = {};
  for (const k of KEYS) data[k] = read(k, null);
  return { app: APP_ID, version: 2, exportedAt: new Date().toISOString(), data };
}
export function importData(obj) {
  if (!obj || obj.app !== APP_ID || !isObj(obj.data)) throw new Error('Это не файл прогресса HSK 2');
  for (const k of KEYS) {
    if (obj.data[k] !== null && obj.data[k] !== undefined) write(k, obj.data[k]);
    else remove(k);
  }
}
export function resetProgress() {
  for (const k of KEYS) if (k !== 'settings') remove(k);
}
