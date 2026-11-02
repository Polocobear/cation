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
  back: '<path d="M20 12H5M10.5 6.5 5 12l5.5 5.5"/>',
  restart: '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M6.5 3.5v4h4"/>',
  send: '<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
  micOff: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5M4 4l16 16"/>',
  cam: '<rect x="3.5" y="6.5" width="12" height="11" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3"/>',
  camOff: '<rect x="3.5" y="6.5" width="12" height="11" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3M3 4l17 16"/>',
  leave: '<path d="M14 4.5h4.5v15H14M10.5 8 6.5 12l4 4M6.5 12h9"/>',
  panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14.5 4.5v15"/>',
  screen: '<rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
};

// Q's mark: a ring and a tail that starts inside it, stroked with the light defined in the page (#q-light).
export const Q_MARK = '<svg class="q-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11.5" cy="11" r="7"/><path d="m13.6 13.6 5.4 5.6"/></svg>';
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
