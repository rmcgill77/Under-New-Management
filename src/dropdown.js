// ============================================================================
// Dropdowns: every <select> in the game is swapped for a themed paper-and-lamp
// control, so nothing comes from the browser's own widget set. The real select
// stays in the page (hidden) as the source of truth, so the rest of the code
// still reads .value and listens for 'change'.
// ============================================================================
(() => {
  let open = null; // { trigger, sel, pop, idx, items }

  function label(sel) {
    const o = sel.options[sel.selectedIndex];
    return o ? o.textContent : '';
  }
  function sync(sel) {
    const b = sel._dd;
    if (!b) return;
    b.firstChild.textContent = label(sel);
    b.disabled = sel.disabled;
  }
  function enhance(sel) {
    if (sel._dd) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dd';
    b.setAttribute('aria-haspopup', 'listbox');
    b.setAttribute('aria-expanded', 'false');
    const al = sel.getAttribute('aria-label');
    if (al) b.setAttribute('aria-label', al);
    const t = document.createElement('span'); t.className = 'dd-text';
    const ch = document.createElement('i'); ch.className = 'dd-chev'; ch.setAttribute('aria-hidden', 'true');
    b.append(t, ch);
    sel.style.display = 'none';
    sel.tabIndex = -1;
    sel._dd = b;
    sel.insertAdjacentElement('afterend', b);
    sync(sel);
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open && open.trigger === b ? close() : show(b, sel); });
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(b, sel); }
    });
  }
  function close(refocus = true) {
    if (!open) return;
    const { trigger, pop } = open;
    pop.remove();
    trigger.setAttribute('aria-expanded', 'false');
    open = null;
    if (refocus && trigger.isConnected) trigger.focus({ preventScroll: true });
  }
  function choose(i) {
    const { sel, items } = open;
    const it = items[i];
    if (!it || it.disabled) return;
    close();
    if (sel.selectedIndex !== it.index) {
      sel.selectedIndex = it.index;
      sync(sel);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function mark(i) {
    const { pop, items } = open;
    open.idx = i;
    [...pop.children].forEach((el, k) => el.classList.toggle('on', k === i));
    const el = pop.children[i];
    if (el) { pop.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); }
  }
  function step(dir) {
    const { items } = open;
    let i = open.idx;
    for (let n = 0; n < items.length; n++) { i = (i + dir + items.length) % items.length; if (!items[i].disabled) break; }
    mark(i);
  }
  function show(trigger, sel) {
    close(false);
    const pop = document.createElement('div');
    pop.className = 'dd-pop'; pop.setAttribute('role', 'listbox'); pop.tabIndex = -1;
    const items = [...sel.options].map((o, index) => ({ index, text: o.textContent, disabled: o.disabled }));
    items.forEach((it, i) => {
      const el = document.createElement('div');
      el.className = 'dd-opt' + (it.disabled ? ' dis' : '') + (it.index === sel.selectedIndex ? ' cur' : '');
      el.id = 'ddo' + i; el.setAttribute('role', 'option'); el.textContent = it.text;
      el.setAttribute('aria-selected', it.index === sel.selectedIndex ? 'true' : 'false');
      if (it.disabled) el.setAttribute('aria-disabled', 'true');
      el.addEventListener('pointerup', (e) => { e.preventDefault(); e.stopPropagation(); choose(i); });
      el.addEventListener('pointermove', () => { if (!it.disabled && open && open.idx !== i) mark(i); });
      pop.appendChild(el);
    });
    document.body.appendChild(pop);
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(Math.max(r.width, 200), vw - 16);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + 'px';
    const room = { below: vh - r.bottom - 8, above: r.top - 8 };
    const h = Math.min(pop.scrollHeight + 4, vh * 0.5);
    const up = room.below < h && room.above > room.below;
    const maxH = Math.max(120, Math.min(vh * 0.5, up ? room.above : room.below));
    pop.style.maxHeight = maxH + 'px';
    if (up) pop.style.bottom = (vh - r.top + 2) + 'px'; else pop.style.top = (r.bottom + 2) + 'px';
    trigger.setAttribute('aria-expanded', 'true');
    open = { trigger, sel, pop, items, idx: Math.max(0, items.findIndex((x) => x.index === sel.selectedIndex)) };
    mark(open.idx);
    pop.focus({ preventScroll: true });
    pop.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
      else if (e.key === 'Home') { e.preventDefault(); mark(items.findIndex((x) => !x.disabled)); }
      else if (e.key === 'End') { e.preventDefault(); let k = items.length - 1; while (k > 0 && items[k].disabled) k--; mark(k); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(open.idx); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Tab') close();
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (open && !open.pop.contains(e.target) && !open.trigger.contains(e.target)) close(false);
  }, true);
  window.addEventListener('resize', () => close(false));
  window.addEventListener('scroll', (e) => { if (open && !open.pop.contains(e.target)) close(false); }, true);

  function scan(root) {
    root.querySelectorAll('select').forEach((s) => { if (!s._dd) enhance(s); else if (!s._dd.isConnected) { s._dd = null; enhance(s); } });
    if (open && !open.trigger.isConnected) close(false);
  }
  function start() {
    scan(document);
    new MutationObserver(() => scan(document)).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
