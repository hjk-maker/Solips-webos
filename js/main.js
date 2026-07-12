/* ── BOOT SEQUENCE ── */
(async function boot(){
  // Everything visible derives from OS_NAME (js/config.js) rather than the
  // static text already in index.html — this is what makes a rename later
  // a one-line change instead of a find-and-replace across the project.
  document.title = OS_NAME;
  document.querySelector('.boot-title')?.replaceChildren(document.createTextNode(OS_NAME.toUpperCase()));
  document.querySelector('#tb-start span')?.replaceChildren(document.createTextNode(OS_NAME.toUpperCase()));
  document.getElementById('sm-about')?.replaceChildren(document.createTextNode(`About ${OS_NAME}`));

  const fill = document.getElementById('boot-fill');
  const status = document.getElementById('boot-status');

  const step = async (msg, pct) => { status.textContent = msg; fill.style.width = pct + '%'; await new Promise(r => setTimeout(r, 300)); };

  try {
    await step('Initializing file system...', 15);
    const fs = new FileSystem();
    await fs.open();

    await step('Loading AI core...', 35);
    const ai = new AICore();

    await step('Starting network bridge...', 50);
    const net = new NetworkBridge();
    if (ai.getP()) net.announce(ai.getP().endpoint);

    const notifs = new NotificationCenter();
    window.OS = { notify: (title, message, type) => notifs.push(title, message, type) };

    const registry = new AppRegistry();
    const fileAssoc = new FileAssociations();
    const cursor = new VirtualCursor();
    const store = new AppStore();
    const integrations = new Integrations(fs);
    await integrations.load(); // no-op if /system/integrations.json doesn't exist

    // Handle incoming LLM shares from other tabs
    net.onLLMShare = (endpoint, model, peerId) => {
      const customId = 'shared-' + peerId.slice(0,8);
      if (!ai.providers[customId]){
        ai.providers[customId] = { name:`Shared: ${model}`, endpoint, chat:'/v1/chat/completions', models:'/v1/models', type:'openai', model };
      }
    };

    await step('Preparing applications...', 70);

    // Create app instances
    let editorContainer = null;
    const editorApp = makeEditorApp(fs);
    const terminalApp = makeTerminalApp(fs, ai);
    const filesApp = makeFilesApp(fs, (path) => {
      const targetApp = fileAssoc.appFor(path);
      window._OS.openApp(targetApp);
      if (targetApp === 'editor'){
        setTimeout(() => {
          if (editorContainer && editorContainer._openFile) editorContainer._openFile(path);
        }, 100);
      }
    });
    const settingsApp = makeSettingsApp(ai, net);
    const browserApp = makeBrowserApp();
    const monitorApp = makeMonitorApp(fs, ai);
    const storeApp = makeStoreApp(store);

    // appDefs is mutable at runtime: registerApp()/unregisterApp() below push
    // and splice directly into this array, and re-render icons + start menu.
    const appDefs = [
      { id:'terminal', ...terminalApp },
      { id:'files', ...filesApp },
      { id:'editor', ...editorApp },
      { id:'settings', ...settingsApp },
      { id:'browser', ...browserApp },
      { id:'monitor', ...monitorApp },
      { id:'store', ...storeApp }
    ];
    // Load any custom (iframe) apps saved from a previous session
    registry.list().forEach(def => appDefs.push(registry.makeRunnable(def)));

    await step('Booting desktop...', 90);

    // ── DESKTOP ICONS ──
    // Rebuilt any time an app is registered/unregistered, not just at boot.
    const iconsEl = document.getElementById('icons');
    function renderIcons(){
      iconsEl.innerHTML = '';
      appDefs.forEach(app => {
        const div = document.createElement('div');
        div.className = 'dicon';
        div.innerHTML = `<div class="dicon-svg">${app.icon}</div><span>${app.name}</span>`;
        // Single click/tap opens the app — no need to hunt through the Start Menu,
        // and this matches touch/mobile expectations where double-tap is unreliable.
        div.onclick = () => window._OS.openApp(app.id);
        // Right-click: built-in apps just get an "Open" shortcut; custom
        // (website/iframe) apps also get a direct "Remove App" — no need to
        // go digging through Settings just to delete something you added.
        div.oncontextmenu = (e) => {
          e.preventDefault(); e.stopPropagation();
          const menu = document.getElementById('ctx-menu');
          const canRemove = app.type === 'iframe';
          menu.innerHTML = `
            <div class="ctx-item" data-act="openApp">Open</div>
            ${canRemove ? `<div class="ctx-sep"></div><div class="ctx-item" data-act="removeApp" style="color:var(--red)">Remove App</div>` : ''}`;
          menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
          menu.style.top = Math.min(e.clientY, window.innerHeight - 120) + 'px';
          menu.classList.add('show');
          menu.querySelector('[data-act="openApp"]').onclick = () => { menu.classList.remove('show'); window._OS.openApp(app.id); };
          const removeBtn = menu.querySelector('[data-act="removeApp"]');
          if (removeBtn) removeBtn.onclick = () => {
            menu.classList.remove('show');
            if (confirm(`Remove "${app.name}" from ${OS_NAME}?`)) window._OS.unregisterApp(app.id);
          };
        };
        iconsEl.appendChild(div);
      });
    }
    renderIcons();

    // ── WINDOW MANAGER ──
    const taskbarApps = document.getElementById('tb-apps');
    const updateTaskbar = (wins) => {
      taskbarApps.innerHTML = wins.map(w => `<div class="tb-app${w.focused && !w.minimized ? ' active' : ''}" data-win="${w.id}">${w.icon || ''}<span>${w.title}</span></div>`).join('');
      taskbarApps.querySelectorAll('.tb-app').forEach(el => {
        el.onclick = () => {
          const id = el.dataset.win;
          const win = window._OS._wm.windows.get(id);
          if (!win) return;
          if (win.minimized) window._OS._wm.restore(id);
          else window._OS._wm.focus(id);
        };
      });
    };
    const wm = new WindowManager(document.getElementById('workspace'), updateTaskbar);

    // Global openApp + the single shared tool executor used by the terminal's
    // `ai` command, and by any future entry point that wants the AI to act on
    // the OS (open apps, register new ones, touch files, post notifications).
    window._OS = {
      _wm: wm,
      fileAssoc,
      cursor,
      store,
      openApp(id) {
        const app = appDefs.find(a => a.id === id);
        if (!app) { notifs.push('No such app', id, 'error'); return; }
        wm.create({
          id: app.id,
          title: app.name,
          icon: app.icon,
          width: id === 'terminal' ? 720 : id === 'browser' ? 900 : 680,
          height: id === 'terminal' ? 480 : id === 'browser' ? 600 : 460,
          content: (body, winObj) => {
            const result = app.init(body, winObj);
            if (id === 'editor') editorContainer = body;
            return result;
          }
        });
      },
      listApps: () => appDefs.map(a => ({ id: a.id, name: a.name, type: a.type || 'native' })),

      registerApp({ id, name, url, icon }){
        const def = registry.register({ id, name, url, icon });
        const runnable = registry.makeRunnable(def);
        const existingIdx = appDefs.findIndex(a => a.id === def.id);
        if (existingIdx >= 0) appDefs[existingIdx] = runnable;
        else appDefs.push(runnable);
        renderIcons();
        renderStartMenu();
        notifs.push('App registered', `${name} added to desktop`, 'ok');
        return def;
      },

      unregisterApp(id){
        registry.unregister(id);
        const idx = appDefs.findIndex(a => a.id === id);
        if (idx >= 0) appDefs.splice(idx, 1);
        renderIcons();
        renderStartMenu();
      },

      async executeTool(name, params){
        switch(name){
          case 'fs_write': await fs.write(params.path, params.content); return 'ok';
          case 'fs_read': return (await fs.read(params.path))?.content || null;
          case 'fs_list': return (await fs.list('')).map(f => f.path);
          case 'fs_delete': await fs.del(params.path); return 'ok';
          case 'app_open': window._OS.openApp(params.id); return 'opened';
          case 'app_list': return window._OS.listApps();
          case 'app_register': return window._OS.registerApp(params);
          case 'notify': notifs.push(params.title || 'Notification', params.message || '', params.type || 'info'); return 'ok';
          case 'cursor_move': await cursor.moveTo(params.x, params.y); return 'ok';
          case 'cursor_click': return cursor.click();
          case 'keyboard_type': return cursor.type(params.text || '');
          case 'keyboard_enter': return cursor.pressEnter();
          case 'sys_info': return getSysInfo();
          default: return `Unknown tool: ${name}`;
        }
      }
    };

    // ── START MENU ──
    const startMenu = document.getElementById('start-menu');
    const smList = document.getElementById('sm-list');
    const smSearch = document.getElementById('sm-search-input');

    function renderStartMenu(filter = ''){
      smList.innerHTML = appDefs
        .filter(a => !filter || a.name.toLowerCase().includes(filter.toLowerCase()))
        .map(a => `<div class="sm-item" data-id="${a.id}">${a.icon}<span>${a.name}</span></div>`)
        .join('');
      smList.querySelectorAll('.sm-item').forEach(el => {
        el.onclick = () => { window._OS.openApp(el.dataset.id); startMenu.classList.remove('show'); };
      });
    }
    renderStartMenu();
    smSearch.oninput = () => renderStartMenu(smSearch.value);

    document.getElementById('tb-start').onclick = (e) => { e.stopPropagation(); startMenu.classList.toggle('show'); };
    document.getElementById('sm-about').onclick = () => { window._OS.openApp('settings'); startMenu.classList.remove('show'); };
    document.getElementById('sm-refresh').onclick = () => { startMenu.classList.remove('show'); };
    document.addEventListener('click', (e) => { if (!startMenu.contains(e.target) && !document.getElementById('tb-start').contains(e.target)) startMenu.classList.remove('show'); });

    // ── CONTEXT MENU ──
    const ctxMenu = document.getElementById('ctx-menu');
    document.getElementById('desktop').addEventListener('contextmenu', (e) => {
      if (e.target.closest('.win') || e.target.closest('#taskbar') || e.target.closest('#start-menu')) return;
      e.preventDefault();
      ctxMenu.innerHTML = `
        <div class="ctx-item" data-act="newFile">New File</div>
        <div class="ctx-item" data-act="newFolder">New Folder</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" data-act="openTerm">Open Terminal</div>
        <div class="ctx-item" data-act="openFiles">Open Files</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" data-act="settings">Settings</div>
        <div class="ctx-item" data-act="about">About ${OS_NAME}</div>`;
      ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
      ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - 250) + 'px';
      ctxMenu.classList.add('show');
    });
    document.addEventListener('click', () => ctxMenu.classList.remove('show'));
    ctxMenu.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (!act) return;
      ctxMenu.classList.remove('show');
      switch(act){
        case 'newFile': { const n = prompt('File name:', '/untitled.txt'); if (n){ fs.write(n, ''); window._OS.openApp('editor'); } break; }
        case 'newFolder': { const n = prompt('Folder name:', '/new-folder'); if (n) fs.write(n + '/', ''); break; }
        case 'openTerm': window._OS.openApp('terminal'); break;
        case 'openFiles': window._OS.openApp('files'); break;
        case 'settings': window._OS.openApp('settings'); break;
        case 'about': window._OS.openApp('settings'); break;
      }
    });

    // ── CLOCK ──
    const clock = document.getElementById('tb-clock');
    function updateClock(){ clock.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }
    updateClock(); setInterval(updateClock, 10000);

    // ── AI STATUS DOT ──
    const aiDot = document.getElementById('ai-dot');
    async function updateAIStatus(){
      try { const ok = await ai.ping(); aiDot.classList.toggle('on', ok); aiDot.title = ok ? 'AI Connected' : 'AI Disconnected'; }
      catch{ aiDot.classList.remove('on'); aiDot.title = 'AI Disconnected'; }
    }
    updateAIStatus(); setInterval(updateAIStatus, 15000);

    // ── FINISH BOOT ──
    await step('Ready.', 100);
    await new Promise(r => setTimeout(r, 400));

    document.getElementById('boot').classList.add('done');
    document.getElementById('desktop').style.display = 'block';
    setTimeout(() => document.getElementById('boot').style.display = 'none', 600);

    if (fs.usingFallback){
      notifs.push('Running in memory-only mode', 'IndexedDB isn\'t available here (sandboxed preview or private browsing) — files won\'t survive a refresh until you open this on a normal page.', 'warn');
    }

    // Handle hash-based LLM sharing (cross-device)
    if (location.hash.startsWith('#llm=')){
      try {
        const params = new URLSearchParams(location.hash.slice(1));
        const endpoint = params.get('llm');
        const model = params.get('model') || 'default';
        if (endpoint){
          const customId = 'shared-link';
          ai.providers[customId] = { name:`Shared: ${model}`, endpoint, chat:'/v1/chat/completions', models:'/v1/models', type:'openai', model };
          ai.setActive(customId);
          history.replaceState(null, '', location.pathname);
        }
      } catch(e){}
    }

    // Announce periodically
    setInterval(() => { if (ai.getP()) net.announce(ai.getP().endpoint); }, 30000);

  } catch(err){
    status.textContent = 'Boot failed: ' + err.message;
    console.error(err);
  }
})();
