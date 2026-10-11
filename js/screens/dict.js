// Словарь: поиск по иероглифам, пиньиню (можно без тонов) и переводу; фильтры.

import { W, searchEntries } from '../data.js';
import { $, esc, icon, nWords } from '../ui.js';
import { topbar, wordRow } from '../components.js';

const F = { q: '', lesson: 0, status: 'all' };
let debounce = 0;

const STATUSES = [
  ['all', 'Все'],
  ['new', 'Новые'],
  ['learning', 'Учу'],
  ['learned', 'Выучено'],
  ['fav', '⭐ Избранное'],
  ['extra', '★ Сверх HSK 2'],
];

function renderList(root) {
  const list = searchEntries(F.q, F);
  $('#dcount', root).textContent = list.length ? `Найдено: ${nWords(list.length)}` : 'Ничего не найдено';
  $('#dlist', root).innerHTML = list.map((e) => wordRow(e.word, { dot: true })).join('');
}

export default {
  tab: 'dict',

  html() {
    const lessons = W.lessons.map((l) => `<option value="${l.n}" ${F.lesson === l.n ? 'selected' : ''}>Урок ${l.n}</option>`).join('');
    const chips = STATUSES.map(([id, label]) => `<button type="button" class="chip-btn" data-act="status" data-s="${id}" aria-pressed="${F.status === id}">${label}</button>`).join('');
    return `
      ${topbar({ title: 'Словарь', sub: `${nWords(W.entries.length)} из учебника 新HSK教程 2` })}
      <div class="search-box">
        ${icon('search')}
        <input class="search" id="dq" type="search" value="${esc(F.q)}" placeholder="Иероглиф, пиньинь или перевод"
          autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Поиск по словарю">
      </div>
      <div class="filters">
        <select class="select" id="dlesson" aria-label="Урок">
          <option value="0">Все уроки</option>${lessons}
        </select>
        ${chips}
      </div>
      <p class="result-count" id="dcount"></p>
      <ul class="word-list" id="dlist"></ul>`;
  },

  mount(root) { renderList(root); },

  onInput(e, root) {
    if (e.target.id !== 'dq') return;
    F.q = e.target.value;
    clearTimeout(debounce);
    debounce = setTimeout(() => renderList(root), 90);
  },

  onChange(e, root) {
    if (e.target.id !== 'dlesson') return;
    F.lesson = Number(e.target.value);
    renderList(root);
  },

  actions: {
    status(el) {
      F.status = el.dataset.s;
      for (const b of el.parentElement.querySelectorAll('[data-act="status"]')) b.setAttribute('aria-pressed', String(b === el));
      renderList(el.closest('.view'));
    },
  },
};
