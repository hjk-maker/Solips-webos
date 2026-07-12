/* ── NOTIFICATIONS ── */
class NotificationCenter {
  constructor(){
    this.container = document.createElement('div');
    this.container.id = 'notif-container';
    this.container.style.cssText = 'position:fixed;bottom:56px;right:12px;z-index:9998;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:300px';
    document.body.appendChild(this.container);
    this.log = [];
  }
  push(title, message = '', type = 'info'){
    const colors = { info:'var(--ac)', warn:'var(--yel)', error:'var(--red)', ok:'var(--ac)' };
    const el = document.createElement('div');
    el.style.cssText = `pointer-events:auto;background:var(--glass);backdrop-filter:blur(20px);border:1px solid var(--border);border-left:3px solid ${colors[type]||colors.info};border-radius:8px;box-shadow:var(--shadow);padding:10px 12px;animation:notifIn .2s ease;font-family:system-ui,sans-serif`;
    el.innerHTML = `<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:${message?'3px':'0'}">${esc(title)}</div>${message ? `<div style="font-size:11px;color:var(--tx2);line-height:1.4">${esc(message)}</div>` : ''}`;
    this.container.appendChild(el);
    this.log.unshift({ title, message, type, time: Date.now() });
    if (this.log.length > 50) this.log.pop();
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 300);
    }, 4500);
    return el;
  }
}

// Injected once so CSS doesn't need a build step
(function injectNotifStyle(){
  const s = document.createElement('style');
  s.textContent = '@keyframes notifIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}';
  document.head.appendChild(s);
})();
