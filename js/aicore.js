/* ── AI CORE — The kernel brain ──
   Each provider has a `type` that determines its request/response shape:
   - 'ollama'    : Ollama's native /api/chat format
   - 'openai'    : OpenAI-compatible chat/completions (covers OpenAI, Groq, LM Studio, most local servers)
   - 'anthropic' : Anthropic Messages API (x-api-key header, different body shape)
   - 'gemini'    : Google Generative Language API (key as query param, contents[] shape)
*/
class AICore {
  constructor(){
    this.providers = {
      ollama:    { name:'Ollama (Local)',    endpoint:'http://localhost:11434', chat:'/api/chat', models:'/api/tags', type:'ollama', model:'llama3.2' },
      lmstudio:  { name:'LM Studio (Local)', endpoint:'http://localhost:1234', chat:'/v1/chat/completions', models:'/v1/models', type:'openai', model:'local-model' },
      openai:    { name:'OpenAI',   endpoint:'https://api.openai.com', chat:'/v1/chat/completions', models:'/v1/models', type:'openai', model:'gpt-4o-mini', key:'' },
      anthropic: { name:'Anthropic', endpoint:'https://api.anthropic.com', chat:'/v1/messages', models:null, type:'anthropic', model:'claude-sonnet-4-5', key:'' },
      gemini:    { name:'Google Gemini', endpoint:'https://generativelanguage.googleapis.com', chat:'/v1beta/models/{model}:generateContent', models:'/v1beta/models', type:'gemini', model:'gemini-2.0-flash', key:'' },
      groq:      { name:'Groq',    endpoint:'https://api.groq.com/openai', chat:'/v1/chat/completions', models:'/v1/models', type:'openai', model:'llama-3.3-70b-versatile', key:'' }
    };
    this.active = null;
    this.history = [];
    this._load();
  }
  _load(){
    try {
      const c = JSON.parse(localStorage.getItem('os-ai') || '{}');
      if (c.active && this.providers[c.active]) this.active = c.active;
      for (const [k,v] of Object.entries(c.providers || {})){
        if (this.providers[k]) Object.assign(this.providers[k], v);
      }
    } catch(e){}
  }
  _save(){
    const c = { active: this.active, providers: {} };
    for (const [k,v] of Object.entries(this.providers)){
      c.providers[k] = { endpoint: v.endpoint, model: v.model, key: v.key || '' };
    }
    localStorage.setItem('os-ai', JSON.stringify(c));
  }
  configure(id, opts){ Object.assign(this.providers[id], opts); this._save(); }
  setActive(id){ if (this.providers[id]) { this.active = id; this._save(); } }
  getP(){ return this.active ? this.providers[this.active] : null; }
  listProviders(){ return Object.entries(this.providers).map(([id,p])=>({ id, ...p, active: id===this.active })); }

  // Builds the right auth headers per provider type. Anthropic and Gemini
  // don't use a plain Bearer token like OpenAI-compatible APIs do.
  _headers(p, extra = {}){
    const h = { 'Content-Type':'application/json', ...extra };
    if (p.type === 'anthropic'){
      if (p.key) h['x-api-key'] = p.key;
      h['anthropic-version'] = '2023-06-01';
    } else if (p.type !== 'gemini' && p.key){
      h['Authorization'] = `Bearer ${p.key}`;
    }
    return h;
  }

  async ping(){
    const p = this.getP(); if (!p) return false;
    try {
      if (p.type === 'anthropic'){
        const r = await fetch(p.endpoint + p.chat, {
          method:'POST', headers:this._headers(p),
          body: JSON.stringify({ model:p.model, max_tokens:1, messages:[{role:'user',content:'hi'}] }),
          signal: AbortSignal.timeout(4000)
        });
        return r.status !== 401 && r.status !== 403;
      }
      if (!p.models) return true;
      let url = p.endpoint + p.models;
      if (p.type === 'gemini') url += `?key=${p.key||''}`;
      const r = await fetch(url, { headers: this._headers(p), signal: AbortSignal.timeout(3000) });
      return r.ok;
    } catch{ return false; }
  }

  async getModels(){
    const p = this.getP(); if (!p || !p.models) return p?.model ? [p.model] : [];
    let url = p.endpoint + p.models;
    if (p.type === 'gemini') url += `?key=${p.key||''}`;
    const r = await fetch(url, { headers: this._headers(p) });
    const d = await r.json();
    if (p.type === 'ollama') return (d.models||[]).map(m=>m.name);
    if (p.type === 'gemini') return (d.models||[]).map(m=>m.name.replace('models/',''));
    return (d.data||[]).map(m=>m.id);
  }

