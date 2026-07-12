/* ── APP STORE ──
   This is deliberately just the machinery, not a store. Solips-webos ships with
   NO catalog and installs nothing on its own. You host a JSON file wherever
   you like and point Settings/the Store app at its URL. Expected shape:

   {
     "official": [
       { "id":"vscode", "name":"VS Code", "url":"https://vscode.dev",
         "icon":"https://vscode.dev/favicon.ico", "description":"Code editor" }
     ],
     "community": [ ...same shape, user-submitted, unreviewed... ]
   }

   "official"  — entries you (or a vetted community) reviewed.
   "community" — anyone-can-submit, unreviewed. Surfaced with an explicit
   warning in the UI, the same spirit as "install from unknown sources"
   on a phone: available, but the user is told what that means first.

   Installing an entry just calls the same app_register path everything
   else uses (Settings > Apps, or the AI's app_register tool) — the Store
   is a friendlier UI on top of that, not a separate mechanism.
*/
class AppStore {
  constructor(){
    this.catalogUrl = localStorage.getItem('os-store-catalog') || '';
    this.catalog = { official: [], community: [] };
  }

  setCatalogUrl(url){
    this.catalogUrl = url.trim();
    localStorage.setItem('os-store-catalog', this.catalogUrl);
  }

  async refresh(){
    if (!this.catalogUrl){ this.catalog = { official: [], community: [] }; return this.catalog; }
    const r = await fetch(this.catalogUrl, { cache: 'no-store' });
    if (!r.ok) throw new Error(`Catalog fetch failed: HTTP ${r.status}`);
    const d = await r.json();
    this.catalog = {
      official: Array.isArray(d.official) ? d.official : [],
      community: Array.isArray(d.community) ? d.community : []
    };
    return this.catalog;
  }
}

function makeStoreApp(store){
  return {
    name: 'Store', icon: ICO.store,
    init(container){
      let tab = 'official';

      container.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;background:var(--bg)">
        <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--border);background:var(--bg2)">
          <input id="stUrl" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--tx);padding:6px 10px;border-radius:6px;font-size:11px;outline:none" placeholder="Catalog URL (JSON) — e.g. https://your-site.com/catalog.json">
          <button id="stSave" style="background:var(--bg3);border:1px solid var(--border);color:var(--tx2);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:11px">Set</button>
          <button id="stRefresh" style="background:var(--ac);border:none;color:var(--bg);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600">Refresh</button>
        </div>
        <div style="display:flex;gap:4px;padding:8px 10px 0">
          <button class="st-tab" data-tab="official" style="background:none;border:none;color:var(--ac);border-bottom:2px solid var(--ac);padding:6px 10px;font-size:12px;cursor:pointer">Official</button>
          <button class="st-tab" data-tab="community" style="background:none;border:none;color:var(--tx2);border-bottom:2px solid transparent;padding:6px 10px;font-size:12px;cursor:pointer">Community</button>
        </div>
        <div id="stBody" style="flex:1;overflow-y:auto;padding:12px"></div>
      </div>`;

      const body = container.querySelector('#stBody');
      container.querySelector('#stUrl').value = store.catalogUrl;

      // Accessed lazily (at click time, not at app-construction time) since
      // window._OS isn't assigned yet when appDefs is first built at boot.
      function installedIds(){ return new Set(window._OS.listApps().map(a => a.id)); }

      function renderEmpty(msg){
        body.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--tx3);font-size:12px;line-height:1.7">${msg}</div>`;
      }

      function renderList(){
        if (!store.catalogUrl){
          renderEmpty(`No catalog configured yet.<br><br>Set a Catalog URL above — it should return JSON shaped like:<br>
            <code style="display:block;text-align:left;background:var(--bg2);padding:10px;border-radius:6px;margin-top:10px;white-space:pre;overflow-x:auto">{
  "official": [{ "id","name","url","icon","description" }],
  "community": [ ...same shape... ]
}</code>`);
          return;
        }
        const entries = store.catalog[tab] || [];
        const installed = installedIds();
        let warning = tab === 'community'
          ? `<div style="background:var(--bg2);border:1px solid var(--yel);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--tx2);line-height:1.6">
               <strong style="color:var(--yel)">Unreviewed submissions.</strong> Anyone can add an app here. Only install things you recognize or trust, same as sideloading on a phone.
             </div>`
          : '';
        if (!entries.length){
          renderEmpty(warning + (tab === 'official' ? 'No official apps in this catalog yet.' : 'No community apps in this catalog yet.'));
          return;
        }
        body.innerHTML = warning + entries.map(e => {
          const isInstalled = installed.has(e.id);
          const iconHtml = e.icon && /^https?:\/\//.test(e.icon)
            ? `<img src="${esc(e.icon)}" style="width:32px;height:32px;object-fit:contain" onerror="this.style.display='none'">`
            : (ICO[e.icon] || ICO.browser).replace('<svg ', '<svg width="32" height="32" ');
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
            <div style="flex-shrink:0">${iconHtml}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600">${esc(e.name || e.id)}</div>
              <div style="font-size:11px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.description || e.url || '')}</div>
            </div>
            <button data-install="${esc(e.id)}" ${isInstalled ? 'disabled' : ''} style="flex-shrink:0;background:${isInstalled ? 'var(--bg3)' : 'var(--ac)'};border:none;color:${isInstalled ? 'var(--tx3)' : 'var(--bg)'};padding:6px 14px;border-radius:6px;font-size:11px;font-weight:600;cursor:${isInstalled ? 'default' : 'pointer'}">${isInstalled ? 'Installed' : 'Install'}</button>
          </div>`;
        }).join('');

        body.querySelectorAll('[data-install]').forEach(btn => {
          btn.onclick = () => {
            const entry = entries.find(e => e.id === btn.dataset.install);
            if (!entry) return;
            window._OS.registerApp({ id: entry.id, name: entry.name, url: entry.url, icon: entry.icon });
            renderList();
          };
        });
      }

      container.querySelectorAll('.st-tab').forEach(btn => {
        btn.onclick = () => {
          tab = btn.dataset.tab;
          container.querySelectorAll('.st-tab').forEach(b => {
            b.style.color = b === btn ? 'var(--ac)' : 'var(--tx2)';
            b.style.borderBottomColor = b === btn ? 'var(--ac)' : 'transparent';
          });
          renderList();
        };
      });

      container.querySelector('#stSave').onclick = () => {
        store.setCatalogUrl(container.querySelector('#stUrl').value);
        renderList();
      };

      container.querySelector('#stRefresh').onclick = async () => {
        try { await store.refresh(); renderList(); if (window.OS) window.OS.notify('Catalog refreshed', '', 'ok'); }
        catch(e){ if (window.OS) window.OS.notify('Catalog refresh failed', e.message, 'error'); }
      };

      renderList();
      if (store.catalogUrl) store.refresh().then(renderList).catch(() => {});
    }
  };
}
