// «Учить»: режим, направление, наборы и уроки.

import { settings, history } from '../store.js';
import { W, lessonWords, lessonStats, dueWords, hardWords, favWords, allWords } from '../data.js';
import { icon, esc, nWords, scoreClass } from '../ui.js';
import { topbar, soundBtn, bar } from '../components.js';
import { startSession, MODES, DIRECTIONS } from '../session.js';
import { nav, toast } from '../core.js';

const WITH_DIRECTION = ['cards', 'quiz', 'blitz'];

function setBtn(act, ic, title, count) {
  return `<button type="button" class="quick" data-act="${act}">
    <span class="q-icon">${icon(ic)}</span>
    <span><b>${title}</b><small>${count}</small></span>
  </button>`;
}

export default {
  tab: 'learn',

  html() {
    const s = settings.get();
    const lastScore = new Map();
    for (const h of history.list()) {
      if (h.kind === 'lesson' && h.mode === s.mode && !lastScore.has(h.lesson)) lastScore.set(h.lesson, h.percent);
    }

    const modes = Object.entries(MODES).map(([id, m]) => `
      <button type="button" class="mode" data-act="mode" data-mode="${id}" aria-pressed="${s.mode === id}">
        <span class="m-icon">${icon(m.icon)}</span>${m.label}
      </button>`).join('');

    const dirs = WITH_DIRECTION.includes(s.mode) ? `
      <div class="dir-box">
        <div class="seg" role="group" aria-label="Направление">
          ${Object.entries(DIRECTIONS).map(([id, label]) => `<button type="button" data-act="dir" data-dir="${id}" aria-pressed="${s.direction === id}">${label}</button>`).join('')}
        </div>
        ${s.mode === 'blitz' && s.direction === 'audio' ? '<p class="mode-desc">В блице «на слух» заменяется на 汉字 → перевод.</p>' : ''}
      </div>` : '';

    const lessons = W.lessons.map((l) => {
      const words = lessonWords(l.n);
      const st = lessonStats(l.n);
      const p = lastScore.get(l.n);
      const done = st.total > 0 && st.learned === st.total;
      return `<button type="button" class="lesson-card${done ? ' done' : ''}" data-act="lesson" data-lesson="${l.n}">
        <span class="lesson-title">Урок ${l.n}</span>
        <span class="lesson-meta">${nWords(words.length)} · выучено ${st.learned}</span>
        <span class="lesson-preview" lang="zh-CN">${words.slice(0, 4).map((w) => esc(w.hanzi)).join(' · ')}</span>
        ${bar(st)}
        ${p === undefined ? '' : `<span class="score-pill ${scoreClass(p)}-c" title="Последний результат">${p}%</span>`}
      </button>`;
    }).join('');

    return `
      ${topbar({ title: 'Учить', actions: soundBtn() })}
      <div class="modes" role="group" aria-label="Режим">${modes}</div>
      <p class="mode-desc">${MODES[s.mode].desc}</p>
      ${dirs}

      <h2 class="section-title">Наборы</h2>
      <div class="sets">
        ${setBtn('review', 'refresh', 'Повторить сегодня', nWords(dueWords().length))}
        ${setBtn('hard', 'alert', 'Трудные', nWords(hardWords().length))}
        ${setBtn('fav', 'star', 'Избранное', nWords(favWords().length))}
        ${setBtn('combo', 'layers', 'Свой набор', 'уроки и слова')}
      </div>

      <h2 class="section-title">Уроки <button type="button" data-act="all">Все слова</button></h2>
      <div class="lesson-grid">${lessons}</div>`;
  },

  actions: {
    mode(el) {
      settings.set({ mode: el.dataset.mode });
      nav.refresh();
    },
    dir(el) {
      settings.set({ direction: el.dataset.dir });
      nav.refresh();
    },
    lesson(el) {
      const n = Number(el.dataset.lesson);
      startSession({ kind: 'lesson', lesson: n, title: `Урок ${n}`, words: lessonWords(n) });
    },
    review() {
      const words = dueWords();
      if (!words.length) { toast('На сегодня повторять нечего — учи новые слова', { icon: '🎉' }); return; }
      startSession({ kind: 'review', title: 'Повторение', words });
    },
    hard() {
      const words = hardWords();
      if (!words.length) { toast('Трудных слов пока нет', { icon: '👍' }); return; }
      startSession({ kind: 'hard', title: 'Трудные слова', words });
    },
    fav() {
      const words = favWords();
      if (!words.length) { toast('Отмечай слова звёздочкой ⭐ — они появятся здесь', { icon: '⭐' }); return; }
      startSession({ kind: 'fav', title: 'Избранное', words });
    },
    combo() { nav.push('combo'); },
    all() { startSession({ kind: 'all', title: 'Все слова', words: allWords() }); },
  },
};
