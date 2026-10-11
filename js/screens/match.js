// «Найди пару»: соединить иероглифы с переводами, раунды по 6 пар.

import { settings } from '../store.js';
import { $, $$, esc, icon, shuffle, shortMeaning, formatTime } from '../ui.js';
import { soundBtn } from '../components.js';
import { app, confirmDialog } from '../core.js';
import { recordAnswer, finishSession, leaveSession, sessionLeftUnexpectedly } from '../session.js';
import * as audio from '../audio.js';

const PER_ROUND = 6;
let S = null;
let clock = 0;

function makeRounds(words) {
  const list = shuffle(words);
  const rounds = [];
  for (let i = 0; i < list.length; i += PER_ROUND) rounds.push(list.slice(i, i + PER_ROUND));
  if (rounds.length > 1 && rounds[rounds.length - 1].length < 2) {
    const tail = rounds.pop();
    rounds[rounds.length - 1].push(...tail);
  }
  return rounds;
}

function renderRound() {
  const words = S.rounds[S.round];
  S.left = shuffle(words);
  S.right = shuffle(words);
  S.sel = null;
  S.matched = new Set();
  $('#round').textContent = S.rounds.length > 1 ? `Раунд ${S.round + 1} из ${S.rounds.length}` : `${words.length} пар`;
  $('#mleft').innerHTML = S.left.map((w) => `<button type="button" class="tile zh-tile" data-act="tile" data-side="l" data-key="${esc(w.key)}" lang="zh-CN">${esc(w.hanzi)}</button>`).join('');
  $('#mright').innerHTML = S.right.map((w) => `<button type="button" class="tile" data-act="tile" data-side="r" data-key="${esc(w.key)}">${esc(shortMeaning(w.translation, 34))}</button>`).join('');
}

function tickClock() {
  if (!S) return;
  $('#mclock').textContent = formatTime(Date.now() - S.started);
}

function tile(el) {
  if (!S || S.lock || el.classList.contains('matched')) return;
  const side = el.dataset.side;
  const key = el.dataset.key;
  if (!S.sel || S.sel.side === side) {
    $$('.tile.sel').forEach((t) => t.classList.remove('sel'));
    if (S.sel && S.sel.el === el) { S.sel = null; return; }
    S.sel = { side, key, el };
    el.classList.add('sel');
    audio.play('tap');
    return;
  }
  const a = S.sel;
  S.sel = null;
  const left = side === 'l' ? el : a.el;
  const right = side === 'l' ? a.el : el;
  if (a.key === key) {
    left.classList.remove('sel');
    right.classList.remove('sel');
    left.classList.add('matched');
    right.classList.add('matched');
    S.matched.add(key);
    audio.play('pair');
    const w = S.byKey.get(key);
    if (settings.get().ttsAuto) audio.speak(w.hanzi);
    if (S.matched.size === S.rounds[S.round].length) {
      S.lock = true;
      const session = S;
      setTimeout(() => {
        if (S !== session) return;
        S.lock = false;
        S.round += 1;
        if (S.round >= S.rounds.length) finish();
        else renderRound();
      }, 450);
    }
  } else {
    S.mistakes += 1;
    const wrongKey = left.dataset.key;
    S.wrong.set(wrongKey, (S.wrong.get(wrongKey) || 0) + 1);
    $('#mmist').textContent = S.mistakes;
    left.classList.remove('sel');
    right.classList.remove('sel');
    left.classList.add('wrong');
    right.classList.add('wrong');
    audio.play('wrong');
    audio.vibrate(40);
    setTimeout(() => {
      left.classList.remove('wrong');
      right.classList.remove('wrong');
    }, 450);
  }
}

function finish() {
  clearInterval(clock);
  const answers = S.words.map((w) => {
    const correct = !S.wrong.has(w.key);
    recordAnswer(w, correct, false);
    return { word: w, correct };
  });
  const extra = { timeMs: Date.now() - S.started, mistakes: S.mistakes };
  S = null;
  finishSession(answers, extra);
}

async function requestExit() {
  const ok = await confirmDialog({
    title: 'Выйти из игры?',
    text: 'Результат не сохранится.',
    ok: 'Выйти',
    cancel: 'Продолжить',
    danger: true,
  });
  if (ok) {
    clearInterval(clock);
    S = null;
    leaveSession();
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
        <div class="session-heading"><span class="session-title">${esc(s.title)}</span><span class="session-count" id="round"></span></div>
        <div class="blitz-head">
          <span class="timer" title="Ошибки">✕ <span id="mmist">0</span></span>
          <span class="timer" id="mclock">0:00</span>
          ${soundBtn()}
        </div>
      </header>
      <div class="match-grid">
        <div class="match-col" id="mleft"></div>
        <div class="match-col" id="mright"></div>
      </div>
      <p class="match-hint">Нажми на иероглиф, затем на его перевод</p>`;
  },

  mount() {
    const words = app.session.words;
    S = {
      words,
      byKey: new Map(words.map((w) => [w.key, w])),
      rounds: makeRounds(words),
      round: 0,
      mistakes: 0,
      wrong: new Map(),
      started: Date.now(),
      lock: false,
    };
    renderRound();
    clock = setInterval(tickClock, 500);
  },

  unmount() {
    clearInterval(clock);
    S = null;
    sessionLeftUnexpectedly();
  },

  onKey(e) {
    if (e.key === 'Escape' && S) { e.preventDefault(); requestExit(); }
  },

  actions: {
    tile(el) { tile(el); },
    exit() { requestExit(); },
  },
};
