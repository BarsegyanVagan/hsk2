// Карточки с самопроверкой: переворот, «Верно/Неверно», свайпы, отмена, подсказка, ввод пиньиня.

import { settings } from '../store.js';
import { $, esc, icon, hanziSize, highlight, reducedMotion, nWords } from '../ui.js';
import { soundBtn, favBtn, speakBtn } from '../components.js';
import { app, toast, announce, confirmDialog } from '../core.js';
import { recordAnswer, undoAnswer, finishSession, leaveSession, sessionLeftUnexpectedly } from '../session.js';
import { checkPinyin } from '../pinyin.js';
import * as audio from '../audio.js';

let S = null;
const SMALLER = { xl: 'l', l: 'm', m: 's', s: 's' };

const cur = () => S.words[S.index];

function chips(w) {
  return `<div class="card-chips"><span class="chip">Урок ${w.lesson}</span>${w.extra ? '<span class="chip extra" title="Сверх программы HSK 2">★</span>' : ''}${w.proper ? '<span class="chip muted">имя</span>' : ''}</div>`;
}

function frontHTML(w) {
  let body;
  if (S.dir === 'ru2hz') body = `<div class="q-ru">${esc(w.translation)}</div>`;
  else if (S.dir === 'py2hz') body = `<div class="q-py">${esc(w.pinyin)}</div>`;
  else if (S.dir === 'audio') {
    body = `<button type="button" class="big-speak" data-act="speak-word" aria-label="Прослушать слово">${icon('speak')}</button>
      <p class="speak-note">Послушай и вспомни слово</p>`;
  } else {
    body = `<div class="card-hanzi" lang="zh-CN" data-size="${hanziSize(w.hanzi)}">${esc(w.hanzi)}</div>`;
  }
  const hint = S.dir === 'py2hz' ? w.translation : w.pinyin;
  return `${chips(w)}${favBtn(w.key, 'card-fav')}
    <div class="face-body">${body}<div class="card-hint-line" id="hintline" hidden>${esc(hint)}</div></div>
    <div class="flip-hint">${icon('rotate')}<span>Нажми, чтобы перевернуть<span class="kbd-hint"> · Пробел</span></span></div>`;
}

function backHTML(w) {
  const size = hanziSize(w.hanzi);
  const hz = S.dir === 'hz2ru'
    ? `<div class="back-hanzi-sm" lang="zh-CN">${esc(w.hanzi)}</div>`
    : `<div class="card-hanzi" lang="zh-CN" data-size="${SMALLER[size]}">${esc(w.hanzi)}</div>`;
  const ex = settings.get().showExample && w.example
    ? `<div class="back-example">
        <p class="ex-zh" lang="zh-CN">${highlight(w.example.zh, w.hanzi)}</p>
        <p class="ex-py">${esc(w.example.py)}</p>
        <p class="ex-ru">${esc(w.example.ru)}</p>
      </div>`
    : '';
  return `${chips(w)}${favBtn(w.key, 'card-fav')}
    <div class="face-body">
      ${hz}
      <div class="back-pinyin">${esc(w.pinyin)} ${speakBtn(w.hanzi, 'speak-btn')}</div>
      <div class="card-divider"></div>
      <div class="back-tr">${esc(w.translation)}</div>
      ${ex}
    </div>`;
}

function toolsHTML() {
  const s = settings.get();
  const withInput = s.pinyinInput && S.dir !== 'py2hz';
  let html = '';
  if (!S.flipped) {
    html += `<div class="tool-row"><button type="button" class="tool-btn" data-act="hint" ${S.hint ? 'disabled' : ''}>${icon('hint')} ${S.dir === 'py2hz' ? 'Показать перевод' : 'Показать пиньинь'}</button></div>`;
    if (withInput && !S.py) {
      html += `<form class="py-form" id="pyform" autocomplete="off">
        <input class="py-input" id="pyin" type="text" autocapitalize="off" autocorrect="off" spellcheck="false"
          placeholder="Пиньинь: bang1mang2 или bāngmáng" aria-label="Введи пиньинь">
        <button type="submit" class="btn btn-secondary">Проверить</button>
      </form>`;
    }
  }
  if (withInput) html += `<p class="py-result ${S.py ? S.py.cls : ''}" id="pyres">${S.py ? esc(S.py.text) : ''}</p>`;
  return html;
}

function renderTools() {
  const box = $('#tools');
  if (box) box.innerHTML = toolsHTML();
}

function updateTop() {
  const total = S.words.length;
  $('#count').textContent = `Слово ${Math.min(S.index + 1, total)} из ${total}`;
  $('#pfill').style.width = `${(S.answers.length / total) * 100}%`;
  $('#undo-btn').disabled = S.answers.length === 0;
  const off = !S.revealed;
  $('#btn-right').disabled = off;
  $('#btn-wrong').disabled = off;
}

