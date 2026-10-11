// Достижения: список и проверка условий.

import { achievements, activity, history, meta, settings } from './store.js';
import { W, overallStats, lessonStats } from './data.js';

export const ACH = [
  { id: 'first',      emoji: '🎯', title: 'Первый шаг',          desc: 'Пройти первую тренировку' },
  { id: 'perfect',    emoji: '💯', title: 'Без ошибок',          desc: '100% в тренировке от 5 слов' },
  { id: 'goal',       emoji: '✅', title: 'Цель дня',            desc: 'Выполнить дневную цель' },
  { id: 'streak3',    emoji: '🔥', title: 'Разогрев',            desc: '3 дня подряд' },
  { id: 'streak7',    emoji: '🔥', title: 'Неделя подряд',       desc: '7 дней подряд' },
  { id: 'streak30',   emoji: '🏆', title: 'Месяц подряд',        desc: '30 дней подряд' },
  { id: 'learned10',  emoji: '🌱', title: 'Первые 10',           desc: 'Выучить 10 слов' },
  { id: 'learned50',  emoji: '🌿', title: 'Полсотни',            desc: 'Выучить 50 слов' },
  { id: 'learned100', emoji: '🌳', title: 'Сотня',               desc: 'Выучить 100 слов' },
  { id: 'learnedAll', emoji: '👑', title: 'Весь HSK 2',          desc: 'Выучить все слова' },
  { id: 'lesson',     emoji: '📗', title: 'Урок выучен',         desc: 'Выучить все слова одного урока' },
  { id: 'answers100', emoji: '💪', title: 'Сто ответов',         desc: 'Ответить 100 раз' },
  { id: 'answers1k',  emoji: '🚀', title: 'Тысяча ответов',      desc: 'Ответить 1000 раз' },
  { id: 'blitz15',    emoji: '⚡', title: 'Молния',              desc: '15+ верных ответов в блице' },
  { id: 'match',      emoji: '🧩', title: 'Зоркий глаз',         desc: '«Найди пару» без ошибок' },
  { id: 'tones',      emoji: '🎵', title: 'Тональный слух',      desc: '100% в тренировке тонов от 5 слов' },
  { id: 'writer',     emoji: '✍️', title: 'Каллиграф',           desc: 'Написать 10 иероглифов' },
  { id: 'curious',    emoji: '🔍', title: 'Любопытный',          desc: 'Открыть 20 слов в словаре' },
  { id: 'owl',        emoji: '🦉', title: 'Сова',                desc: 'Заниматься после 23:00' },
  { id: 'lark',       emoji: '🐦', title: 'Жаворонок',           desc: 'Заниматься до 7 утра' },
];

/** Проверяет условия и возвращает только что полученные достижения. */
export function checkAchievements({ result = null } = {}) {
  const got = [];
  const unlock = (id) => {
    if (achievements.unlock(id)) got.push(ACH.find((a) => a.id === id));
  };

  if (history.list().length > 0) unlock('first');

  if (result) {
    if (result.percent === 100 && result.total >= 5 && result.mode !== 'blitz') unlock('perfect');
    if (result.mode === 'blitz' && (result.extra.score || 0) >= 15) unlock('blitz15');
    if (result.mode === 'match' && result.extra.mistakes === 0 && result.total >= 6) unlock('match');
    if (result.mode === 'tones' && result.percent === 100 && result.total >= 5) unlock('tones');
    const h = new Date().getHours();
    if (h >= 23) unlock('owl');
    if (h >= 4 && h < 7) unlock('lark');
  }

  if (activity.today().a >= settings.get().dailyGoal) unlock('goal');

  const streak = activity.streak();
  if (streak >= 3) unlock('streak3');
  if (streak >= 7) unlock('streak7');
  if (streak >= 30) unlock('streak30');

  const st = overallStats();
  if (st.learned >= 10) unlock('learned10');
  if (st.learned >= 50) unlock('learned50');
  if (st.learned >= 100) unlock('learned100');
  if (st.total > 0 && st.learned === st.total) unlock('learnedAll');
  if (W.lessons.some((l) => {
    const ls = lessonStats(l.n);
    return ls.total > 0 && ls.learned === ls.total;
  })) unlock('lesson');

  const total = activity.totals().a;
  if (total >= 100) unlock('answers100');
  if (total >= 1000) unlock('answers1k');

  const m = meta.get();
  if ((m.written || 0) >= 10) unlock('writer');
  if ((m.viewed || []).length >= 20) unlock('curious');

  return got.filter(Boolean);
}
