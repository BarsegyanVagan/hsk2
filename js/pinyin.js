// Пиньинь: тоны, слоги, проверка ввода.

const MARKS = {
  'ā': 'a1', 'á': 'a2', 'ǎ': 'a3', 'à': 'a4',
  'ē': 'e1', 'é': 'e2', 'ě': 'e3', 'è': 'e4',
  'ī': 'i1', 'í': 'i2', 'ǐ': 'i3', 'ì': 'i4',
  'ō': 'o1', 'ó': 'o2', 'ǒ': 'o3', 'ò': 'o4',
  'ū': 'u1', 'ú': 'u2', 'ǔ': 'u3', 'ù': 'u4',
  'ǖ': 'ü1', 'ǘ': 'ü2', 'ǚ': 'ü3', 'ǜ': 'ü4',
};
const MARKED_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
const TONED = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };

const INITIALS = ['', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];
const FINALS = ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'er',
  'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong',
  'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ueng', 'üe', 'üan', 'ün', 'ue'];

// Набор допустимых слогов (с запасом: лишние сочетания согласных не мешают разбору).
// Без начальной согласной бывают только слоги на a/o/e (an, ou, er…): uan, ia и т. п. пишутся как wan, ya.
const SYL = new Set();
for (const ini of INITIALS) {
  for (const fin of FINALS) {
    if (!ini && !/^[aoe]/.test(fin)) continue;
    SYL.add(ini + fin);
  }
}

export function toneless(s) {
  return String(s).toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, (c) => MARKS[c][0]);
}

function toneOf(text) {
  for (const ch of text) if (MARKS[ch]) return Number(MARKS[ch][1]);
  return 5;
}

/** Делит пиньинь на слоги: [{ text, plain, tone, er }] (tone 5 = нейтральный). */
export function syllables(pinyin) {
  const chunks = String(pinyin).toLowerCase().split(/[\s'’\-·]+/).filter(Boolean);
  const out = [];
  for (const chunk of chunks) {
    const plain = toneless(chunk);
    const n = plain.length;
    const best = new Array(n + 1).fill(null);
    best[n] = { count: 0, len: 0 };
    for (let i = n - 1; i >= 0; i--) {
      if (i > 0 && plain.slice(i) === 'r') { best[i] = { count: 0, len: 1, er: true }; continue; }
      for (let len = Math.min(6, n - i); len >= 1; len--) {
        const s = plain.slice(i, i + len);
        if (!SYL.has(s) || !best[i + len]) continue;
        if (i > 0 && /^[aoe]/.test(s)) continue; // слог на гласную внутри слова пишется через апостроф
        const count = 1 + best[i + len].count;
        if (!best[i] || count < best[i].count) best[i] = { count, len };
      }
    }
    if (!best[0]) {
      out.push({ text: chunk, plain, tone: toneOf(chunk), er: false });
      continue;
    }
    let i = 0;
    while (i < n) {
      const b = best[i];
      if (b.er && out.length) {
        const last = out[out.length - 1];
        last.text += 'r';
        last.plain += 'r';
        last.er = true;
        i += 1;
        continue;
      }
      const text = chunk.slice(i, i + b.len);
      out.push({ text, plain: plain.slice(i, i + b.len), tone: toneOf(text), er: false });
      i += b.len;
    }
  }
  return out;
}

/** Пиньинь с цифрами тонов: bāngmáng → bang1mang2 (нейтральный тон без цифры). */
export function numbered(pinyin) {
  return syllables(pinyin).map((s) => {
    const base = s.er ? s.plain.slice(0, -1) : s.plain;
    return base + (s.tone === 5 ? '' : s.tone) + (s.er ? 'r' : '');
  }).join('');
}

/** Ставит знак тона на слог: applyTone('bang', 1) → bāng */
export function applyTone(syl, tone) {
  if (!tone || tone === 5) return syl;
  let idx = syl.indexOf('a');
  if (idx < 0) idx = syl.indexOf('e');
  if (idx < 0 && syl.includes('ou')) idx = syl.indexOf('o');
  if (idx < 0) {
    for (let i = syl.length - 1; i >= 0; i--) {
      if ('iouü'.includes(syl[i])) { idx = i; break; }
    }
  }
  if (idx < 0) return syl;
  return syl.slice(0, idx) + TONED[syl[idx]][tone - 1] + syl.slice(idx + 1);
}

/**
 * Сравнивает введённый пиньинь с правильным.
 * 'exact' — всё верно; 'toneless' — буквы верны, тоны не указаны;
 * 'tones' — буквы верны, тоны нет; 'wrong' — неверно; 'empty' — пусто.
 * Тоны можно вводить знаками (bāng) или цифрами (bang1); ü можно писать как v.
 */
export function checkPinyin(input, answer) {
  const s = String(input).toLowerCase().trim().replace(/u:/g, 'ü').replace(/v/g, 'ü');
  if (!s) return 'empty';
  const ansLetters = toneless(answer).replace(/[^a-zü]/g, '');
  const inLetters = toneless(s).replace(/[^a-zü]/g, '');
  if (inLetters !== ansLetters) return 'wrong';
  const hasMarks = MARKED_RE.test(s);
  const hasDigits = /[1-5]/.test(s);
  if (!hasMarks && !hasDigits) return 'toneless';
  const inNum = hasMarks ? numbered(s) : s.replace(/[^a-zü1-5]/g, '').replace(/5/g, '');
  return inNum === numbered(answer) ? 'exact' : 'tones';
}
