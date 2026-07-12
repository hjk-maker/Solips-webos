/* ── APP REGISTRY ──
   Two kinds of apps:
   1. "native" — built-in JS apps (terminal, files, editor, settings, browser, monitor)
   2. "iframe" — any external web app loaded in a sandboxed <iframe>, registered by
      the user (or the AI, via the app_register tool) with just a name + URL.
      This is how you'd add something like vscode.dev, excalidraw.com, etc. as
      first-class Nimbo apps without writing any code.

   Persisted to localStorage so custom apps survive refresh.
*/
class AppRegistry {
  constructor(){
    this.customApps = [];
    this._load();
  }
  _load(){
    try { this.customApps = JSON.parse(localStorage.getItem('os-custom-apps') || '[]'); }
    catch(e){ this.customApps = []; }
  }
  _save(){
    localStorage.setItem('os-custom-apps', JSON.stringify(this.customApps));
  }
  list(){ return [...this.customApps]; }

  register({ id, name, url, icon }){
    if (!id || !name || !url) throw new Error('register requires id, name, and url');
    id = id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const existing = this.customApps.findIndex(a => a.id === id);
    const def = { id, name, url, icon: icon || 'browser', type: 'iframe' };
    if (existing >= 0) this.customApps[existing] = def;
    else this.customApps.push(def);
    this._save();
    return def;
  }

  unregister(id){
    this.customApps = this.customApps.filter(a => a.id !== id);
    this._save();
  }

  // Builds a runnable app object compatible with appDefs, for a given custom app def.
  // `icon` can be either a keyword from the ICO library, or a full image URL
  // (e.g. a favicon) — rendered as an <img> in that case.
  //
  // Some sites refuse to be embedded at all (X-Frame-Options / CSP frame-ancestors —
  // e.g. chat.qwen.ai, most Google properties). That's the target site's own
  // security header, not something fixable from inside the iframe's parent page,
  // and there's no fully reliable way to detect the block from JS across browsers.
  // So every framed app gets a persistent "open in new tab" escape hatch rather
  // than silently failing with nothing the user can do about it.
  makeRunnable(def){
    const iconHtml = /^https?:\/\//.test(def.icon || '')
      ? `<img src="${esc(def.icon)}" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display='none'">`
      : (ICO[def.icon] || ICO.browser);
    return {
      id: def.id,
      name: def.name,
      icon: iconHtml,
      type: 'iframe',
      init(container){
        container.style.position = 'relative';
        container.innerHTML = `
          <iframe src="${esc(def.url)}" style="width:100%;height:100%;border:none;background:#fff" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe>
          <a href="${esc(def.url)}" target="_blank" rel="noopener" title="Open in new tab — some sites block being embedded and this is the only way in"
             style="position:absolute;top:8px;right:8px;background:rgba(10,10,15,.85);color:#00d4aa;font-size:11px;padding:5px 9px;border-radius:6px;text-decoration:none;font-family:system-ui,sans-serif;border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px)">Open in new tab ↗</a>`;
      }
    };
  }

  // Best-effort "add this website as an app": we can't read a cross-origin
  // page's <title> from client-side JS (that's blocked by CORS same as any
  // other cross-origin fetch), so the name defaults to the domain name and
  // stays editable. The favicon, however, loads fine as a plain <img src>
  // via Google's public favicon service — images aren't subject to the same
  // CORS restriction fetch() is.
  static detectFromUrl(rawUrl){
    let url;
    try { url = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl); }
    catch(e){ throw new Error('That doesn\'t look like a valid URL'); }
    const host = url.hostname.replace(/^www\./, '');
    return {
      id: host.split('.')[0],
      name: host,
      url: url.href,
      icon: `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`
    };
  }

  // ── .aeapp PACKAGE FILES ──
  // A .aeapp file is just JSON: {"id","name","url","icon"}. Any app added
  // through Settings or the AI can be exported to one of these and dropped
  // anywhere in the file system; double-clicking it in Files installs it
  // (registers it as a real desktop app) and opens it immediately. This is
  // the whole mechanism an app store would later build on: a package is
  // just a small file, install is just "read it and register()".
  exportPackage(id){
    const def = this.customApps.find(a => a.id === id);
    if (!def) throw new Error(`No custom app "${id}" to export`);
    return JSON.stringify(def, null, 2);
  }

  installFromJson(jsonText){
    let def;
    try { def = JSON.parse(jsonText); }
    catch(e){ throw new Error('Not a valid .aeapp package (bad JSON)'); }
    if (!def.id || !def.name || !def.url) throw new Error('.aeapp package is missing id, name, or url');
    return this.register(def);
  }
}
