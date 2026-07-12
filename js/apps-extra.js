/* ── APP DEFINITIONS: Settings, Browser, System Monitor ── */

function makeSettingsApp(ai, net){
  return {
    name: 'Settings', icon: ICO.settings,
    init(container){
      container.innerHTML = `<div class="settings-app">
        <div class="set-side">
          <div class="set-side-item active" data-tab="ai">AI / LLM</div>
          <div class="set-side-item" data-tab="apps">Apps</div>
          <div class="set-side-item" data-tab="filetypes">File Types</div>
          <div class="set-side-item" data-tab="network">Network</div>
          <div class="set-side-item" data-tab="system">System</div>
          <div class="set-side-item" data-tab="about">About</div>
        </div>
        <div class="set-content" id="setC"></div>
      </div>`;

      const content = container.querySelector('#setC');
      container.querySelectorAll('.set-side-item').forEach(item => {
        item.onclick = () => {
          container.querySelectorAll('.set-side-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          showTab(item.dataset.tab);
        };
      });

      function showTab(tab){
        switch(tab){
          case 'ai': showAI(); break;
          case 'apps': showApps(); break;
          case 'filetypes': showFileTypes(); break;
          case 'network': showNetwork(); break;
          case 'system': showSystem(); break;
          case 'about': showAbout(); break;
        }
      }

      function showApps(){
        content.innerHTML = `<h2>Apps</h2>
          <h3>Add a Website as an App</h3>
          <div class="set-info">
            Paste a URL. We'll pull its favicon automatically and default the name to its
            domain (edit either before adding — we can't read a cross-origin page's actual
            title from here, only its icon).
          </div>
          <div class="set-row"><label>Website URL</label><input type="text" id="waUrl" placeholder="https://example.com"></div>
          <button class="set-btn sec" id="waDetect">Detect</button>
          <div id="waPreview" style="display:none;margin-top:12px">
            <div class="set-row"><label>App ID</label><input type="text" id="apId"></div>
            <div class="set-row"><label>Name</label><input type="text" id="apName"></div>
            <div class="set-row"><label>Icon preview</label><img id="waIconPreview" style="width:24px;height:24px"></div>
            <button class="set-btn" id="apAdd">Add App</button>
          </div>
          <h3>Installed Custom Apps</h3>
          <div id="apList"></div>`;

        let detected = null;

        content.querySelector('#waDetect').onclick = () => {
          try {
            detected = AppRegistry.detectFromUrl(content.querySelector('#waUrl').value.trim());
            content.querySelector('#apId').value = detected.id;
            content.querySelector('#apName').value = detected.name;
            content.querySelector('#waIconPreview').src = detected.icon;
            content.querySelector('#waPreview').style.display = '';
          } catch(e){ alert(e.message); }
        };

        function renderList(){
          const listEl = content.querySelector('#apList');
          const apps = window._OS.listApps().filter(a => a.type === 'iframe');
          if (!apps.length){ listEl.innerHTML = '<div class="set-info">No custom apps yet.</div>'; return; }
          listEl.innerHTML = apps.map(a => `
            <div class="set-provider">
              <div class="set-provider-head"><span>${esc(a.name)}</span><button class="set-btn sec" data-id="${a.id}" data-act="remove">Remove</button></div>
            </div>`).join('');
          listEl.querySelectorAll('[data-act="remove"]').forEach(b => b.onclick = () => { window._OS.unregisterApp(b.dataset.id); renderList(); });
        }
        renderList();

        content.querySelector('#apAdd').onclick = () => {
          if (!detected){ alert('Click Detect first.'); return; }
          const id = content.querySelector('#apId').value.trim();
          const name = content.querySelector('#apName').value.trim();
          if (!id || !name){ alert('App ID and Name are required.'); return; }
          window._OS.registerApp({ id, name, url: detected.url, icon: detected.icon });
          content.querySelector('#waUrl').value = '';
          content.querySelector('#waPreview').style.display = 'none';
          detected = null;
          renderList();
        };
      }

      function showFileTypes(){
        content.innerHTML = `<h2>File Types</h2>
          <div class="set-info">
            Controls which app opens a file when you double-click it in Files.
            Anything without a rule here still opens fine — it just falls back
            to the Editor as plain text.
          </div>
          <h3>Add / Override</h3>
          <div class="set-row"><label>Extension</label><input type="text" id="ftExt" placeholder="py"></div>
          <div class="set-row"><label>Opens with (app id)</label><input type="text" id="ftApp" placeholder="editor"></div>
          <button class="set-btn" id="ftAdd">Save</button>
          <h3>Current Associations</h3>
          <div id="ftList"></div>`;

        function renderList(){
          const listEl = content.querySelector('#ftList');
          listEl.innerHTML = window._OS.fileAssoc.list()
            .sort((a,b) => a.ext.localeCompare(b.ext))
            .map(a => `<div class="set-row"><label>.${esc(a.ext)}${a.custom ? ' (custom)' : ''}</label><span style="font-size:12px;color:var(--tx2)">${esc(a.appId)}${a.custom ? ` <button class="set-btn sec" data-ext="${a.ext}" data-act="reset" style="margin:0 0 0 8px;padding:2px 8px">Reset</button>` : ''}</span></div>`)
            .join('');
          listEl.querySelectorAll('[data-act="reset"]').forEach(b => b.onclick = () => { window._OS.fileAssoc.unset(b.dataset.ext); renderList(); });
        }
        renderList();

        content.querySelector('#ftAdd').onclick = () => {
          const ext = content.querySelector('#ftExt').value.trim();
          const app = content.querySelector('#ftApp').value.trim();
          if (!ext || !app){ alert('Both fields are required.'); return; }
          window._OS.fileAssoc.set(ext, app);
          content.querySelector('#ftExt').value = ''; content.querySelector('#ftApp').value = '';
          renderList();
        };
      }

      function showAI(){
        const providers = ai.listProviders();
        content.innerHTML = `<h2>AI Configuration</h2>
          <h3>Providers</h3>
          <div id="setProviders"></div>
          <h3>Quick Setup</h3>
          <div class="set-info">
            <strong>Ollama:</strong> Install from ollama.ai, run <code>ollama pull llama3.2</code>, it auto-starts on port 11434.<br><br>
            <strong>LM Studio:</strong> Download from lmstudio.ai, load a GGUF model, start local server on port 1234.<br><br>
            <strong>OpenAI:</strong> Get API key from platform.openai.com, enter below.
          </div>`;

        const list = content.querySelector('#setProviders');
        providers.forEach(p => {
          const card = document.createElement('div');
          card.className = `set-provider${p.active ? ' active' : ''}`;
          card.innerHTML = `
            <div class="set-provider-head"><span>${p.name}${p.active ? ' (Active)' : ''}</span><button class="set-btn sec" data-act="select" data-id="${p.id}">${p.active ? 'Active' : 'Select'}</button></div>
            <div class="set-row"><label>Endpoint</label><input type="text" id="ep_${p.id}" value="${p.endpoint}"></div>
            <div class="set-row"><label>Model</label><input type="text" id="md_${p.id}" value="${p.model}"></div>
            ${p.key !== undefined ? `<div class="set-row"><label>API Key</label><input type="password" id="ky_${p.id}" placeholder="sk-..." value="${p.key}"></div>` : ''}
            <button class="set-btn" data-act="save" data-id="${p.id}">Save</button>`;
          list.appendChild(card);
        });

        list.querySelectorAll('[data-act="select"]').forEach(b => b.onclick = () => { ai.setActive(b.dataset.id); showAI(); });
        list.querySelectorAll('[data-act="save"]').forEach(b => b.onclick = () => {
          const id = b.dataset.id;
          const opts = { endpoint: content.querySelector(`#ep_${id}`).value, model: content.querySelector(`#md_${id}`).value };
          const keyEl = content.querySelector(`#ky_${id}`);
          if (keyEl) opts.key = keyEl.value;
          ai.configure(id, opts);
          b.textContent = 'Saved'; setTimeout(() => b.textContent = 'Save', 1500);
        });
      }

      function showNetwork(){
        const peers = net ? net.peers.size : 0;
        content.innerHTML = `<h2>Network</h2>
          <h3>Local Network Sharing</h3>
          <div class="set-info">
            ${OS_NAME} tabs in the same browser can discover each other and share LLM endpoints.<br><br>
            <strong>Discovered peers:</strong> ${peers}<br><br>
            To share your LLM with others on the same network, tell them your local IP address (e.g., <code>http://192.168.1.100:11434</code>) and they can enter it in Settings > AI as a custom endpoint.
          </div>
          <button class="set-btn" id="netShare">Share My LLM Endpoint</button>
          <button class="set-btn sec" id="netAnnounce" style="margin-left:8px">Announce Presence</button>`;

        const shareBtn = content.querySelector('#netShare');
        if (shareBtn) shareBtn.onclick = () => {
          const p = ai.getP();
          if (!p){ alert('No LLM configured'); return; }
          if (net) net.shareLLM(p.endpoint, p.model);
          shareBtn.textContent = 'Shared'; setTimeout(() => shareBtn.textContent = 'Share My LLM Endpoint', 1500);
        };
        const annBtn = content.querySelector('#netAnnounce');
        if (annBtn) annBtn.onclick = () => {
          const p = ai.getP();
          if (net) net.announce(p ? p.endpoint : null);
          annBtn.textContent = 'Announced'; setTimeout(() => annBtn.textContent = 'Announce Presence', 1500);
        };
      }

      function showSystem(){
        const info = getSysInfo();
        content.innerHTML = `<h2>System</h2>
          <h3>Device</h3>
          <div class="set-info">
            Platform: ${info.platform}<br>CPU Cores: ${info.cores}<br>Memory: ${info.memory}GB<br>Online: ${info.online ? 'Yes' : 'No'}
          </div>
          <h3>Display</h3>
          <div class="set-info">${info.screen}<br>Pixel Ratio: ${window.devicePixelRatio}x</div>
          <h3>GPU</h3>
          <div class="set-info">${info.gpu || 'Not available'}</div>`;
      }

      function showAbout(){
        content.innerHTML = `<h2>About</h2>
          <div style="text-align:center;padding:40px 20px;">
            <div style="width:64px;height:64px;border:2px solid var(--ac);border-radius:16px;transform:rotate(45deg);margin:0 auto 20px;display:flex;align-items:center;justify-content:center"><div style="width:20px;height:20px;background:var(--ac);border-radius:4px"></div></div>
            <h3 style="margin-bottom:4px">${OS_NAME}</h3>
            <p style="color:var(--tx3);font-size:13px">Version 3.0.0</p>
            <p style="color:var(--tx2);margin-top:16px;font-size:13px;line-height:1.7">A cloud-native web operating system with AI at its core.<br>Runs entirely in your browser. Zero backend. Zero install.</p>
            <p style="color:var(--tx3);margin-top:16px;font-size:11px">IndexedDB / File System Access API / BroadcastChannel / Local LLM Integration</p>
          </div>`;
      }

      showAI();
    }
  };
}

function makeBrowserApp(){
  return {
    name: 'Browser', icon: ICO.browser,
    init(container){
      container.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;background:var(--bg)">
        <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--border);background:var(--bg2)">
          <input id="bUrl" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--tx);padding:6px 10px;border-radius:6px;font-size:12px;outline:none" placeholder="Enter URL..." value="https://"/>
          <button id="bGo" style="background:var(--ac);border:none;color:var(--bg);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">Go</button>
          <a id="bExternal" href="#" target="_blank" rel="noopener" title="Open in new tab — some sites block being embedded"
             style="background:var(--bg3);border:1px solid var(--border);color:var(--tx2);padding:6px 10px;border-radius:6px;font-size:12px;text-decoration:none;white-space:nowrap">↗</a>
        </div>
        <iframe id="bFrame" style="flex:1;border:none;background:white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      </div>`;

      const urlInput = container.querySelector('#bUrl');
      const frame = container.querySelector('#bFrame');
      const externalLink = container.querySelector('#bExternal');
      const go = () => {
        let u = urlInput.value.trim(); if (u && !u.startsWith('http')) u = 'https://' + u;
        frame.src = u; externalLink.href = u;
      };
      container.querySelector('#bGo').onclick = go;
      urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }
  };
}

