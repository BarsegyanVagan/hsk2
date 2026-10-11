// Главная: серия дней, цель на сегодня, что учить дальше.

import { settings, activity, meta, history, flags } from '../store.js';
import { W, dueWords, hardWords, favWords, overallStats, lessonStats, lessonWords, firstLessonWithNew, allWords, uniqueWords } from '../data.js';
import { icon, nWords, nLessons, plural, dayIndex, dayDate, formatDay, shuffle } from '../ui.js';
import { bar } from '../components.js';
import { startSession, MODES } from '../session.js';
import { nav, toast } from '../core.js';
import { canInstall, install, isIOS, isStandalone } from '../pwa.js';

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро!';
  if (h >= 12 && h < 18) return 'Добрый день!';
  if (h >= 18 && h < 23) return 'Добрый вечер!';
  return 'Доброй ночи!';
}

function cta(act, ic, title, sub, primary = false, attrs = '', extra = '') {
  return `<button type="button" class="cta${primary ? ' primary' : ''}" data-act="${act}" ${attrs}>
    <span class="cta-icon">${icon(ic)}</span>
    <span class="cta-text"><strong>${title}</strong><small>${sub}</small>${extra}</span>
    ${icon('chevronR')}
  </button>`;
}

function quick(act, ic, title, sub, tone = '') {
  return `<button type="button" class="quick" data-act="${act}">
    <span class="q-icon ${tone}">${icon(ic)}</span>
    <span><b>${title}</b><small>${sub}</small></span>
  </button>`;
}

