// Общее для «Вариантов» и «Блица»: вопрос и подбор вариантов ответа.

import { esc, icon, hanziSize, shuffle, shortMeaning } from './ui.js';
import { allWords } from './data.js';

/** Ответ — перевод (для 汉字 → перевод и «на слух») или иероглифы. */
export const answersAreHanzi = (dir) => dir === 'ru2hz' || dir === 'py2hz';

export function optionLabel(w, dir) {
  return answersAreHanzi(dir) ? w.hanzi : shortMeaning(w.translation, 40);
}

export function questionHTML(w, dir) {
  if (dir === 'ru2hz') return `<div class="q-ru">${esc(w.translation)}</div>`;
  if (dir === 'py2hz') return `<div class="q-py">${esc(w.pinyin)}</div>`;
  if (dir === 'audio') {
    return `<button type="button" class="big-speak" data-act="speak-q" aria-label="Прослушать слово">${icon('speak')}</button>
      <p class="speak-note">Послушай и выбери перевод</p>`;
  }
  return `<div class="card-hanzi" lang="zh-CN" data-size="${hanziSize(w.hanzi)}">${esc(w.hanzi)}</div>`;
}

/** Правильный ответ + 3 других: сначала из того же урока, потом из всех слов. */
export function makeOptions(w, pool, dir, n = 4) {
  const label = (x) => optionLabel(x, dir);
  const labels = new Set([label(w)]);
  const picked = [];
  const sameLesson = shuffle(pool.filter((x) => x.lesson === w.lesson));
  const rest = shuffle(pool.filter((x) => x.lesson !== w.lesson));
  for (const x of [...sameLesson, ...rest, ...shuffle(allWords())]) {
    if (picked.length >= n - 1) break;
    if (x.key === w.key) continue;
    const l = label(x);
    if (labels.has(l)) continue;
    labels.add(l);
    picked.push(x);
  }
  return shuffle([w, ...picked]);
}

export function optionsHTML(opts, dir) {
  const zh = answersAreHanzi(dir);
  return opts.map((o, i) => `<button type="button" class="option" data-act="pick" data-i="${i}">
      <span class="num" aria-hidden="true">${i + 1}</span>
      <span class="${zh ? 'zh-opt' : ''}" ${zh ? 'lang="zh-CN"' : ''}>${esc(optionLabel(o, dir))}</span>
    </button>`).join('');
}
