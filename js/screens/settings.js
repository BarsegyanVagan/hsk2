// Настройки: тренировка, звук, оформление, данные.

import { settings, exportData, importData, resetProgress } from '../store.js';
import { W } from '../data.js';
import { $, esc, icon, nWords } from '../ui.js';
import { topbar } from '../components.js';
import { toast, confirmDialog } from '../core.js';
import { DIRECTIONS } from '../session.js';
import { isIOS } from '../pwa.js';
import * as audio from '../audio.js';

export const APP_VERSION = '2.0.1';

const ACCENTS = [
  ['violet', 'Фиолетовый', 'hsl(248 78% 60%)'],
  ['blue', 'Синий', 'hsl(214 88% 52%)'],
  ['teal', 'Бирюзовый', 'hsl(174 75% 36%)'],
  ['orange', 'Оранжевый', 'hsl(22 90% 52%)'],
  ['rose', 'Розовый', 'hsl(338 80% 56%)'],
];

function toggle(key, title, sub = '') {
  const on = !!settings.get()[key];
  return `<label class="row">
    <span class="row-text"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    <input type="checkbox" class="switch" data-setting="${key}" ${on ? 'checked' : ''}>
  </label>`;
}

function seg(key, options, label) {
  const v = settings.get()[key];
  return `<div class="seg" role="group" aria-label="${label}">
    ${options.map(([val, text]) => `<button type="button" data-act="set" data-k="${key}" data-v="${val}" aria-pressed="${String(v) === String(val)}">${text}</button>`).join('')}
  </div>`;
}