export default {
  tab: 'home',

  html() {
    const s = settings.get();
    const first = activity.totals().a === 0 && history.list().length === 0;
    const today = activity.today();
    const goal = s.dailyGoal;
    const streak = activity.streak();
    const due = dueWords();
    const total = overallStats();
    const next = firstLessonWithNew();
    const last = meta.get().lastLesson;
    const C = 2 * Math.PI * 36;
    const off = C * (1 - Math.min(today.a, goal) / goal);
    const t = dayIndex();
    const dots = [...Array(7)].map((_, i) => {
      const d = t - 6 + i;
      const on = activity.day(d).a > 0;
      return `<span class="${on ? 'on' : ''}${i === 6 ? ' today' : ''}" title="${formatDay(d)}">${WD[dayDate(d).getDay()]}</span>`;
    }).join('');
    const dateLine = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    const mode = MODES[s.mode];

    let main;
    if (due.length) {
      main = cta('review', 'refresh', 'Повторить сегодня', `${nWords(due.length)} ждут повторения`, true);
    } else {
      main = cta('study', 'cards', `Учить: Урок ${next}`, `${mode.label} · ${nWords(lessonWords(next).length)}`, true, `data-lesson="${next}"`);
    }
    const showLast = last && (due.length || last !== next) && W.lessons.some((l) => l.n === last);
    const lastCta = showLast
      ? cta('study', 'cards', `Продолжить: Урок ${last}`, `${mode.label} · выучено ${lessonStats(last).learned} из ${lessonStats(last).total}`, false, `data-lesson="${last}"`, bar(lessonStats(last)))
      : '';

    const hard = hardWords().length;
    const fav = favWords().length;
    const best = meta.get().bestBlitz || 0;

    const iosHint = isIOS() && !isStandalone() && !flags.get('iosHint');

    return `
      <header class="home-head">
        <div>
          <p class="eyebrow">${dateLine}</p>
          <h1 class="home-title">${first ? 'Привет, добро пожаловать!' : greeting()}</h1>
        </div>
        <div class="logo-sm" aria-hidden="true">汉</div>
      </header>
      ${first ? `<p class="lead">Слова HSK 2 из учебника 新HSK教程 2: ${nWords(W.entries.length)} в ${nLessons(W.lessons.length)}. Смотри на иероглиф, вспоминай произношение и перевод, переворачивай карточку и отмечай, получилось ли.</p>` : ''}

      <div class="today-row">
        <div class="streak-card">
          <div class="streak-top">
            <div class="flame${streak ? '' : ' off'}">${icon('flame')}</div>
            <div><div class="big-num">${streak}</div><div class="small-label">${plural(streak, 'день', 'дня', 'дней')} подряд</div></div>
          </div>
          <div class="week-dots">${dots}</div>
        </div>
        <div class="goal-card">
          <div class="goal-ring${today.a >= goal ? ' done' : ''}">
            <svg viewBox="0 0 88 88" aria-hidden="true"><circle class="track" cx="44" cy="44" r="36"/><circle class="fill" cx="44" cy="44" r="36" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/></svg>
            <b>${today.a}<small>/${goal}</small></b>
          </div>
          <div class="small-label">${today.a >= goal ? 'Цель выполнена!' : 'Цель на сегодня'}</div>
        </div>
      </div>

      <div class="cta-stack">${main}${lastCta}</div>

      <div class="panel overall">
        <div class="overall-top"><b>Выучено ${total.learned} из ${total.total}</b><span>учу ${total.learning}</span></div>
        ${bar(total)}
        <div class="legend-row"><span><i style="background: var(--accent)"></i>выучено</span><span><i style="background: hsl(var(--ah) 70% 70% / .55)"></i>учу</span></div>
      </div>

      <h2 class="section-title">Быстрый старт</h2>
      <div class="quick-grid">
        ${quick('hard', 'alert', 'Трудные слова', hard ? nWords(hard) : 'пока нет', 'red')}
        ${quick('fav', 'star', 'Избранное', fav ? nWords(fav) : 'пусто', 'gold')}
        ${quick('blitz', 'bolt', 'Блиц 60 сек', best ? `рекорд ${best}` : 'все слова')}
        ${quick('match', 'puzzle', 'Найди пару', 'случайные слова')}
        ${quick('dict', 'book', 'Словарь', nWords(W.entries.length))}
        ${quick('history', 'clock', 'История', `${history.list().length} ${plural(history.list().length, 'тренировка', 'тренировки', 'тренировок')}`)}
      </div>

      <div class="install-row">
        ${canInstall() ? `<button type="button" class="btn btn-secondary btn-block" data-act="install">${icon('download')} Установить приложение</button>` : ''}
        ${iosHint ? `<div class="ios-hint">
          <p>Установи на экран «Домой»: нажми ${icon('share', 'inline-icon')} «Поделиться», затем «На экран „Домой“».</p>
          <button type="button" class="icon-btn" data-act="ios-close" aria-label="Скрыть подсказку">${icon('close')}</button>
        </div>` : ''}
      </div>`;
  },

  actions: {
    review() {
      startSession({ mode: 'cards', kind: 'review', title: 'Повторение', words: dueWords() });
    },
    study(el) {
      const n = Number(el.dataset.lesson);
      startSession({ kind: 'lesson', lesson: n, title: `Урок ${n}`, words: lessonWords(n) });
    },
    hard() {
      const words = hardWords();
      if (!words.length) { toast('Трудных слов пока нет — здесь соберутся слова с ошибками', { icon: '👍' }); return; }
      startSession({ kind: 'hard', title: 'Трудные слова', words });
    },
    fav() {
      const words = favWords();
      if (!words.length) { toast('Отмечай слова звёздочкой ⭐ — они появятся здесь', { icon: '⭐' }); return; }
      startSession({ kind: 'fav', title: 'Избранное', words });
    },
    blitz() {
      startSession({ mode: 'blitz', kind: 'all', title: 'Блиц · все слова', words: allWords() });
    },
    match() {
      startSession({ mode: 'match', kind: 'random', title: 'Найди пару', words: shuffle(uniqueWords(allWords())).slice(0, 18) });
    },
    dict() { nav.tab('dict'); },
    history() { nav.push('history'); },
    install() { install(); },
    'ios-close'() {
      flags.set('iosHint');
      nav.refresh();
    },
  },
};
