/* ── FILE SYSTEM (IndexedDB, with in-memory fallback) ──
   Some hosting contexts block IndexedDB entirely (sandboxed preview iframes,
   Safari private browsing, some embedded webviews). Previously, if fs.open()
   rejected, the whole boot() sequence threw and NOTHING rendered — every
   panel/app appeared broken because the desktop never showed at all.
   Now: if IndexedDB fails, we transparently fall back to an in-memory Map
   with the exact same API. Files won't survive a refresh in that fallback
   mode, but the OS boots and every app actually works.
*/
class FileSystem {
  constructor(){ this.db = null; this.memory = null; }

  async open(){
    try {
      await new Promise((res, rej) => {
        const r = indexedDB.open('os-fs', 1);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains('files'))
            r.result.createObjectStore('files', { keyPath: 'path' });
        };
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = () => rej(r.error);
      });
    } catch(e){
      console.warn('IndexedDB unavailable, falling back to in-memory file system:', e);
      this.memory = new Map();
    }
  }

  get usingFallback(){ return !this.db; }

  _tx(mode, fn){
    return new Promise((res, rej) => {
      const t = this.db.transaction('files', mode);
      const r = fn(t.objectStore('files'));
      t.oncomplete = () => res(r);
      t.onerror = () => rej(t.error);
    });
  }

  async write(path, content, meta = {}){
    const record = { path, content, modified: Date.now(), size: (content||'').length, ...meta };
    if (this.memory){ this.memory.set(path, record); return; }
    await this._tx('readwrite', s => s.put(record));
  }

  async read(path){
    if (this.memory) return this.memory.get(path) || null;
    return this._tx('readonly', s => s.get(path));
  }

  async del(path){
    // Deleting a folder (trailing "/") removes it and everything nested under it.
    const isDir = path.endsWith('/');
    if (this.memory){
      if (isDir){ for (const k of [...this.memory.keys()]) if (k === path || k.startsWith(path)) this.memory.delete(k); }
      else this.memory.delete(path);
      return;
    }
    if (isDir){
      const all = await this.list(path);
      await this._tx('readwrite', s => { all.forEach(f => s.delete(f.path)); s.delete(path); });
    } else {
      await this._tx('readwrite', s => s.delete(path));
    }
  }

  async list(prefix = ''){
    if (this.memory) return [...this.memory.values()].filter(f => f.path.startsWith(prefix));
    return this._tx('readonly', s => new Promise((res, rej) => {
      const out = [];
      const cur = s.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return res(out);
        if (c.key.startsWith(prefix)) out.push(c.value);
        c.continue();
      };
      cur.onerror = () => rej(cur.error);
    }));
  }
}