function voiceLine() {
  const st = audio.voiceState();
  if (st === 'ok') return `Голос: ${esc(audio.voiceName())}`;
  if (st === 'unknown') return 'Голос определится при первой озвучке';
  return 'Китайский голос на устройстве не найден';
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'application/json' }) : null;
  if (isIOS() && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Прогресс HSK 2' }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default {
  tab: 'settings',

  html() {
    const s = settings.get();
    const swatches = ACCENTS.map(([id, name, color]) => `<button type="button" class="swatch" data-act="set" data-k="accent" data-v="${id}"
      aria-pressed="${s.accent === id}" aria-label="${name}" title="${name}" style="background:${color}"></button>`).join('');

    return `
      ${topbar({ title: 'Настройки' })}

      <h2 class="section-title">Тренировка</h2>
      <div class="group">
        <div class="row col">
          <span class="row-text"><b>Направление карточек</b><small>Что показывать на лицевой стороне</small></span>
          ${seg('direction', Object.entries(DIRECTIONS), 'Направление')}
        </div>
        ${toggle('pinyinInput', 'Ввод пиньиня', 'Перед переворотом карточки можно ввести пиньинь с клавиатуры (bang1mang2 или bāngmáng; ü = v)')}
        ${toggle('shuffle', 'Перемешивать слова', 'Иначе слова идут по порядку урока')}
        ${toggle('showExample', 'Пример на обороте', 'Предложение с этим словом')}
        ${toggle('excludeExtra', 'Без слов со ★', 'Не показывать слова сверх программы HSK 2')}
        <div class="row col">
          <span class="row-text"><b>Цель на день</b><small>Сколько ответов в день</small></span>
          ${seg('dailyGoal', [[10, '10'], [20, '20'], [30, '30'], [50, '50']], 'Цель на день')}
        </div>
      </div>

      <h2 class="section-title">Звук</h2>
      <div class="group">
        ${toggle('sound', 'Звуки ответов', 'Сигналы «верно/неверно» и поздравление')}
        ${toggle('ttsAuto', 'Озвучивать слова', 'Произносить слово при перевороте и после ответа')}
        <div class="row col">
          <span class="row-text"><b>Скорость озвучки</b><small id="voice-line">${voiceLine()}</small></span>
          ${seg('ttsRate', [['slow', 'Медленно'], ['normal', 'Обычно']], 'Скорость')}
        </div>
        ${toggle('vibrate', 'Вибрация', 'При ошибке (на Android)')}
        <button type="button" class="row" data-act="test-voice">
          <span class="row-text"><b>Проверить голос</b><small>你好！我们开始学习吧。</small></span>${icon('speak')}
        </button>
      </div>

      <h2 class="section-title">Оформление</h2>
      <div class="group">
        <div class="row col">
          <span class="row-text"><b>Тема</b></span>
          ${seg('theme', [['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']], 'Тема')}
        </div>
        <div class="row">
          <span class="row-text"><b>Цвет</b></span>
          <div class="swatches">${swatches}</div>
        </div>
        <div class="row col">
          <span class="row-text"><b>Размер иероглифов</b><small>На карточках и странице слова</small></span>
          ${seg('hanziSize', [['s', 'Меньше'], ['m', 'Обычный'], ['l', 'Больше']], 'Размер иероглифов')}
        </div>
      </div>

      <h2 class="section-title">Данные</h2>
      <div class="group">
        <button type="button" class="row" data-act="export">
          <span class="row-text"><b>Сохранить прогресс в файл</b><small>Чтобы перенести на другое устройство</small></span>${icon('download')}
        </button>
        <button type="button" class="row" data-act="import">
          <span class="row-text"><b>Загрузить прогресс из файла</b><small>Заменит текущий прогресс на этом устройстве</small></span>${icon('upload')}
        </button>
        <button type="button" class="row danger" data-act="reset">
          <span class="row-text"><b>Сбросить прогресс</b><small>История, повторения, избранное, достижения</small></span>${icon('trash')}
        </button>
      </div>

      <h2 class="section-title">О приложении</h2>
      <div class="group about">
        <p><b>HSK 2 · 汉字</b>, версия ${APP_VERSION}. ${nWords(W.entries.length)} из учебника 新HSK教程 2, уроки 1–${W.lessons.length ? W.lessons[W.lessons.length - 1].n : 15}.</p>
        <p>Работает без интернета. Прогресс хранится только на этом устройстве.</p>
        <p>Порядок черт: Hanzi Writer (MIT) и данные Make Me a Hanzi (Arphic Public License).</p>
        <p>Сделано с поддержкой Claude.</p>
      </div>`;
  },

  onChange(e) {
    const el = e.target;
    if (el.dataset.setting) {
      settings.set({ [el.dataset.setting]: el.checked });
      if (el.dataset.setting === 'sound' && el.checked) {
        audio.prepare();
        audio.play('toggle');
      }
    }
  },

  actions: {
    set(el) {
      const k = el.dataset.k;
      const raw = el.dataset.v;
      const v = k === 'dailyGoal' ? Number(raw) : raw;
      settings.set({ [k]: v });
      for (const b of el.parentElement.querySelectorAll('[data-act="set"]')) b.setAttribute('aria-pressed', String(b === el));
      if (k === 'ttsRate') audio.speak('你好');
    },
    'test-voice'() {
      const ok = audio.speak('你好！我们开始学习吧。');
      if (!ok) toast('Китайский голос не найден. На iPhone он есть всегда; на компьютере попробуйте Chrome или Edge.', { icon: '🔇', timeout: 4500 });
      setTimeout(() => {
        const line = $('#voice-line');
        if (line) line.textContent = voiceLine();
      }, 600);
    },
    export() {
      const day = new Date().toISOString().slice(0, 10);
      download(`hsk2-progress-${day}.json`, JSON.stringify(exportData(), null, 1));
      toast('Файл прогресса сохранён', { icon: '💾' });
    },
    import() {
      const input = $('#import-file');
      input.value = '';
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        let data;
        try {
          data = JSON.parse(await file.text());
        } catch {
          toast('Не удалось прочитать файл', { icon: '⚠️' });
          return;
        }
        const ok = await confirmDialog({
          title: 'Загрузить прогресс?',
          text: 'Текущий прогресс на этом устройстве будет заменён данными из файла.',
          ok: 'Загрузить',
        });
        if (!ok) return;
        try {
          importData(data);
          window.location.reload();
        } catch (err) {
          toast(err.message || 'Неверный файл', { icon: '⚠️' });
        }
      };
      input.click();
    },
    async reset() {
      const ok = await confirmDialog({
        title: 'Сбросить прогресс?',
        text: 'История, повторения, избранное и достижения будут удалены без возможности восстановления. Настройки останутся.',
        ok: 'Сбросить',
        danger: true,
      });
      if (!ok) return;
      resetProgress();
      window.location.reload();
    },
  },
};
