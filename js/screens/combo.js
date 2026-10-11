// «Свой набор»: уроки и отдельные слова с чекбоксами.

import { settings, combo } from '../store.js';
import { W, lessonWords, allWords } from '../data.js';
import { $, $$, icon, esc, nWords } from '../ui.js';
import { topbar } from '../components.js';
import { startSession, MODES } from '../session.js';

let selected = null;          // Set с id карточек
const expanded = new Set();   // раскрытые уроки

function ensureSelection() {
  if (!selected) {
    const ids = new Set(W.words.map((w) => w.id));
    selected = new Set(combo.get().filter((id) => ids.has(id)));
  }
  return selected;
}

function sync(root, save = true) {
  const sel = ensureSelection();
  for (const l of W.lessons) {
    const li = $(`.combo-lesson[data-lesson="${l.n}"]`, root);
    if (!li) continue;
    const words = lessonWords(l.n);
    let count = 0;
    for (const w of words) if (sel.has(w.id)) count += 1;
    const box = $('.lesson-check', li);
    box.checked = words.length > 0 && count === words.length;
    box.indeterminate = count > 0 && count < words.length;
    $('.combo-count', li).textContent = `${count} / ${words.length}`;
    li.classList.toggle('has-selection', count > 0);
    for (const cb of $$('.word-check', li)) cb.checked = sel.has(cb.dataset.id);
  }
  const n = allWords().filter((w) => sel.has(w.id)).length;
  const start = $('#combo-start', root);
  start.disabled = n === 0;
  start.setAttribute('aria-label', `Начать: ${nWords(n)}`);
  $('#combo-count', root).textContent = n;
  $('#combo-all', root).disabled = n === allWords().length;
  $('#combo-none', root).disabled = n === 0;
  if (save) combo.set([...sel]);
}

export default {
  tab: 'learn',

  html() {
    ensureSelection();
    const mode = MODES[settings.get().mode];
    const list = W.lessons.map((l) => {
      const open = expanded.has(l.n);
      const words = lessonWords(l.n).map((w) => `<li>
          <label class="combo-word">
            <input type="checkbox" class="check word-check" data-id="${esc(w.id)}">
            <span class="cw-hanzi" lang="zh-CN">${esc(w.hanzi)}</span>
            <span class="cw-meta"><span class="cw-pinyin">${esc(w.pinyin)}</span><span class="cw-tr">${esc(w.translation)}</span></span>
          </label>
        </li>`).join('');
      return `<li class="combo-lesson${open ? ' open' : ''}" data-lesson="${l.n}">
          <div class="combo-row">
            <label class="check-hit"><input type="checkbox" class="check lesson-check" aria-label="Выбрать все слова урока ${l.n}"></label>
            <button type="button" class="combo-toggle" data-act="toggle" aria-expanded="${open}" aria-controls="cw-${l.n}">
              <span class="combo-title">Урок ${l.n}</span>
              <span class="combo-count"></span>
              ${icon('chevronD', 'chev')}
            </button>
          </div>
          <ul class="combo-words" id="cw-${l.n}"${open ? '' : ' hidden'}>${words}</ul>
        </li>`;
    }).join('');

    return `
      ${topbar({ title: 'Свой набор', back: true })}
      <p class="screen-lead">Отметь уроки целиком или раскрой урок и выбери отдельные слова. Режим: ${mode.label}.</p>
      <div class="combo-toolbar">
        <button type="button" class="chip-btn" id="combo-all" data-act="all">Выбрать всё</button>
        <button type="button" class="chip-btn" id="combo-none" data-act="none">Снять всё</button>
      </div>
      <ul class="combo-list">${list}</ul>
      <div class="combo-bar">
        <button type="button" class="btn btn-primary btn-lg btn-block" id="combo-start" data-act="start" disabled>
          Начать <span class="count-badge" id="combo-count">0</span>
        </button>
      </div>`;
  },

  mount(root) { sync(root, false); },

  onChange(e, root) {
    const box = e.target;
    const sel = ensureSelection();
    if (box.classList.contains('lesson-check')) {
      const n = Number(box.closest('.combo-lesson').dataset.lesson);
      for (const w of lessonWords(n)) {
        if (box.checked) sel.add(w.id); else sel.delete(w.id);
      }
    } else if (box.classList.contains('word-check')) {
      if (box.checked) sel.add(box.dataset.id); else sel.delete(box.dataset.id);
    }
    sync(root);
  },

  actions: {
    toggle(el) {
      const li = el.closest('.combo-lesson');
      const n = Number(li.dataset.lesson);
      const open = !expanded.has(n);
      if (open) expanded.add(n); else expanded.delete(n);
      li.classList.toggle('open', open);
      el.setAttribute('aria-expanded', String(open));
      $('.combo-words', li).hidden = !open;
    },
    all(el) {
      const sel = ensureSelection();
      for (const w of allWords()) sel.add(w.id);
      sync(el.closest('.view'));
    },
    none(el) {
      ensureSelection().clear();
      sync(el.closest('.view'));
    },
    start() {
      const sel = ensureSelection();
      // Исходный порядок: урок, затем порядок в файле
      const words = allWords().filter((w) => sel.has(w.id));
      startSession({ kind: 'combined', title: 'Свой набор', words });
    },
  },
};
