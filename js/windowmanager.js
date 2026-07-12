/* ── WINDOW MANAGER ── */
class WindowManager {
  constructor(container, onTaskbarUpdate){
    this.container = container;
    this.windows = new Map();
    this.zTop = 100;
    this.onTaskbarUpdate = onTaskbarUpdate;
    this.offsetIdx = 0;
  }

  create({ id, title, icon, width = 680, height = 460, content }){
    if (this.windows.has(id)){ this.focus(id); this.restore(id); return this.windows.get(id); }

    const el = document.createElement('div');
    el.className = 'win';
    el.dataset.winId = id;
    const ox = 100 + (this.offsetIdx % 8) * 30;
    const oy = 40 + (this.offsetIdx % 8) * 30;
    el.style.cssText = `width:${width}px;height:${height}px;left:${ox}px;top:${oy}px;z-index:${++this.zTop}`;

    el.innerHTML = `
      <div class="win-title" data-drag>
        <svg class="win-icon" viewBox="0 0 24 24">${icon || ''}</svg>
        <span class="win-name">${title}</span>
        <div class="win-controls">
          <button data-act="min">${ICO.minimize}</button>
          <button data-act="max">${ICO.maximize}</button>
          <button class="close-btn" data-act="close">${ICO.close}</button>
        </div>
      </div>
      <div class="win-body"></div>
      <div class="win-resize"></div>`;

    this.container.appendChild(el);
    const winObj = { id, title, icon, el, minimized: false, maximized: false, prevRect: null };
    this.windows.set(id, winObj);
    this.offsetIdx++;

    // Insert app content
    const body = el.querySelector('.win-body');
    if (typeof content === 'function') content(body, winObj);
    else if (typeof content === 'string') body.innerHTML = content;
    else if (content instanceof Node) body.appendChild(content);

    this._wire(el, id);
    this.focus(id);
    this._updateTaskbar();
    return winObj;
  }

  focus(id){
    const w = this.windows.get(id); if (!w) return;
    w.el.style.zIndex = ++this.zTop;
    this._updateTaskbar();
  }

  minimize(id){
    const w = this.windows.get(id); if (!w) return;
    w.minimized = true; w.el.classList.add('minimized');
    this._updateTaskbar();
  }

  restore(id){
    const w = this.windows.get(id); if (!w) return;
    w.minimized = false; w.el.classList.remove('minimized');
    this.focus(id);
    this._updateTaskbar();
  }

  toggleMax(id){
    const w = this.windows.get(id); if (!w) return;
    if (w.maximized){
      w.maximized = false; w.el.classList.remove('maximized');
      if (w.prevRect){ w.el.style.left = w.prevRect.l; w.el.style.top = w.prevRect.t; w.el.style.width = w.prevRect.w; w.el.style.height = w.prevRect.h; }
    } else {
      w.prevRect = { l: w.el.style.left, t: w.el.style.top, w: w.el.style.width, h: w.el.style.height };
      w.maximized = true; w.el.classList.add('maximized');
    }
  }

  close(id){
    const w = this.windows.get(id); if (!w) return;
    w.el.classList.add('closing');
    setTimeout(() => { w.el.remove(); this.windows.delete(id); this._updateTaskbar(); }, 150);
  }

  getOpenIds(){ return [...this.windows.keys()]; }

  _wire(el, id){
    const titlebar = el.querySelector('[data-drag]');
    const resizeHandle = el.querySelector('.win-resize');

    // Controls
    el.querySelector('[data-act="close"]').onclick = (e) => { e.stopPropagation(); this.close(id); };
    el.querySelector('[data-act="min"]').onclick = (e) => { e.stopPropagation(); this.minimize(id); };
    el.querySelector('[data-act="max"]').onclick = (e) => { e.stopPropagation(); this.toggleMax(id); };

    // Focus on click
    el.onmousedown = () => this.focus(id);

    // Drag
    let drag = false, sx, sy, ox, oy;
    const startDrag = (cx, cy) => {
      if (this.windows.get(id)?.maximized) return;
      drag = true; sx = cx; sy = cy;
      ox = el.offsetLeft; oy = el.offsetTop;
      this.focus(id);
    };
    const moveDrag = (cx, cy) => {
      if (!drag) return;
      let nx = ox + cx - sx, ny = oy + cy - sy;
      ny = Math.max(0, Math.min(window.innerHeight - 48, ny));
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
    };
    const endDrag = () => { drag = false; };

    titlebar.onmousedown = (e) => { if (e.target.closest('.win-controls')) return; startDrag(e.clientX, e.clientY); };
    document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', endDrag);
    titlebar.ontouchstart = (e) => { if (e.target.closest('.win-controls')) return; const t = e.touches[0]; startDrag(t.clientX, t.clientY); };
    document.addEventListener('touchmove', (e) => { if (!drag) return; const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }, { passive: true });
    document.addEventListener('touchend', endDrag);

    // Resize
    let resizing = false, rsx, rsy, rw, rh;
    const startResize = (cx, cy) => {
      if (this.windows.get(id)?.maximized) return;
      resizing = true;
      rsx = cx; rsy = cy; rw = el.offsetWidth; rh = el.offsetHeight;
      this.focus(id);
    };
    const moveResize = (cx, cy) => {
      if (!resizing) return;
      el.style.width = Math.max(320, rw + cx - rsx) + 'px';
      el.style.height = Math.max(200, rh + cy - rsy) + 'px';
    };
    const endResize = () => { resizing = false; };

    resizeHandle.onmousedown = (e) => { e.stopPropagation(); startResize(e.clientX, e.clientY); };
    document.addEventListener('mousemove', (e) => moveResize(e.clientX, e.clientY));
    document.addEventListener('mouseup', endResize);
    resizeHandle.ontouchstart = (e) => { e.stopPropagation(); const t = e.touches[0]; startResize(t.clientX, t.clientY); };
    document.addEventListener('touchmove', (e) => { if (!resizing) return; const t = e.touches[0]; moveResize(t.clientX, t.clientY); }, { passive: true });
    document.addEventListener('touchend', endResize);

    // Double-click titlebar to maximize
    titlebar.ondblclick = (e) => { if (!e.target.closest('.win-controls')) this.toggleMax(id); };
  }

  _updateTaskbar(){
    if (this.onTaskbarUpdate) this.onTaskbarUpdate(this.getOpenIds().map(id => {
      const w = this.windows.get(id);
      return { id, title: w.title, icon: w.icon, focused: w.el.style.zIndex == this.zTop, minimized: w.minimized };
    }));
  }
}
