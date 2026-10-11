// Запуск тренировок, учёт ответов и итог.

import { app, nav, toast } from './core.js';
import { settings, history, activity, progress, meta } from './store.js';
import { shuffle, reducedMotion } from './ui.js';
import { visible, uniqueWords } from './data.js';
import { checkAchievements } from './achievements.js';
import * as audio from './audio.js';
import { celebrate } from './celebrate.js';

export const MODES = {
  cards: { label: 'Карточки',   icon: 'cards',  desc: 'Вспомни, переверни и честно отметь ответ' },
  quiz:  { label: 'Варианты',   icon: 'list',   desc: 'Выбери правильный ответ из четырёх' },
  tones: { label: 'Тоны',       icon: 'tone',   desc: 'Угадай тон каждого слога' },
  match: { label: 'Пары',       icon: 'puzzle', desc: 'Соедини иероглифы с переводами на время' },
  blitz: { label: 'Блиц',       icon: 'bolt',   desc: 'Сколько успеешь за 60 секунд' },
};

export const DIRECTIONS = {
  hz2ru: '汉字 → перевод',
  ru2hz: 'Перевод → 汉字',
  py2hz: 'Пиньинь → 汉字',
  audio: 'На слух',
};

export const CELEBRATE_FROM = 96;

/** Начинает тренировку. how: 'push' — новый экран, 'replace' — вместо текущего. */
export function startSession(cfg, how = 'push') {
  const s = settings.get();
  const mode = cfg.mode || s.mode;
  let words = visible(cfg.words || []);
  if (mode === 'match' || mode === 'tones' || mode === 'blitz') words = uniqueWords(words);
  if (!words.length) {
    toast('Здесь пока нет слов', { icon: '🤔' });
    return false;
  }
  if (mode === 'match' && words.length < 2) {
    toast('Для «Пар» нужно хотя бы 2 слова', { icon: '🧩' });
    return false;
  }
  if (s.shuffle && mode !== 'match' && mode !== 'blitz') words = shuffle(words);
  app.session = {
    mode,
    kind: cfg.kind || 'lesson',
    title: cfg.title,
    baseTitle: cfg.baseTitle || cfg.title,
    lesson: cfg.lesson ?? null,
    words,
    started: Date.now(),
  };
  if (cfg.kind === 'lesson' && cfg.lesson != null) meta.set({ lastLesson: cfg.lesson });
  audio.prepare();
  nav[how](mode);
  return true;
}

/** Записывает ответ; возвращает прежнее состояние слова (для отмены). */
export function recordAnswer(word, correct, srs) {
  const goal = settings.get().dailyGoal;
  const before = activity.today().a;
  const prev = progress.record(word.key, correct, srs);
  activity.add(correct, 1);
  if (before < goal && before + 1 >= goal) {
    setTimeout(() => toast('Цель на сегодня выполнена!', { icon: '🎯' }), 350);
    showUnlocked(checkAchievements(), 1500);
  }
  return prev;
}

export function undoAnswer(word, correct, prev) {
  progress.restore(word.key, prev);
  activity.add(correct, -1);
}

export function showUnlocked(list, delay = 600) {
  list.forEach((a, i) => {
    setTimeout(() => {
      toast(`Новое достижение: ${a.title}`, { icon: a.emoji, timeout: 3200 });
      audio.play('achievement');
    }, delay + i * 1000);
  });
}

let stopConfetti = null;
export function stopCelebration() {
  if (stopConfetti) {
    stopConfetti();
    stopConfetti = null;
  }
}

/** Завершает тренировку: сохраняет результат и открывает экран итога. */
export function finishSession(answers, extra = {}) {
  const s = app.session;
  if (!s) return;
  app.session = null;
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const seen = new Set();
  const mistakes = [];
  for (const a of answers) {
    if (!a.correct && !seen.has(a.word.key)) {
      seen.add(a.word.key);
      mistakes.push(a.word);
    }
  }
  const result = {
    mode: s.mode,
    kind: s.kind,
    title: s.title,
    baseTitle: s.baseTitle,
    lesson: s.lesson,
    words: s.words,
    total,
    correct,
    percent,
    mistakes,
    extra,
    durationMs: Date.now() - s.started,
  };
  if (total > 0) {
    history.add({
      date: new Date().toISOString(),
      mode: s.mode,
      kind: s.kind,
      lesson: s.lesson,
      title: s.title,
      total,
      correct,
      percent,
      score: extra.score,
    });
    activity.addTest();
  }
  result.unlocked = checkAchievements({ result });
  app.result = result;
  nav.replace('result');
  showUnlocked(result.unlocked, 1300);

  if (total > 0 && percent >= CELEBRATE_FROM) {
    setTimeout(() => {
      if (app.current !== 'result' || app.result !== result) return;
      audio.play('victory');
      stopCelebration();
      stopConfetti = celebrate({ reduced: reducedMotion() });
    }, 320);
  }
}

/** Выход из тренировки без сохранения. */
export function leaveSession() {
  app.session = null;
  nav.back('learn');
}

export function repeatFromResult(onlyMistakes) {
  const r = app.result;
  if (!r) return;
  if (onlyMistakes) {
    if (!r.mistakes.length) return;
    startSession({
      mode: r.mode === 'blitz' ? 'cards' : r.mode,
      kind: 'mistakes',
      lesson: r.lesson,
      title: `Ошибки · ${r.baseTitle}`,
      baseTitle: r.baseTitle,
      words: r.mistakes,
    }, 'replace');
  } else {
    startSession({ mode: r.mode, kind: r.kind, lesson: r.lesson, title: r.title, baseTitle: r.baseTitle, words: r.words }, 'replace');
  }
}

/** Общая часть для экранов тренировки: прерывание через «Назад» без сохранения. */
export function sessionLeftUnexpectedly() {
  if (app.session) {
    app.session = null;
    toast('Тренировка прервана, результат не сохранён', { icon: '↩️' });
  }
}