function renderCard(animate) {
  const w = cur();
  const card = $('#card');
  card.classList.add('no-anim');
  card.classList.remove('flipped', 'leave-left', 'leave-right', 'dragging');
  card.style.transform = '';
  S.flipped = false;
  S.revealed = false;
  S.hint = false;
  S.py = null;
  $('#front').innerHTML = frontHTML(w);
  $('#back').innerHTML = backHTML(w);
  $('#front').setAttribute('aria-hidden', 'false');
  $('#back').setAttribute('aria-hidden', 'true');
  card.setAttribute('aria-label', 'Карточка. Нажмите, чтобы перевернуть');
  $('#btn-right').classList.remove('suggest');
  $('#btn-wrong').classList.remove('suggest');
  renderTools();
  updateTop();
  if (animate) card.classList.add('entering');
  void card.offsetWidth;
  card.classList.remove('no-anim', 'entering');
  if (S.dir === 'audio') audio.speak(w.hanzi);
}

function flip() {
  if (!S || S.busy) return;
  const w = cur();
  S.flipped = !S.flipped;
  $('#card').classList.toggle('flipped', S.flipped);
  $('#front').setAttribute('aria-hidden', String(S.flipped));
  $('#back').setAttribute('aria-hidden', String(!S.flipped));
  audio.play('flip');
  if (S.flipped && !S.revealed) {
    S.revealed = true;
    if (settings.get().ttsAuto && S.dir !== 'audio') audio.speak(w.hanzi);
    announce(`${w.hanzi}, ${w.pinyin}. ${w.translation}`);
  }
  renderTools();
  updateTop();
}

function answer(correct) {
  if (!S || !S.revealed || S.busy) return;
  S.busy = true;
  const w = cur();
  const prev = recordAnswer(w, correct, true);
  S.answers.push({ word: w, correct, prev });
  if (correct) audio.play('correct');
  else { audio.play('wrong'); audio.vibrate(60); }
  S.index += 1;
  $('#btn-right').disabled = true;
  $('#btn-wrong').disabled = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  $('#pfill').style.width = `${(S.answers.length / S.words.length) * 100}%`;

  const card = $('#card');
  const ms = reducedMotion() ? 0 : 190;
  card.classList.remove('dragging');
  card.style.transform = '';
  if (ms) card.classList.add(correct ? 'leave-right' : 'leave-left');
  const session = S;
  setTimeout(() => {
    if (S !== session) return;
    if (S.index >= S.words.length) {
      finishSession(S.answers.map((a) => ({ word: a.word, correct: a.correct })));
      return;
    }
    renderCard(!reducedMotion());
    setTimeout(() => { if (S === session) S.busy = false; }, reducedMotion() ? 0 : 170);
  }, ms);
}

function undo() {
  if (!S || S.busy || !S.answers.length) return;
  const a = S.answers.pop();
  undoAnswer(a.word, a.correct, a.prev);
  S.index -= 1;
  audio.play('tap');
  renderCard(!reducedMotion());
  toast('Последний ответ отменён', { icon: '↩️', timeout: 1500 });
}

function showHint() {
  if (!S || S.flipped || S.hint) return;
  S.hint = true;
  const line = $('#hintline');
  if (line) line.hidden = false;
  renderTools();
}

