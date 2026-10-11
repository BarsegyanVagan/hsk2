// Повторяющиеся куски разметки.

import { settings, favs, progress } from './store.js';
import { icon, esc } from './ui.js';

export function topbar({ title, sub = '', back = false, actions = '' }) {
  return `<header class="topbar">
    ${back ? `<button type="button" class="icon-btn" data-act="back" aria-label="Назад">${icon('back')}</button>` : ''}
    <div class="topbar-title"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
    ${actions ? `<div class="topbar-actions">${actions}</div>` : ''}
  </header>`;
}

export function soundBtn() {
  const on = settings.get().sound;
  return `<button type="button" class="icon-btn sound-toggle" data-act="sound" aria-pressed="${on}"
    aria-label="${on ? 'Звуки включены' : 'Звуки выключены'}" title="Звуки">${icon(on ? 'soundOn' : 'soundOff')}</button>`;
}

export function syncSoundButtons() {
  const on = settings.get().sound;
  for (const b of document.querySelectorAll('.sound-toggle')) {
    b.innerHTML = icon(on ? 'soundOn' : 'soundOff');
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Звуки включены' : 'Звуки выключены');
  }
}

export function favBtn(key, cls = 'row-btn') {
  const on = favs.has(key);
  return `<button type="button" class="${cls}${on ? ' on' : ''}" data-act="fav" data-key="${esc(key)}"
    aria-pressed="${on}" aria-label="${on ? 'Убрать из избранного' : 'В избранное'}">${icon('star')}</button>`;
}

export function syncFavButtons(key) {
  const on = favs.has(key);
  for (const b of document.querySelectorAll('[data-act="fav"]')) {
    if (b.dataset.key !== key) continue;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Убрать из избранного' : 'В избранное');
  }
}

export function speakBtn(text, cls = 'row-btn', label = 'Произнести') {
  return `<button type="button" class="${cls}" data-act="speak" data-text="${esc(text)}" aria-label="${label}">${icon('speak')}</button>`;
}

export const STATUS_LABEL = { new: 'Новое', learning: 'Учу', learned: 'Выучено' };

export function statusChip(key) {
  const s = progress.status(key);
  return `<span class="chip st-${s}">${STATUS_LABEL[s]}</span>`;
}

/** Полоска прогресса: выучено + учу. */
export function bar(st) {
  const p1 = st.total ? (st.learned / st.total) * 100 : 0;
  const p2 = st.total ? (st.learning / st.total) * 100 : 0;
  return `<div class="bar" role="img" aria-label="Выучено ${st.learned} из ${st.total}, учу ${st.learning}">
    ${p1 > 0 ? `<span class="b-learned" style="width:${p1.toFixed(1)}%"></span>` : ''}
    ${p2 > 0 ? `<span class="b-learning" style="width:${p2.toFixed(1)}%"></span>` : ''}
  </div>`;
}

/** Строка слова в списках: открывает страницу слова; озвучка и избранное справа. */
export function wordRow(w, { dot = false } = {}) {
  const st = progress.status(w.key);
  return `<li class="word-row">
    <button type="button" class="word-row-main" data-act="word" data-key="${esc(w.key)}">
      <span class="wr-hanzi" lang="zh-CN">${esc(w.hanzi)}</span>
      <span class="wr-meta"><span class="wr-pinyin">${esc(w.pinyin)}</span><span class="wr-tr">${esc(w.translation)}</span></span>
    </button>
    ${dot ? `<span class="status-dot ${st}" title="${STATUS_LABEL[st]}"></span>` : ''}
    ${speakBtn(w.hanzi)}
    ${favBtn(w.key)}
  </li>`;
}

export function chipsFor(w) {
  return `${w.extra ? '<span class="chip extra" title="Сверх программы HSK 2">★ сверх HSK 2</span>' : ''}${w.proper ? '<span class="chip muted">имя собств.</span>' : ''}`;
}
