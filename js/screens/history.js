// История тренировок: средний результат, график, список, очистка.

import { history } from '../store.js';
import { esc, icon, formatDate, nWords, scoreClass } from '../ui.js';
import { topbar } from '../components.js';
import { lineChart, bindCharts } from '../charts.js';
import { nav, confirmDialog } from '../core.js';
import { MODES } from '../session.js';
import { resultPoints } from './stats.js';

export default {
  tab: 'stats',

  html() {
    const items = history.list();
    const has = items.length > 0;
    const avg = has ? Math.round((items.reduce((s, h) => s + h.correct / h.total, 0) / items.length) * 100) : null;
    const list = items.map((h) => {
      const mode = (MODES[h.mode] || MODES.cards).label;
      const detail = h.mode === 'blitz' ? `счёт ${h.score ?? h.correct}` : `верно ${h.correct} из ${h.total}`;
      return `<li class="history-item">
        <div class="hi-main">
          <span class="hi-title">${esc(h.title || 'Тренировка')} · ${mode} · ${nWords(h.total)}</span>
          <span class="hi-date">${esc(formatDate(h.date))} · ${detail}</span>
        </div>
        <span class="hi-score ${scoreClass(h.percent)}-c">${h.percent}%</span>
      </li>`;
    }).join('');

    return `
      ${topbar({ title: 'История', back: true })}
      <div class="avg-card">
        <div>
          <div class="avg-label">Средний результат</div>
          <div class="avg-sub">${has ? `Тренировок: ${items.length}` : 'Пока нет пройденных тренировок'}</div>
        </div>
        <div class="avg-value">${has ? `${avg}%` : '—'}</div>
      </div>
      ${has ? `<div class="panel" style="margin-bottom:14px">${lineChart(resultPoints())}</div>
        <ul class="history-list">${list}</ul>
        <button type="button" class="btn btn-danger-ghost btn-block" data-act="clear">${icon('trash')} Очистить историю</button>`
      : `<div class="empty"><p>Здесь появятся результаты пройденных тренировок.</p>
        <button type="button" class="btn btn-primary" data-act="go-learn">Начать тренировку</button></div>`}`;
  },

  mount(root) { bindCharts(root); },

  actions: {
    async clear() {
      const ok = await confirmDialog({
        title: 'Очистить историю?',
        text: 'Все результаты тренировок будут удалены. Прогресс слов останется.',
        ok: 'Очистить',
        danger: true,
      });
      if (!ok) return;
      history.clear();
      nav.refresh();
    },
    'go-learn'() { nav.tab('learn'); },
  },
};
