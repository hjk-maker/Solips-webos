/* ── FILE ASSOCIATIONS ──
   Maps a file extension to the app id that should open it. Ships with sane
   defaults for common text formats; anything unrecognized falls back to the
   Editor as plain text rather than refusing to open. Custom associations
   (e.g. teaching it that .py belongs to some future Python app) persist in
   localStorage and can be set from Settings or by the AI.
*/
class FileAssociations {
  constructor(){
    this.defaults = {
      txt:'editor', md:'editor', json:'editor', js:'editor', ts:'editor',
      css:'editor', html:'editor', htm:'editor', xml:'editor', yml:'editor',
      yaml:'editor', csv:'editor', log:'editor', sh:'editor', py:'editor'
    };
    this.custom = {};
    this._load();
  }
  _load(){
    try { this.custom = JSON.parse(localStorage.getItem('os-file-assoc') || '{}'); }
    catch(e){ this.custom = {}; }
  }
  _save(){ localStorage.setItem('os-file-assoc', JSON.stringify(this.custom)); }

  extOf(path){
    const clean = path.endsWith('/') ? path.slice(0, -1) : path;
    const m = clean.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : '';
  }

  // Which app should open this path? Always returns something usable —
  // unknown extensions default to the Editor as plain text instead of failing.
  appFor(path){
    const ext = this.extOf(path);
    if (!ext) return 'editor';
    return this.custom[ext] || this.defaults[ext] || 'editor';
  }

  set(ext, appId){
    ext = ext.replace(/^\./, '').toLowerCase();
    this.custom[ext] = appId;
    this._save();
  }

  unset(ext){
    delete this.custom[ext.replace(/^\./, '').toLowerCase()];
    this._save();
  }

  list(){
    const merged = { ...this.defaults, ...this.custom };
    return Object.entries(merged).map(([ext, appId]) => ({ ext, appId, custom: ext in this.custom }));
  }
}