function bindSwipe(card) {
  let start = null;
  card.addEventListener('pointerdown', (e) => {
    if (!S || S.busy || e.button !== 0 || e.target.closest('button')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false };
  });
  card.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id || !S) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.drag) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        start.drag = true;
        card.classList.add('dragging');
        try { card.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      } else return;
    }
    card.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
    const tint = $('#tint');
    if (S.revealed) {
      tint.className = `swipe-tint ${dx > 0 ? 'right' : 'left'}`;
      tint.textContent = dx > 0 ? 'Верно' : 'Неверно';
      tint.style.opacity = String(Math.min(1, Math.abs(dx) / 120) * 0.9);
    }
  });
  const end = (e) => {
    if (!start || e.pointerId !== start.id || !S) return;
    const dx = e.clientX - start.x;
    const wasDrag = start.drag;
    start = null;
    $('#tint').style.opacity = '0';
    if (!wasDrag) return;
    S.suppressClick = true;
    setTimeout(() => { if (S) S.suppressClick = false; }, 350);
    if (S.revealed && Math.abs(dx) > 100) {
      answer(dx > 0);
    } else {
      card.classList.remove('dragging');
      card.style.transform = '';
      if (!S.revealed && Math.abs(dx) > 100) toast('Сначала переверни карточку', { icon: '🔄', timeout: 1500 });
    }
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
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
        <button type="button" class="icon-btn" data-act="exit" aria-label="Выйти" title="Выйти (Esc)">${icon('close')}</button>
        <div class="session-heading">
          <span class="session-title">${esc(s.title)}</span>
          <span class="session-count" id="count"></span>
        </div>
        <div class="topbar-actions">
          <button type="button" class="icon-btn" id="undo-btn" data-act="undo" aria-label="Отменить последний ответ" title="Отменить (Backspace)" disabled>${icon('undo')}</button>
          ${soundBtn()}
        </div>
      </header>
      <div class="progress" role="progressbar" aria-label="Прогресс" aria-valuemin="0" aria-valuemax="${s.words.length}"><div class="progress-fill" id="pfill"></div></div>
      <div class="card-stage">
        <div class="card" id="card" data-act="flip" role="button" tabindex="0">
          <div class="card-inner">
            <div class="card-face card-front" id="front"></div>
            <div class="card-face card-back" id="back" aria-hidden="true"></div>
          </div>
          <div class="swipe-tint" id="tint" aria-hidden="true"></div>
        </div>
      </div>
      <div class="card-tools" id="tools"></div>
      <div class="answer-bar">
        <button type="button" class="answer-btn bad" id="btn-wrong" data-act="wrong" disabled>${icon('close')} Неверно <span class="kbd" aria-hidden="true">←</span></button>
        <button type="button" class="answer-btn ok" id="btn-right" data-act="right" disabled>${icon('check')} Верно <span class="kbd" aria-hidden="true">→</span></button>
      </div>`;
  },

  mount(root) {
    const s = app.session;
    let dir = settings.get().direction;
    if (dir === 'audio' && audio.voiceState() === 'none') {
      dir = 'hz2ru';
      toast('На устройстве нет китайского голоса — показываю иероглифы', { icon: '🔇', timeout: 3200 });
    }
    S = { words: s.words, index: 0, answers: [], dir, flipped: false, revealed: false, busy: false, hint: false, py: null };
    renderCard(false);
    bindSwipe($('#card', root));
    if (s.words.length > 1) announce(`Тренировка: ${nWords(s.words.length)}`);
  },

  unmount() {
    S = null;
    sessionLeftUnexpectedly();
  },

  onSubmit(e) {
    if (!S || S.flipped || e.target.id !== 'pyform') return;
    const input = $('#pyin');
    const w = cur();
    const r = checkPinyin(input.value, w.pinyin);
    if (r === 'empty') {
      input.focus();
      return;
    }
    const map = {
      exact: { cls: 'ok', text: `Верно! ${w.pinyin}` },
      toneless: { cls: 'warn', text: `Буквы верны, тоны не указаны: ${w.pinyin}` },
      tones: { cls: 'warn', text: `Тоны неверны, правильно: ${w.pinyin}` },
      wrong: { cls: 'bad', text: `Неверно, правильно: ${w.pinyin}` },
    };
    S.py = map[r];
    input.blur();
    $('#btn-right').classList.toggle('suggest', r === 'exact');
    $('#btn-wrong').classList.toggle('suggest', r === 'wrong');
    flip();
  },

  onKey(e) {
    if (!S) return;
    const inInput = e.target && e.target.tagName === 'INPUT';
    if (inInput) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') {
      const el = document.activeElement;
      if (el && el.tagName === 'BUTTON') {
        let keyboardFocus = false;
        try { keyboardFocus = el.matches(':focus-visible'); } catch { /* ignore */ }
        if (keyboardFocus) return;
        el.blur();
      }
      e.preventDefault();
      flip();
      return;
    }
    const k = e.key;
    if (k === 'ArrowRight' || k === '1') { e.preventDefault(); answer(true); return; }
    if (k === 'ArrowLeft' || k === '2') { e.preventDefault(); answer(false); return; }
    if (k === 'Backspace' || e.code === 'KeyZ') { e.preventDefault(); undo(); return; }
    if (e.code === 'KeyH') { showHint(); return; }
    if (e.code === 'KeyS' && (S.revealed || S.dir === 'audio')) { audio.speak(cur().hanzi); return; }
    if (k === 'Escape') { e.preventDefault(); requestExit(); }
  },

  actions: {
    flip() {
      if (S && S.suppressClick) return;
      flip();
    },
    right() { answer(true); },
    wrong() { answer(false); },
    undo() { undo(); },
    hint() { showHint(); },
    'speak-word'() { if (S) audio.speak(cur().hanzi); },
    exit() { requestExit(); },
  },
};
