// Small helpers the dashboard's panels share: building elements, icons, dates and the menus that drop from a button.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

// Line icons on a 24 grid, drawn with the stroke of the text they sit in.
const PATHS = {
  arrow: '<path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  down: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  check: '<path d="m5.5 12.5 4.2 4.2 8.8-9.4"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  lesson: '<path d="M3.5 6.5 12 3l8.5 3.5L12 10z"/><path d="M7 8.3v4.6c1.4 1.4 3.1 2.1 5 2.1s3.6-.7 5-2.1V8.3"/><path d="M20.5 6.5v5"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.5 4.5"/>',
  course: '<path d="M4 5.5c2.7-1 5.3-1 8 .7 2.7-1.7 5.3-1.7 8-.7v13c-2.7-1-5.3-1-8 .7-2.7-1.7-5.3-1.7-8-.7z"/><path d="M12 6.2v13"/>',
  subject: '<circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="12" r="8.5"/>',
  module: '<path d="M4.5 7h15M4.5 12h15M4.5 17h9"/>',
  lock: '<rect x="6" y="10.5" width="12" height="9" rx="2"/><path d="M8.8 10.5V8a3.2 3.2 0 0 1 6.4 0v2.5"/>',
};
export const icon = (name, cls = 'i') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;

// ---------------------------------------------------------------- dates

export const dateLabel = (d, opts = { day: 'numeric', month: 'short' }) => d.toLocaleDateString('en-GB', opts);

// ---------------------------------------------------------------- menus

// A button that opens the panel after it. One menu is open at a time; Escape or a click elsewhere closes it and puts
// focus back on its button.
let open = null;
export function menu(button, panel, { onOpen } = {}) {
  const close = (refocus) => {
    if (open !== close) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    open = null;
    if (refocus) button.focus();
  };
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open === close) return close();
    open?.();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    open = close;
    onOpen?.();
  });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } });
  return close;
}
document.addEventListener('click', (e) => { if (open && !e.target.closest('[data-menu]')) open(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) open(true); });
