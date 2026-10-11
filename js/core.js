// Навигация между экранами, всплывающие сообщения, окно подтверждения.

import { $, esc, reducedMotion } from './ui.js';

export const app = {
  screens: {},
  current: null,
  params: {},
  session: null,   // идущая тренировка
  result: null,    // последний результат
  afterShow: null, // вызывается после каждой смены экрана
};

let afterPop = null;

/* ---------- Экраны ----------
   Каждый экран — запись в истории браузера, поэтому системная кнопка «Назад»
   просто возвращает на предыдущий экран. */
export const nav = {
  stack: [],
  init(name, params = {}) {
    this.stack = [{ name, params }];
    history.replaceState({ depth: 0, name, params }, '');
    show(name, params, 'init');
  },
  push(name, params = {}) {
    saveScroll();
    this.stack.push({ name, params });
    history.pushState({ depth: this.stack.length - 1, name, params }, '');
    show(name, params, 'fwd');
  },
  replace(name, params = {}) {
    this.stack[this.stack.length - 1] = { name, params };
    history.replaceState({ depth: this.stack.length - 1, name, params }, '');
    show(name, params, 'fwd');
  },
  back(fallback = 'home') {
    if (this.stack.length > 1) history.back();
    else this.replace(fallback);
  },
  backTo(name) {
    const names = this.stack.map((e) => e && e.name);
    const i = names.lastIndexOf(name);
    const top = this.stack.length - 1;
    if (i === -1) this.replace(name);
    else if (i === top) show(name, this.stack[top].params, 'fwd');
    else history.go(i - top);
  },
  /** Переход по нижней панели: Главная всегда внизу стека, вкладка — над ней. */
  tab(name) {
    const top = this.stack.length - 1;
    if (name === 'home') { this.backTo('home'); return; }
    if (this.stack[top] && this.stack[top].name === name && top <= 1) {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    if (top === 0) this.push(name);
    else if (top === 1) this.replace(name);
    else {
      afterPop = () => this.replace(name);
      history.go(1 - top);
    }
  },
  refresh() {
    show(app.current, app.params, 'refresh', window.scrollY);
  },
};

function saveScroll() {
  const top = nav.stack[nav.stack.length - 1];
  if (top) top.scroll = window.scrollY;
}

function show(name, params = {}, dir = 'fwd', scroll = 0) {
  const scr = app.screens[name];
  const prev = app.screens[app.current];
  if (prev && prev.unmount) prev.unmount();
  app.current = name;
  app.params = params || {};

  const view = $('#view');
  view.className = `view screen-${name}${scr.full ? ' full' : ''}`;
  document.body.classList.toggle('no-tabbar', !!scr.full);
  for (const t of document.querySelectorAll('.tab')) {
    if (t.dataset.tab === scr.tab) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  }
  view.innerHTML = scr.html(app.params);
  if (dir !== 'refresh' && dir !== 'init' && !reducedMotion()) {
    void view.offsetWidth;
    view.classList.add(dir === 'back' ? 'enter-back' : 'enter');
  }
  window.scrollTo(0, dir === 'back' || dir === 'refresh' ? scroll : 0);
  if (scr.mount) scr.mount(view, app.params);
  if (app.afterShow) app.afterShow(name);
}

window.addEventListener('popstate', (e) => {
  const st = e.state && typeof e.state.depth === 'number' ? e.state : { depth: 0, name: 'home', params: {} };
  if (isModalOpen()) closeModal(false);
  const top = nav.stack.length - 1;
  const dir = st.depth < top ? 'back' : 'fwd';
  if (nav.stack.length > st.depth + 1) nav.stack.length = st.depth + 1;
  let entry = nav.stack[st.depth];
  if (!entry) {
    entry = { name: st.name || 'home', params: st.params || {} };
    nav.stack[st.depth] = entry;
  }
  const scr = app.screens[entry.name];
  if (!scr || (scr.valid && !scr.valid(entry.params))) {
    entry = { name: st.depth === 0 ? 'home' : 'learn', params: {} };
    nav.stack[st.depth] = entry;
    history.replaceState({ depth: st.depth, ...entry }, '');
  }
  show(entry.name, entry.params, dir, entry.scroll || 0);
  if (afterPop) {
    const fn = afterPop;
    afterPop = null;
    fn();
  }
});

/* ---------- Всплывающие сообщения ---------- */
export function toast(text, { icon = '', timeout = 2600, action = null } = {}) {
  const box = document.createElement('div');
  box.className = 'toast';
  box.setAttribute('role', 'status');
  box.innerHTML = `${icon ? `<span class="t-icon" aria-hidden="true">${icon}</span>` : ''}<span>${esc(text)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  $('#toasts').append(box);
  requestAnimationFrame(() => box.classList.add('show'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    box.classList.remove('show');
    setTimeout(() => box.remove(), 260);
  };
  if (action) {
    box.querySelector('button').addEventListener('click', () => {
      close();
      action.fn();
    });
  }
  if (timeout) setTimeout(close, timeout);
  return close;
}

export function announce(text) {
  const live = $('#live');
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 30);
}

/* ---------- Окно подтверждения ---------- */
const modal = { resolve: null, returnFocus: null };
export const isModalOpen = () => modal.resolve !== null;

export function confirmDialog({ title, text, ok, cancel = 'Отмена', danger = false }) {
  if (modal.resolve) closeModal(false);
  return new Promise((resolve) => {
    modal.resolve = resolve;
    modal.returnFocus = document.activeElement;
    $('#modal-title').textContent = title;
    $('#modal-text').textContent = text;
    const okBtn = $('#modal-ok');
    okBtn.textContent = ok;
    okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
    $('#modal-cancel').textContent = cancel;
    $('#modal').hidden = false;
    $('#modal-cancel').focus({ preventScroll: true });
  });
}

export function closeModal(result) {
  if (!modal.resolve) return;
  const resolve = modal.resolve;
  const back = modal.returnFocus;
  modal.resolve = null;
  modal.returnFocus = null;
  $('#modal').hidden = true;
  if (back && back.focus && document.contains(back) && !app.screens[app.current]?.full) {
    back.focus({ preventScroll: true });
  } else if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
  resolve(result);
}
