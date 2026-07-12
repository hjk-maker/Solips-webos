/* ── INTEGRATIONS (optional, independent) ──
   For future hooks like a browser-based AI agent. This file makes no
   assumption that such a thing exists yet: it looks for a config file at
   /system/integrations.json in the Nimbo file system, and only acts on
   it if found and well-formed. If the file isn't there, this does nothing
   at all — the rest of the OS never depends on it.

   Expected shape, once something writes this file:
   {
     "browserAgent": { "enabled": true, "endpoint": "https://..." }
   }
*/
class Integrations {
  constructor(fs){ this.fs = fs; this.config = null; }

  async load(){
    try {
      const f = await this.fs.read('/system/integrations.json');
      if (!f || !f.content) return null;
      this.config = JSON.parse(f.content);
      return this.config;
    } catch(e){
      // No file, bad JSON, or fs error — all treated the same: not configured.
      return null;
    }
  }

  get(name){ return this.config?.[name] || null; }
}