function makeMonitorApp(fs, ai){
  return {
    name: 'System Monitor', icon: ICO.monitor,
    init(container){
      container.innerHTML = `<div style="padding:16px;height:100%;overflow-y:auto;background:var(--bg)">
        <h2 style="font-size:16px;margin-bottom:16px">System Monitor</h2>
        <div id="monContent"></div>
      </div>`;

      async function update(){
        const info = getSysInfo();
        let storageHtml = 'N/A';
        if (navigator.storage?.estimate){
          const s = await navigator.storage.estimate();
          const pct = ((s.usage/s.quota)*100).toFixed(1);
          storageHtml = `<div style="background:var(--bg2);border-radius:4px;height:8px;overflow:hidden;margin-top:6px"><div style="height:100%;width:${pct}%;background:var(--ac);border-radius:4px"></div></div><span style="font-size:11px;color:var(--tx3)">${fmtSize(s.usage)} / ${fmtSize(s.quota)} (${pct}%)</span>`;
        }

        const fileCount = (await fs.list('')).length;
        const aiStatus = ai.getP() ? `<span style="color:var(--ac)">Connected — ${ai.getP().name}</span>` : '<span style="color:var(--tx3)">Not configured</span>';

        container.querySelector('#monContent').innerHTML = `
          <div style="margin-bottom:20px"><div style="font-size:12px;color:var(--tx3);margin-bottom:4px">CPU</div><div style="font-size:20px;font-weight:600">${info.cores} cores</div></div>
          <div style="margin-bottom:20px"><div style="font-size:12px;color:var(--tx3);margin-bottom:4px">Memory</div><div style="font-size:20px;font-weight:600">${info.memory || '?'} GB</div></div>
          <div style="margin-bottom:20px"><div style="font-size:12px;color:var(--tx3);margin-bottom:4px">GPU</div><div style="font-size:13px">${info.gpu || 'N/A'}</div></div>
          <div style="margin-bottom:20px"><div style="font-size:12px;color:var(--tx3);margin-bottom:4px">Storage</div>${storageHtml}</div>
          <div style="margin-bottom:20px"><div style="font-size:12px;color:var(--tx3);margin-bottom:4px">Files</div><div style="font-size:20px;font-weight:600">${fileCount}</div></div>
          <div style="margin-bottom:20px"><div style="font-size:12px;color:var(--tx3);margin-bottom:4px">AI Status</div><div style="font-size:13px">${aiStatus}</div></div>
          <div style="margin-bottom:20px"><div style="font-size:12px;color:var(--tx3);margin-bottom:4px">Screen</div><div style="font-size:13px">${info.screen}</div></div>
        `;
      }
      update();
      const iv = setInterval(update, 5000);
      // Cleanup on window close
      const obs = new MutationObserver(() => { if (!document.contains(container)) clearInterval(iv); });
      obs.observe(container, { childList: true });
    }
  };
}
