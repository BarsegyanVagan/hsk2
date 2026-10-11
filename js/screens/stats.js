// «Прогресс»: цифры, календарь занятий, график, уроки, трудные слова, достижения.

import { activity, history, achievements } from '../store.js';
import { W, overallStats, lessonStats, hardWords } from '../data.js';
import { esc, formatDate, plural } from '../ui.js';
import { topbar, bar, wordRow } from '../components.js';
import { lineChart, heatmap, bindCharts } from '../charts.js';
import { ACH } from '../achievements.js';
import { nav, toast } from '../core.js';
import { startSession, MODES } from '../session.js';

function tile(value, label, sub = '') {
  return `<div class="tile-stat"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
}

export function resultPoints(limit = 30) {
  return history.list().slice(0, limit).reverse().map((h) => ({
    y: h.percent,
    label: `${h.title} · ${(MODES[h.mode] || MODES.cards).label}`,
    date: formatDate(h.date),
  }));
}

export default {
  tab: 'stats',

  html() {
    const st = overallStats();
    const tot = activity.totals();
    const acc = tot.a ? Math.round((tot.c / tot.a) * 100) : 0;
    const streak = activity.streak();
    const best = activity.bestStreak();
    const hard = hardWords(8);
    const unlocked = achievements.all();
    const got = ACH.filter((a) => unlocked[a.id]).length;

    const lessons = W.lessons.map((l) => {
      const ls = lessonStats(l.n);
      return `<div class="lb-row"><b>Урок ${l.n}</b>${bar(ls)}<span>${ls.learned}/${ls.total}</span></div>`;
    }).join('');

    const ach = ACH.map((a) => `
      <div class="ach ${unlocked[a.id] ? 'unlocked' : 'locked'}" title="${unlocked[a.id] ? `Получено: ${esc(formatDate(unlocked[a.id]))}` : 'Ещё не получено'}">
        <span class="emoji" aria-hidden="true">${a.emoji}</span><b>${esc(a.title)}</b><small>${esc(a.desc)}</small>
      </div>`).join('');

    return `
      ${topbar({ title: 'Прогресс' })}
      <div class="tiles">
        ${tile(`${st.learned}<small style="display:inline;font-size:.9rem">/${st.total}</small>`, 'выучено')}
        ${tile(st.learning, 'учу')}
        ${tile(`🔥 ${streak}`, `${plural(streak, 'день', 'дня', 'дней')} подряд`, `рекорд ${best}`)}
        ${tile(`${acc}%`, 'точность')}
        ${tile(tot.a, plural(tot.a, 'ответ', 'ответа', 'ответов'))}
        ${tile(history.list().length, plural(history.list().length, 'тренировка', 'тренировки', 'тренировок'))}
      </div>

      <h2 class="section-title">Календарь занятий</h2>
      <div class="panel">${heatmap(17)}</div>

      <h2 class="section-title">Результаты <button type="button" data-act="history">Вся история</button></h2>
      <div class="panel">${lineChart(resultPoints())}</div>

      <h2 class="section-title">По урокам</h2>
      <div class="panel lesson-bars">${lessons}</div>

      <h2 class="section-title">Трудные слова ${hard.length ? '<button type="button" data-act="train-hard">Тренировать</button>' : ''}</h2>
      ${hard.length ? `<ul class="word-list">${hard.map((w) => wordRow(w, { dot: true })).join('')}</ul>` : '<p class="panel" style="margin:0;color:var(--text-2)">Здесь соберутся слова, в которых ты чаще ошибаешься.</p>'}

      <h2 class="section-title">Достижения · ${got} из ${ACH.length}</h2>
      <div class="ach-grid">${ach}</div>`;
  },

  mount(root) { bindCharts(root); },

  actions: {
    history() { nav.push('history'); },
    'train-hard'() {
      const words = hardWords();
      if (!words.length) { toast('Трудных слов пока нет', { icon: '👍' }); return; }
      startSession({ kind: 'hard', title: 'Трудные слова', words });
    },
  },
};
