// Страница слова: перевод, озвучка, примеры, прогресс, порядок черт.

import { progress, meta, favs } from '../store.js';
import { W } from '../data.js';
import { $, $$, esc, icon, highlight, dayIndex, formatDay } from '../ui.js';
import { topbar, favBtn, speakBtn, statusChip, chipsFor } from '../components.js';
import { createWriter } from '../strokes.js';
import { checkAchievements } from '../achievements.js';
import { showUnlocked } from '../session.js';
import * as audio from '../audio.js';

let writer = null;
let current = { key: null, char: null, token: 0 };

function chars(hanzi) {
  return [...new Set(Array.from(hanzi).filter((c) => /[㐀-鿿]/.test(c)))];
}

function nextReview(key) {
  const p = progress.get(key);
  if (!p || p.c + p.w === 0) return 'Слово ещё не тренировалось.';
  const t = dayIndex();
  if (p.d <= t) return 'Следующее повторение: сегодня.';
  if (p.d === t + 1) return 'Следующее повторение: завтра.';
  return `Следующее повторение: ${formatDay(p.d)}.`;
}

async function showChar(root, ch) {
  const token = ++current.token;
  current.char = ch;
  for (const b of $$('.stroke-tabs button', root)) b.setAttribute('aria-pressed', String(b.dataset.ch === ch));
  const box = $('#writer', root);
  const msg = $('#wmsg', root);
  msg.textContent = 'Загружаю…';
  writer = null;
  try {
    const w = await createWriter(box, ch);
    if (token !== current.token) return;
    writer = w;
    msg.textContent = '';
    writer.animateCharacter();
  } catch (e) {
    if (token !== current.token) return;
    box.innerHTML = `<div class="zh" style="display:grid;place-items:center;height:100%;font-size:6rem;color:var(--text-2)">${esc(ch)}</div>`;
    msg.textContent = e && e.message === 'nolib'
      ? 'Анимация недоступна: библиотека не загрузилась.'
      : 'Для этого иероглифа нет данных о порядке черт.';
  }
}

export default {
  tab: 'dict',
  valid: (p) => !!(p && W.byKey.get(p.key)),

  html(params) {
    const e = W.byKey.get(params.key);
    if (!e) return '';
    const w = e.word;
    const p = progress.get(w.key) || { c: 0, w: 0 };
    const cs = chars(w.hanzi);
    const examples = e.examples.map((ex) => `
      <div class="example-card">
        <div>
          <p class="ex-zh" lang="zh-CN">${highlight(ex.zh, w.hanzi)}</p>
          <p class="ex-py">${esc(ex.py)}</p>
          <p class="ex-ru">${esc(ex.ru)}</p>
        </div>
        ${speakBtn(ex.zh, 'speak-btn', 'Прочитать пример')}
      </div>`).join('');
    return `
      ${topbar({ title: 'Слово', back: true, actions: favBtn(w.key, 'icon-btn') })}
      <div class="word-hero">
        <button type="button" class="word-hanzi" data-act="speak" data-text="${esc(w.hanzi)}" lang="zh-CN" aria-label="Произнести ${esc(w.hanzi)}">${esc(w.hanzi)}</button>
        <div class="word-pinyin">${esc(w.pinyin)}</div>
        <div class="word-tr">${esc(w.translation)}</div>
        <div class="word-chips">
          <span class="chip">Урок ${e.lessons.join(', ')}</span>
          ${statusChip(w.key)}
          ${chipsFor(w)}
        </div>
        <div class="word-actions">
          <button type="button" class="btn btn-primary" data-act="speak" data-text="${esc(w.hanzi)}">${icon('speak')} Произнести</button>
          <button type="button" class="btn btn-secondary${favs.has(w.key) ? ' on' : ''}" data-act="fav" data-key="${esc(w.key)}">${icon('star')} Избранное</button>
        </div>
      </div>

      ${examples ? `<h2 class="section-title">Пример${e.examples.length > 1 ? 'ы' : ''}</h2><div class="panel">${examples}</div>` : ''}

      <h2 class="section-title">Порядок черт</h2>
      <div class="panel">
        ${cs.length > 1 ? `<div class="stroke-tabs">${cs.map((c) => `<button type="button" data-act="char" data-ch="${esc(c)}" lang="zh-CN" aria-pressed="false">${esc(c)}</button>`).join('')}</div>` : ''}
        <div class="writer-wrap"><div class="writer" id="writer"></div></div>
        <p class="writer-msg" id="wmsg"></p>
        <div class="writer-actions">
          <button type="button" class="btn btn-secondary" data-act="animate">${icon('play')} Показать</button>
          <button type="button" class="btn btn-primary" data-act="write">${icon('pen')} Написать самому</button>
        </div>
      </div>

      <h2 class="section-title">Твой прогресс</h2>
      <div class="panel">
        <div class="kv">
          <div><b>${p.c}</b><span>верно</span></div>
          <div><b>${p.w}</b><span>неверно</span></div>
          <div><b>${progress.get(w.key) ? progress.get(w.key).b : 0}/6</b><span>уровень</span></div>
        </div>
        <p class="next-review">${nextReview(w.key)}</p>
      </div>`;
  },

  mount(root, params) {
    const e = W.byKey.get(params.key);
    if (!e) return;
    current = { key: e.key, char: null, token: current.token };
    const viewed = meta.get().viewed || [];
    if (!viewed.includes(e.key)) {
      meta.set({ viewed: [...viewed, e.key].slice(-400) });
      showUnlocked(checkAchievements(), 300);
    }
    const cs = chars(e.word.hanzi);
    if (cs.length) showChar(root, cs[0]);
  },

  unmount() {
    current.token += 1;
    writer = null;
  },

  actions: {
    char(el) { showChar(el.closest('.view'), el.dataset.ch); },
    animate() {
      if (!writer) return;
      writer.cancelQuiz();
      writer.showOutline();
      writer.animateCharacter();
      $('#wmsg').textContent = '';
    },
    write() {
      if (!writer) return;
      const msg = $('#wmsg');
      msg.textContent = 'Пиши черты по порядку пальцем или мышью';
      writer.hideCharacter();
      writer.quiz({
        showHintAfterMisses: 3,
        onComplete: (summary) => {
          const m = summary.totalMistakes;
          msg.textContent = m ? `Готово! Ошибок: ${m}` : 'Отлично, без ошибок!';
          audio.play(m ? 'pair' : 'correct');
          meta.set({ written: (meta.get().written || 0) + 1 });
          showUnlocked(checkAchievements(), 400);
        },
      });
    },
  },
};
