/* ── VIRTUAL CURSOR + KEYBOARD ──
   Gives the AI a way to actually act inside Nimbo: move a visible cursor,
   click whatever is under it, and type into whatever's focused.

   Important scope limits, stated plainly:
   - This cursor only exists inside the Nimbo page. It cannot move the
     visitor's real OS mouse, and it cannot reach into other browser tabs.
   - It CAN click and type inside Nimbo's own windows (Terminal, Files,
     Editor, Settings) because those are all same-origin DOM the page owns.
   - It CANNOT reach inside an iframe-based app (Browser, or any custom
     "website as app") if that iframe is cross-origin — that's the browser's
     own sandboxing, not a limitation we can code around. Same-origin iframes
     (e.g. something served from your own domain) DO work.
*/
class VirtualCursor {
  constructor(){
    this.el = document.createElement('div');
    this.el.id = 'ai-cursor';
    this.el.style.cssText = `
      position:fixed;top:0;left:0;width:18px;height:18px;pointer-events:none;
      z-index:99999;transform:translate(-2px,-2px);transition:transform .12s ease;
      display:none;
    `;
    this.el.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M1 1L1 14L4.5 11L6.8 16L9 15L6.7 10L11 10Z" fill="#c4a0ff" stroke="#0a0a0f" stroke-width="1"/>
    </svg>`;
    document.body.appendChild(this.el);
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
  }

  show(){ this.el.style.display = 'block'; }
  hide(){ this.el.style.display = 'none'; }

  async moveTo(x, y){
    this.show();
    this.x = x; this.y = y;
    this.el.style.transform = `translate(${x}px, ${y}px)`;
    await new Promise(r => setTimeout(r, 150)); // let the CSS transition finish so actions feel visible, not instant
  }

  // Clicks whatever DOM element is currently under the cursor position.
  click(){
    const target = document.elementFromPoint(this.x, this.y);
    if (!target) return { ok: false, reason: 'nothing under cursor' };
    // Flash for visibility
    this.el.style.transform += ' scale(0.8)';
    setTimeout(() => { this.el.style.transform = `translate(${this.x}px, ${this.y}px)`; }, 100);
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: this.x, clientY: this.y }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: this.x, clientY: this.y }));
    target.click();
    return { ok: true, target: target.tagName + (target.id ? '#' + target.id : '') };
  }

  // Types into whatever's currently focused (an <input>/<textarea> the click()
  // above presumably focused). Dispatches real input events so app code that
  // listens for 'input' (the Editor, Terminal, etc.) sees the change.
  type(text){
    const el = document.activeElement;
    if (!el || !('value' in el)) return { ok: false, reason: 'no focused text field' };
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
                 || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, el.value + text); else el.value += text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true };
  }

  pressEnter(){
    const el = document.activeElement;
    if (!el) return { ok: false };
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    return { ok: true };
  }
}
