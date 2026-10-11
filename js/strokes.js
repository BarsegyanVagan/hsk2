// Порядок черт: анимация и письмо пальцем (библиотека Hanzi Writer, данные — data/strokes.json).

let dataPromise = null;

function loadData() {
  if (!dataPromise) {
    dataPromise = fetch('data/strokes.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch((e) => {
        dataPromise = null;
        throw e;
      });
  }
  return dataPromise;
}

/** Цвет CSS-переменной в виде rgb(...) — так его понимает библиотека. */
function cssColor(name, fallback) {
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  probe.style.display = 'none';
  document.body.append(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c || fallback;
}

export async function hasStrokes(char) {
  try {
    const data = await loadData();
    return !!data[char];
  } catch {
    return false;
  }
}

/** Создаёт рисовалку иероглифа в элементе el. */
export async function createWriter(el, char) {
  const HW = window.HanziWriter;
  if (!HW) throw new Error('nolib');
  const data = await loadData();
  if (!data[char]) throw new Error('nodata');
  el.innerHTML = '';
  const size = Math.round(el.clientWidth) || 260;
  return HW.create(el, char, {
    width: size,
    height: size,
    padding: Math.round(size * 0.06),
    showOutline: true,
    showCharacter: false,
    strokeColor: cssColor('--text', '#17172a'),
    radicalColor: cssColor('--accent', '#5b4be8'),
    outlineColor: cssColor('--surface-3', '#e9e7f3'),
    drawingColor: cssColor('--accent', '#5b4be8'),
    highlightColor: cssColor('--accent-2', '#9b5cf6'),
    drawingWidth: 6,
    strokeAnimationSpeed: 1.1,
    delayBetweenStrokes: 220,
    charDataLoader: (c, onLoad, onError) => (data[c] ? onLoad(data[c]) : onError(new Error('nodata'))),
  });
}
