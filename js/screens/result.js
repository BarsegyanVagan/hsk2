// Итог тренировки: процент, ошибки, повтор.

import { $, esc, icon, nWords, scoreClass, formatTime, reducedMotion } from '../ui.js';
import { wordRow } from '../components.js';
import { app, nav } from '../core.js';
import { MODES, CELEBRATE_FROM, repeatFromResult, stopCelebration } from '../session.js';

const RING_C = 2 * Math.PI * 52;
let countRaf = 0;

function message(r) {
  if (r.mode === 'blitz') {
    if (r.extra.record && r.extra.score > 0) return 'Новый рекорд!';
    return r.extra.score >= 15 ? 'Молниеносно!' : 'Хороший заход!';
  }
  const p = r.percent;
  if (p === 100) return 'Идеально!';
  if (p >= CELEBRATE_FROM) return 'Блестяще!';
  if (p >= 80) return 'Отличная работа!';
  if (p >= 60) return 'Хороший результат';
  if (p >= 40) return 'Неплохо, но стоит повторить';
  return 'Нужно ещё потренироваться';
}

function statsHTML(r) {
  if (r.mode === 'blitz') {
    return `<div class="stat ok"><b>${r.extra.score}</b><span>верных за минуту</span></div>
      <div class="stat"><b>${r.extra.best}</b><span>рекорд</span></div>`;
  }
  if (r.mode === 'match') {
    return `<div class="stat"><b>${formatTime(r.extra.timeMs)}</b><span>время</span></div>
      <div class="stat bad"><b>${r.extra.mistakes}</b><span>ошибок</span></div>`;
  }
  return `<div class="stat ok"><b>${r.correct}</b><span>верно</span></div>
    <div class="stat bad"><b>${r.total - r.correct}</b><span>неверно</span></div>`;
}

function animateRing(root, p) {
  const fill = $('#ring-fill', root);
  const label = $('#result-percent', root);
  const target = RING_C * (1 - p / 100);
  fill.style.strokeDasharray = String(RING_C);
  fill.style.opacity = p === 0 ? '0' : '1';
  cancelAnimationFrame(countRaf);
  if (reducedMotion()) {
    fill.style.strokeDashoffset = String(target);
    label.textContent = p;
    return;
  }
  fill.style.transition = 'none';
  fill.style.strokeDashoffset = String(RING_C);
  void fill.getBoundingClientRect();
  fill.style.transition = '';
  requestAnimationFrame(() => { fill.style.strokeDashoffset = String(target); });
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / 1000);
    label.textContent = Math.round(p * (1 - (1 - k) ** 3));
    if (k < 1) countRaf = requestAnimationFrame(step);
  };
  label.textContent = '0';
  countRaf = requestAnimationFrame(step);
}

export default {
  tab: 'learn',
  valid: () => !!app.result,

  html() {
    const r = app.result;
    if (!r) return '';
    const mode = MODES[r.mode];
    const ach = (r.unlocked || []).map((a) => `<span class="chip">${a.emoji} ${esc(a.title)}</span>`).join('');
    return `
      <div class="result-hero" data-score="${scoreClass(r.percent)}">
        <div class="ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-track" cx="60" cy="60" r="52"/>
            <circle class="ring-fill" id="ring-fill" cx="60" cy="60" r="52"/>
          </svg>
          <div class="ring-label"><span><span id="result-percent">0</span><small>%</small></span></div>
        </div>
        <h1 class="result-message">${message(r)}</h1>
        <p class="result-sub">${esc(r.title)} · ${mode.label} · ${nWords(r.mode === 'blitz' ? r.total : r.words.length)}</p>
        <div class="result-stats">${statsHTML(r)}</div>
        ${r.percent >= CELEBRATE_FROM && r.total > 0 ? `<div class="claude-badge">${icon('sparkle')} Сделано с поддержкой Claude</div>` : ''}
        ${ach ? `<div class="new-ach">${ach}</div>` : ''}
      </div>
      <div class="result-actions">
        <button type="button" class="btn btn-primary" data-act="repeat">${icon('refresh')} Повторить</button>
        ${r.mistakes.length ? `<button type="button" class="btn btn-secondary" data-act="repeat-mistakes">Повторить только ошибки</button>` : ''}
        <button type="button" class="btn btn-ghost" data-act="menu">В меню</button>
      </div>
      <h2 class="section-title">${r.mistakes.length ? `Ошибки · ${r.mistakes.length}` : 'Ошибки'}</h2>
      ${r.mistakes.length
        ? `<ul class="word-list">${r.mistakes.map((w) => wordRow(w)).join('')}</ul>`
        : `<p class="no-mistakes">${r.total ? 'Ошибок нет — так держать!' : 'Ответов не было.'}</p>`}`;
  },

  mount(root) {
    animateRing(root, app.result.percent);
  },

  unmount() {
    cancelAnimationFrame(countRaf);
    stopCelebration();
  },

  actions: {
    repeat() { repeatFromResult(false); },
    'repeat-mistakes'() { repeatFromResult(true); },
    menu() { nav.back('learn'); },
  },
};
