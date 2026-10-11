// «Блиц»: как можно больше верных ответов за 60 секунд.

import { settings, meta } from '../store.js';
import { $, $$, esc, icon, shuffle } from '../ui.js';
import { soundBtn } from '../components.js';
import { app, confirmDialog } from '../core.js';
import { recordAnswer, finishSession, leaveSession, sessionLeftUnexpectedly } from '../session.js';
import { questionHTML, makeOptions, optionsHTML } from '../options.js';
import * as audio from '../audio.js';

const DURATION = 60000;
let S = null;
let raf = 0;
let nextTimer = 0;

function nextWord() {
  if (!S.queue.length) {
    S.queue = shuffle(S.words);
    if (S.queue.length > 1 && S.last && S.queue[0].key === S.last.key) S.queue.push(S.queue.shift());
  }
  return S.queue.shift();
}

function render() {
  const w = nextWord();
  S.current = w;
  S.last = w;
  S.opts = makeOptions(w, S.words, S.dir);
  S.answered = false;
  $('#q').innerHTML = questionHTML(w, S.dir);
  $('#opts').innerHTML = optionsHTML(S.opts, S.dir);
}

function remaining() {
  return S.paused ? S.left : Math.max(0, S.left - (performance.now() - S.resumedAt));
}

function tick() {
  if (!S) return;
  const left = remaining();
  const sec = Math.ceil(left / 1000);
  const t = $('#timer');
  t.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  t.classList.toggle('low', sec <= 10);
  $('#tfill').style.width = `${(left / DURATION) * 100}%`;
  if (sec <= 5 && sec > 0 && sec !== S.lastTick) {
    S.lastTick = sec;
    audio.play('tick');
  }
  if (left <= 0) {
    end();
    return;
  }
  raf = requestAnimationFrame(tick);
}

function pause() {
  if (!S || S.paused) return;
  S.left = remaining();
  S.paused = true;
  cancelAnimationFrame(raf);
}
function resume() {
  if (!S || !S.paused) return;
  S.paused = false;
  S.resumedAt = performance.now();
  raf = requestAnimationFrame(tick);
}

function pick(i) {
  if (!S || S.answered || S.paused || !S.opts[i]) return;
  S.answered = true;
  const w = S.current;
  const correct = S.opts[i].key === w.key;
  recordAnswer(w, correct, false);
  S.answers.push({ word: w, correct });
  if (correct) S.score += 1;
  $('#score').textContent = S.score;
  const buttons = $$('#opts .option');
  buttons.forEach((b, j) => { if (S.opts[j].key === w.key) b.classList.add('correct'); });
  if (!correct) buttons[i].classList.add('wrong');
  $('#q').classList.remove('flash-ok', 'flash-bad');
  void $('#q').offsetWidth;
  $('#q').classList.add(correct ? 'flash-ok' : 'flash-bad');
  if (correct) audio.play('pair');
  else { audio.play('wrong'); audio.vibrate(40); }
  const session = S;
  nextTimer = setTimeout(() => { if (S === session && remaining() > 0) render(); }, correct ? 220 : 650);
}

function end() {
  cancelAnimationFrame(raf);
  clearTimeout(nextTimer);
  if (!S) return;
  const best = meta.get().bestBlitz || 0;
  const record = S.score > best;
  if (record) meta.set({ bestBlitz: S.score });
  const answers = S.answers;
  const score = S.score;
  S = null;
  finishSession(answers, { score, best: Math.max(best, score), record });
}

function onVisibility() {
  if (document.visibilityState === 'hidden') pause();
  else if (!document.querySelector('#modal:not([hidden])')) resume();
}

async function requestExit() {
  pause();
  const ok = await confirmDialog({
    title: 'Выйти из блица?',
    text: 'Результат не сохранится.',
    ok: 'Выйти',
    cancel: 'Продолжить',
    danger: true,
  });
  if (ok) {
    S = null;
    leaveSession();
  } else {
    resume();
  }
}

export default {
  tab: 'learn',
  full: true,
  valid: () => !!app.session,

  html() {
    const s = app.session;
    if (!s) return '';
    return `
      <header class="topbar session-top">
        <button type="button" class="icon-btn" data-act="exit" aria-label="Выйти">${icon('close')}</button>
        <div class="session-heading"><span class="session-title">${esc(s.title)}</span><span class="session-count">Верных ответов</span></div>
        <div class="blitz-head">
          <span class="score-badge" id="score" aria-live="polite">0</span>
          <span class="timer" id="timer">1:00</span>
          ${soundBtn()}
        </div>
      </header>
      <div class="progress time-bar"><div class="progress-fill" id="tfill" style="width:100%"></div></div>
      <div class="quiz-q" id="q"></div>
      <div class="options" id="opts"></div>`;
  },

  mount() {
    const s = app.session;
    let dir = settings.get().direction;
    if (dir === 'audio') dir = 'hz2ru';
    S = {
      words: s.words, queue: [], dir, score: 0, answers: [], opts: [],
      answered: false, paused: false, left: DURATION, resumedAt: performance.now(), lastTick: null,
    };
    render();
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVisibility);
  },

  unmount() {
    cancelAnimationFrame(raf);
    clearTimeout(nextTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    S = null;
    sessionLeftUnexpectedly();
  },

  onKey(e) {
    if (!S || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); pick(Number(e.key) - 1); return; }
    if (e.key === 'Escape') { e.preventDefault(); requestExit(); }
  },

  actions: {
    pick(el) { pick(Number(el.dataset.i)); },
    exit() { requestExit(); },
  },
};
