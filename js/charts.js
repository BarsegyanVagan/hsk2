// Графики: линия результатов (одна серия) и календарь активности (один тон, светлее → темнее).

import { activity } from './store.js';
import { esc, dayIndex, dayDate, formatDay, plural } from './ui.js';

const CW = 320;
const CH = 150;
const PAD = { l: 30, r: 10, t: 10, b: 18 };
const yOf = (v) => PAD.t + ((100 - v) * (CH - PAD.t - PAD.b)) / 100;

/** points: [{ y: 0..100, label, date }] в хронологическом порядке. */
export function lineChart(points) {
  if (!points.length) return '<p class="chart-empty">Пройди тренировку — здесь появится график</p>';
  const n = points.length;
  const xs = points.map((_, i) => (n === 1 ? (PAD.l + CW - PAD.r) / 2 : PAD.l + (i * (CW - PAD.l - PAD.r)) / (n - 1)));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)} ${yOf(p.y).toFixed(1)}`).join(' ');
  const area = `${line} L${xs[n - 1].toFixed(1)} ${yOf(0)} L${xs[0].toFixed(1)} ${yOf(0)} Z`;
  const grid = [0, 50, 100].map((v) => `
    <line class="grid-line" x1="${PAD.l}" x2="${CW - PAD.r}" y1="${yOf(v)}" y2="${yOf(v)}"/>
    <text class="axis-label" x="${PAD.l - 6}" y="${yOf(v) + 3}" text-anchor="end">${v}%</text>`).join('');
  const last = points[n - 1];
  return `<div class="chart line-chart" data-xs="${xs.map((x) => x.toFixed(1)).join(',')}" data-points="${esc(JSON.stringify(points))}">
    <svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="Результаты последних тренировок, последний: ${last.y}%">
      <defs><linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" style="stop-color: var(--accent); stop-opacity: .22"/>
        <stop offset="1" style="stop-color: var(--accent); stop-opacity: 0"/>
      </linearGradient></defs>
      ${grid}
      ${n > 1 ? `<path class="area" d="${area}"/>` : ''}
      <path class="line" d="${line}"/>
      <line class="cross" x1="0" x2="0" y1="${PAD.t}" y2="${yOf(0)}" visibility="hidden"/>
      <circle class="dot" r="4.5" cx="${xs[n - 1].toFixed(1)}" cy="${yOf(last.y).toFixed(1)}"/>
      <circle class="dot hover-dot" r="5" cx="0" cy="0" visibility="hidden"/>
    </svg>
    <div class="chart-tip" hidden></div>
  </div>`;
}

/** Подсказка при наведении/касании: ближайшая точка по горизонтали. */
export function bindCharts(root) {
  for (const el of root.querySelectorAll('.line-chart')) {
    const xs = el.dataset.xs.split(',').map(Number);
    const pts = JSON.parse(el.dataset.points);
    const svg = el.querySelector('svg');
    const cross = el.querySelector('.cross');
    const dot = el.querySelector('.hover-dot');
    const tip = el.querySelector('.chart-tip');
    const nearest = (clientX) => {
      const r = svg.getBoundingClientRect();
      const x = ((clientX - r.left) * CW) / r.width;
      let best = 0;
      xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i; });
      return best;
    };
    const showAt = (i) => {
      const p = pts[i];
      cross.setAttribute('x1', xs[i]);
      cross.setAttribute('x2', xs[i]);
      cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', xs[i]);
      dot.setAttribute('cy', yOf(p.y));
      dot.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${p.y}%</b><br>${esc(p.label)}<br>${esc(p.date)}`;
      tip.hidden = false;
      const pct = Math.min(82, Math.max(18, (xs[i] / CW) * 100));
      tip.style.left = `${pct}%`;
      tip.style.top = `${Math.max(0, (yOf(p.y) / CH) * svg.getBoundingClientRect().height - 64)}px`;
    };
    const hide = () => {
      cross.setAttribute('visibility', 'hidden');
      dot.setAttribute('visibility', 'hidden');
      tip.hidden = true;
    };
    svg.addEventListener('pointermove', (e) => showAt(nearest(e.clientX)));
    svg.addEventListener('pointerdown', (e) => showAt(nearest(e.clientX)));
    svg.addEventListener('pointerleave', hide);
  }

  for (const el of root.querySelectorAll('.heatmap')) {
    const caption = el.parentElement.querySelector('.heat-caption');
    el.addEventListener('click', (e) => {
      const cell = e.target.closest('i[data-day]');
      if (!cell || !caption) return;
      const r = activity.day(Number(cell.dataset.day));
      caption.textContent = `${formatDay(Number(cell.dataset.day))}: ${r.a} ${plural(r.a, 'ответ', 'ответа', 'ответов')}${r.a ? `, верно ${r.c}` : ''}`;
    });
  }
}

/** Календарь активности за последние недели (столбец = неделя, строки = Пн…Вс). */
export function heatmap(weeks = 17) {
  const today = dayIndex();
  const dow = (dayDate(today).getDay() + 6) % 7;
  const end = today + (6 - dow);
  const start = end - weeks * 7 + 1;
  let cells = '';
  for (let d = start; d <= end; d++) {
    if (d > today) { cells += '<i class="future"></i>'; continue; }
    const a = activity.day(d).a;
    const lvl = a === 0 ? 0 : a < 10 ? 1 : a < 20 ? 2 : a < 40 ? 3 : 4;
    const title = `${formatDay(d)}: ${a} ${plural(a, 'ответ', 'ответа', 'ответов')}`;
    cells += `<i class="l${lvl}${d === today ? ' today' : ''}" data-day="${d}" title="${title}"></i>`;
  }
  return `<div class="heatmap" role="img" aria-label="Календарь занятий за ${weeks} недель">${cells}</div>
    <div class="heat-foot">
      <span class="heat-caption">Нажми на день, чтобы увидеть число ответов</span>
      <span class="heat-legend" aria-hidden="true">меньше
        <i style="background: var(--heat-0)"></i><i style="background: var(--heat-1)"></i><i style="background: var(--heat-2)"></i><i style="background: var(--heat-3)"></i><i style="background: var(--heat-4)"></i>
      больше</span>
    </div>`;
}
