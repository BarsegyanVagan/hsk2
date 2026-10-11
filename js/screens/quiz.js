// «Варианты»: выбор правильного ответа из четырёх.

import { settings } from '../store.js';
import { $, $$, esc, icon } from '../ui.js';
import { soundBtn, speakBtn } from '../components.js';
import { app, toast, confirmDialog } from '../core.js';
import { recordAnswer, finishSession, leaveSession, sessionLeftUnexpectedly } from '../session.js';
import { questionHTML, makeOptions, optionsHTML } from '../options.js';
import * as audio from '../audio.js';

let S = null;
let timer = 0;

const cur = () => S.words[S.index];

function render() {
  const w = cur();
  S.opts = makeOptions(w, S.words, S.dir);
  S.answered = false;
  const total = S.words.length;
  $('#count').textContent = `Вопрос ${S.index + 1} из ${total}`;
  $('#pfill').style.width = `${(S.answers.length / total) * 100}%`;
  $('#q').innerHTML = `${questionHTML(w, S.dir)}<div class="reveal" id="reveal"></div>`;
  $('#opts').innerHTML = optionsHTML(S.opts, S.dir);
  $('#next').hidden = true;
  if (S.dir === 'audio') audio.speak(w.hanzi);
}

function pick(i) {
  if (!S || S.answered || !S.opts[i]) return;
  S.answered = true;
  const w = cur();
  const chosen = S.opts[i];
  const correct = chosen.key === w.key;
  recordAnswer(w, correct, true);
  S.answers.push({ word: w, correct });
  const buttons = $$('#opts .option');
  buttons.forEach((b, j) => {
    b.disabled = true;
    if (S.opts[j].key === w.key) b.classList.add('correct');
  });
  if (!correct) buttons[i].classList.add('wrong');
  $('#reveal').innerHTML = `${esc(w.hanzi)} · ${esc(w.pinyin)} · ${esc(w.translation)}`;
  if (!$('#q .speak-btn')) $('#q').insertAdjacentHTML('beforeend', speakBtn(w.hanzi, 'speak-btn'));
  $('#pfill').style.width = `${(S.answers.length / S.words.length) * 100}%`;
  if (correct) audio.play('correct');
  else { audio.play('wrong'); audio.vibrate(60); }
  if (settings.get().ttsAuto && S.dir !== 'audio') audio.speak(w.hanzi);
  if (correct) {
    const session = S;
    timer = setTimeout(() => { if (S === session) next(); }, 750);
  } else {
    $('#next').hidden = false;
    $('#next button').focus({ preventScroll: true });
  }
}

function next() {
  if (!S || !S.answered) return;
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
        <button type="button" class="icon-btn" data-act="exit" aria-label="Выйти" title="Выйти (Esc)">${icon('close')}</button>
        <div class="session-heading"><span class="session-title">${esc(s.title)}</span><span class="session-count" id="count"></span></div>
        <div class="topbar-actions">${soundBtn()}</div>
      </header>
      <div class="progress"><div class="progress-fill" id="pfill"></div></div>
      <div class="quiz-q" id="q"></div>
      <div class="options" id="opts"></div>
      <div class="next-bar" id="next" hidden><button type="button" class="btn btn-primary btn-block" data-act="next">Дальше ${icon('chevronR')}</button></div>`;
  },

  mount() {
    const s = app.session;
    let dir = settings.get().direction;
    if (dir === 'audio' && audio.voiceState() === 'none') {
      dir = 'hz2ru';
      toast('На устройстве нет китайского голоса — показываю иероглифы', { icon: '🔇', timeout: 3200 });
    }
    S = { words: s.words, index: 0, answers: [], dir, opts: [], answered: false };
    render();
  },

  unmount() {
    clearTimeout(timer);
    S = null;
    sessionLeftUnexpectedly();
  },

  onKey(e) {
    if (!S || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); pick(Number(e.key) - 1); return; }
    if ((e.key === 'Enter' || e.key === ' ') && S.answered) { e.preventDefault(); next(); return; }
    if (e.code === 'KeyS') { audio.speak(cur().hanzi); return; }
    if (e.key === 'Escape') { e.preventDefault(); requestExit(); }
  },

  actions: {
    pick(el) { pick(Number(el.dataset.i)); },
    next() { next(); },
    'speak-q'() { if (S) audio.speak(cur().hanzi); },
    exit() { requestExit(); },
  },
};