  async chat(message, tools = false){
    const p = this.getP(); if (!p) throw new Error('No AI provider configured. Open Settings > AI.');
    this.history.push({ role:'user', content: message });

    let url = p.endpoint + p.chat;
    let body;
    const h = this._headers(p);

    if (p.type === 'ollama'){
      body = { model: p.model, messages: this.history, stream: false };
      if (tools) body.system = this._systemPrompt();
    } else if (p.type === 'anthropic'){
      body = { model: p.model, max_tokens: 1024, messages: this.history.map(m => ({ role: m.role, content: m.content })) };
      if (tools) body.system = this._systemPrompt();
    } else if (p.type === 'gemini'){
      url = url.replace('{model}', p.model) + `?key=${p.key||''}`;
      body = {
        contents: this.history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      };
      if (tools) body.systemInstruction = { parts: [{ text: this._systemPrompt() }] };
    } else {
      // openai-compatible (OpenAI, Groq, LM Studio, etc.)
      body = { model: p.model, messages: this.history, stream: false, temperature: 0.7 };
      if (tools) body.messages = [{ role:'system', content: this._systemPrompt() }, ...this.history];
    }

    const r = await fetch(url, { method:'POST', headers:h, body:JSON.stringify(body) });
    if (!r.ok) { const t = await r.text(); throw new Error(`LLM ${r.status}: ${t.slice(0,200)}`); }
    const d = await r.json();

    let reply;
    if (p.type === 'ollama') reply = d.message?.content;
    else if (p.type === 'anthropic') reply = (d.content||[]).map(c => c.text).join('');
    else if (p.type === 'gemini') reply = d.candidates?.[0]?.content?.parts?.map(pt=>pt.text).join('');
    else reply = d.choices?.[0]?.message?.content;

    this.history.push({ role:'assistant', content: reply });
    return reply;
  }

  _systemPrompt(){
    return `You are the AI kernel of ${OS_NAME} — a web-based operating system. You have DIRECT CONTROL over the system.

AVAILABLE TOOLS — use them by responding with exactly this format:
[TOOL: tool_name]
{"param1": "value1"}
[/TOOL]

You can use multiple tools in one response.

TOOLS:
- fs_write: Write to a file. Params: {"path": "/path/file.txt", "content": "file content"}
- fs_read: Read a file. Params: {"path": "/path/file.txt"}
- fs_list: List files. Params: {}
- fs_delete: Delete a file. Params: {"path": "/path/file.txt"}
- app_open: Open a built-in or registered app by id, optionally loading a file into it (Editor and Browser both support this; other apps just open normally and ignore it). Params: {"id": "terminal|files|editor|settings|browser|monitor|<custom-app-id>", "filePath": "/optional/path.txt"}
- app_register: Register a new app that loads a URL in a window (e.g. a web-based tool like vscode.dev). Params: {"id": "vscode", "name": "VS Code", "url": "https://vscode.dev", "icon": "editor"}
- app_list: List all available apps, built-in and custom. Params: {}
- notify: Show a desktop notification toast. Params: {"title": "...", "message": "...", "type": "info|ok|warn|error"}
- cursor_move: Move the visible AI cursor to a screen position. Params: {"x": 300, "y": 200}
- cursor_click: Click whatever is currently under the AI cursor. Params: {}
- keyboard_type: Type text into whatever text field is currently focused. Params: {"text": "..."}
- keyboard_enter: Press Enter in the currently focused field. Params: {}
- sys_info: Get system info. Params: {}

Note on cursor_move/cursor_click/keyboard_type: these only work inside ${OS_NAME}'s
own windows (Terminal, Files, Editor, Settings) — they cannot reach into a
cross-origin iframe app like the Browser or a website added as an app, and
they cannot move the visitor's actual OS-level mouse. Use app_open + these
tools together, e.g. open the Editor, click into its textarea, then type.

RULES:
- When the user asks you to DO something (create a file, open an app, etc.), USE the tools.
- After using tools, briefly describe what you did.
- For questions that don't need tools, answer normally without [TOOL] blocks.
- Be concise and helpful.`;
  }

  parseTools(text){
    const tools = [];
    const rx = /\[TOOL:\s*(\w+)\]\s*([\s\S]*?)\[\/TOOL\]/g;
    let m;
    while ((m = rx.exec(text)) !== null){
      try { tools.push({ name: m[1], params: JSON.parse(m[2]) }); } catch(e){}
    }
    return tools;
  }

  clearHistory(){ this.history = []; }
}
