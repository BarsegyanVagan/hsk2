// Слова из data/words.json и наборы для тренировок.

import { progress, favs, settings } from './store.js';
import { toneless } from './pinyin.js';

export const W = {
  words: [],          // карточки в порядке: урок, затем порядок в файле
  lessons: [],        // [{ n, words }]
  byId: new Map(),
  entries: [],        // уникальные слова (одно слово может быть в двух уроках)
  byKey: new Map(),
};

export async function loadWords() {
  const res = await fetch('data/words.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error('words.json: ожидается массив');

  const seen = new Map();
  const words = [];
  raw.forEach((w, idx) => {
    if (!w || typeof w !== 'object') return;
    const lesson = Number(w.lesson);
    const hanzi = String(w.hanzi || '').trim();
    const pinyin = String(w.pinyin || '').trim();
    const translation = String(w.translation || '').trim();
    if (!Number.isFinite(lesson) || !hanzi || !pinyin || !translation) return;
    const key = `${hanzi}|${pinyin}`;
    let id = `${lesson}|${key}`;
    const k = seen.get(id) || 0;
    seen.set(id, k + 1);
    if (k) id += `#${k}`;
    const ex = w.example && w.example.zh && w.example.py && w.example.ru
      ? { zh: String(w.example.zh), py: String(w.example.py), ru: String(w.example.ru) }
      : null;
    words.push({
      id, key, idx, lesson, hanzi, pinyin, translation,
      extra: !!w.extra,
      proper: !!w.proper,
      example: ex,
      sPy: toneless(pinyin).replace(/[^a-zü]/g, ''),
      sRu: translation.toLowerCase().replace(/ё/g, 'е'),
    });
  });
  if (!words.length) throw new Error('В words.json нет слов');

  words.sort((a, b) => a.lesson - b.lesson || a.idx - b.idx);
  const groups = new Map();
  for (const w of words) {
    if (!groups.has(w.lesson)) groups.set(w.lesson, []);
    groups.get(w.lesson).push(w);
  }
  const entries = new Map();
  for (const w of words) {
    let e = entries.get(w.key);
    if (!e) {
      e = { key: w.key, word: w, lessons: [], examples: [] };
      entries.set(w.key, e);
    }
    if (!e.lessons.includes(w.lesson)) e.lessons.push(w.lesson);
    if (w.example && !e.examples.some((x) => x.zh === w.example.zh)) e.examples.push(w.example);
  }

  W.words = words;
  W.lessons = Array.from(groups, ([n, list]) => ({ n, words: list }));
  W.byId = new Map(words.map((w) => [w.id, w]));
  W.byKey = entries;
  W.entries = [...entries.values()];
}

const extraOff = () => settings.get().excludeExtra;

export const visible = (list) => (extraOff() ? list.filter((w) => !w.extra) : list);
export const allWords = () => visible(W.words);
export const lessonWords = (n) => visible((W.lessons.find((l) => l.n === n) || { words: [] }).words);

export function uniqueWords(list) {
  const seen = new Set();
  return list.filter((w) => {
    if (seen.has(w.key)) return false;
    seen.add(w.key);
    return true;
  });
}

/** Слова, которые пора повторить сегодня. */
export const dueWords = () => uniqueWords(allWords()).filter((w) => progress.isDue(w.key));

/** Слова, в которых чаще ошибаешься. */
export function hardWords(limit = 30) {
  const all = progress.all();
  const score = (p) => (p.w + 1) / (p.c + 2);
  return uniqueWords(allWords())
    .map((w) => ({ w, p: all[w.key] }))
    .filter((x) => x.p && x.p.w > 0 && score(x.p) >= 0.5)
    .sort((a, b) => score(b.p) - score(a.p) || b.p.w - a.p.w)
    .slice(0, limit)
    .map((x) => x.w);
}

export const favWords = () => uniqueWords(allWords()).filter((w) => favs.has(w.key));

export function statsFor(list) {
  const keys = new Set(list.map((w) => w.key));
  let learned = 0;
  let learning = 0;
  for (const k of keys) {
    const s = progress.status(k);
    if (s === 'learned') learned += 1;
    else if (s === 'learning') learning += 1;
  }
  return { total: keys.size, learned, learning, fresh: keys.size - learned - learning };
}
export const lessonStats = (n) => statsFor(lessonWords(n));
export const overallStats = () => statsFor(allWords());

export function firstLessonWithNew() {
  for (const l of W.lessons) {
    if (lessonWords(l.n).some((w) => progress.status(w.key) === 'new')) return l.n;
  }
  return W.lessons.length ? W.lessons[0].n : 1;
}

/** Поиск по словарю: иероглифы, пиньинь (можно без тонов) или перевод. */
export function searchEntries(q, { lesson = 0, status = 'all' } = {}) {
  const query = String(q).trim().toLowerCase().replace(/ё/g, 'е');
  const hasCjk = /[㐀-鿿]/.test(query);
  const hasCyr = /[а-я]/.test(query);
  const qPy = toneless(query.replace(/v/g, 'ü')).replace(/[^a-zü]/g, '');
  return W.entries.filter((e) => {
    const w = e.word;
    if (extraOff() && w.extra) return false;
    if (lesson && !e.lessons.includes(lesson)) return false;
    if (status === 'fav' && !favs.has(e.key)) return false;
    if (status === 'extra' && !w.extra) return false;
    if (['new', 'learning', 'learned'].includes(status) && progress.status(e.key) !== status) return false;
    if (!query) return true;
    if (hasCjk) return w.hanzi.includes(query);
    if (hasCyr) return w.sRu.includes(query);
    return qPy ? w.sPy.includes(qPy) : true;
  });
}
