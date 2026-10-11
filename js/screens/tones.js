// «Тоны»: для каждого слога выбрать тон (1–4 или нейтральный).

import { settings } from '../store.js';
import { $, esc, icon, hanziSize } from '../ui.js';
import { soundBtn, speakBtn } from '../components.js';
import { app, confirmDialog } from '../core.js';
import { recordAnswer, finishSession, leaveSession, sessionLeftUnexpectedly } from '../session.js';
import { syllables, applyTone } from '../pinyin.js';
import * as audio from '../audio.js';

const TONE_NAMES = { 1: '1-й', 2: '2-й', 3: '3-й', 4: '4-й', 5: 'лёгкий' };
let S = null;
let timer = 0;

const cur = () => S.words[S.index];

function sylText(syl, tone) {
  const base = syl.er ? syl.plain.slice(0, -1) : syl.plain;
  return applyTone(base, tone) + (syl.er ? 'r' : '');
}

function renderSyllables() {
  const box = $('#syls');
  box.innerHTML = S.syls.map((syl, i) => {
    let cls = 'syl';
    let text = `${syl.plain}?`;
    if (S.done) {
      cls += S.picks[i] === syl.tone ? ' right' : ' miss';
      text = sylText(syl, S.picks[i]);
    } else if (i < S.pos) {
      cls += ' filled';
      text = sylText(syl, S.picks[i]);
    } else if (i === S.pos) {
      cls += ' active';
    }
    return `<span class="${cls}">${esc(text)}</span>`;
  }).join('');
}

function renderButtons() {
  const syl = S.syls[Math.min(S.pos, S.syls.length - 1)];
  $('#tbtns').innerHTML = [1, 2, 3, 4, 5].map((t) => `
    <button type="button" class="tone-btn" data-act="tone" data-t="${t}" ${S.done ? 'disabled' : ''}>
      <b>${esc(sylText(syl, t))}</b><small>${TONE_NAMES[t]} · ${t === 5 ? '0' : t}</small>
    </button>`).join('');
}

function render() {
  const w = cur();
  S.syls = syllables(w.pinyin);
  S.picks = [];
  S.pos = 0;
  S.done = false;
  const total = S.words.length;
  $('#count').textContent = `Слово ${S.index + 1} из ${total}`;
  $('#pfill').style.width = `${(S.answers.length / total) * 100}%`;
  $('#tq').innerHTML = `
    <div class="card-hanzi" lang="zh-CN" data-size="${hanziSize(w.hanzi)}">${esc(w.hanzi)}</div>
    <div class="tone-tr">${esc(w.translation)}</div>
    <div class="syls" id="syls"></div>
    <p class="tone-answer" id="tans"></p>`;
  renderSyllables();
  renderButtons();
  $('#next').hidden = true;
}

function choose(t) {
  if (!S || S.done) return;
  S.picks[S.pos] = t;
  S.pos += 1;
  audio.play('tap');
  if (S.pos < S.syls.length) {
    renderSyllables();
    renderButtons();
    return;
  }
  S.done = true;
  const w = cur();
  const correct = S.syls.every((syl, i) => S.picks[i] === syl.tone);
  recordAnswer(w, correct, false);
  S.answers.push({ word: w, correct });
  renderSyllables();
  renderButtons();
  $('#tans').innerHTML = `${correct ? 'Верно!' : 'Правильно:'} <b>${esc(w.pinyin)}</b> ${speakBtn(w.hanzi, 'speak-btn')}`;
  $('#tans').className = `tone-answer ${correct ? 'py-result ok' : 'py-result bad'}`;
  $('#pfill').style.width = `${(S.answers.length / S.words.length) * 100}%`;
  if (correct) audio.play('correct');
  else { audio.play('wrong'); audio.vibrate(50); }
  if (settings.get().ttsAuto) audio.speak(w.hanzi);
  if (correct) {
    const session = S;
    timer = setTimeout(() => { if (S === session) next(); }, 1100);
  } else {
    $('#next').hidden = false;
  }
}

function backspace() {
  if (!S || S.done || S.pos === 0) return;
  S.pos -= 1;
  S.picks.length = S.pos;
  renderSyllables();
  renderButtons();
}

function next() {
  if (!S || !S.done) return;
  clearTimeout(timer);
  S.index += 1;
  if (S.index >= S.words.length) {
    finishSession(S.answers);
    return;
  }
  render();
}

async function requestExit() {
  const ok = await confirmDialog({
    title: 'Выйти из тренировки?',
    text: 'Результат незаконченной тренировки не сохранится в истории.',
    ok: 'Выйти',
    cancel: 'Продолжить',
    danger: true,
  });
  if (ok) {
    clearTimeout(timer);
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
        <div class="session-heading"><span class="session-title">${esc(s.title)} · тоны</span><span class="session-count" id="count"></span></div>
        <div class="topbar-actions">${soundBtn()}</div>
      </header>
      <div class="progress"><div class="progress-fill" id="pfill"></div></div>
      <div class="quiz-q tone-card" id="tq"></div>
      <div class="next-bar" id="next" hidden><button type="button" class="btn btn-primary btn-block" data-act="next">Дальше ${icon('chevronR')}</button></div>
      <div class="tone-buttons" id="tbtns"></div>`;
  },

  mount() {
    S = { words: app.session.words, index: 0, answers: [] };
    render();
  },

  unmount() {
    clearTimeout(timer);
    S = null;
    sessionLeftUnexpectedly();
  },

  onKey(e) {
    if (!S || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); choose(Number(e.key)); return; }
    if (e.key === '0' || e.key === '5') { e.preventDefault(); choose(5); return; }
    if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && S.done) { e.preventDefault(); next(); return; }
    if (e.key === 'Escape') { e.preventDefault(); requestExit(); }
  },

  actions: {
    tone(el) { choose(Number(el.dataset.t)); },
    next() { next(); },
    exit() { requestExit(); },
  },
};
