/* ── APP DEFINITIONS: Terminal, Files, Editor ── */

function makeTerminalApp(fs, ai){
  return {
    name: 'Terminal', icon: ICO.terminal,
    init(container){
      container.innerHTML = `<div class="term"><div class="term-out" id="tOut"></div><div class="term-in"><span class="term-prompt">${OS_NAME.toLowerCase()}:~$</span><input id="tIn" spellcheck="false" autocomplete="off"/></div></div>`;
      const out = container.querySelector('#tOut');
      const inp = container.querySelector('#tIn');
      let cwd = '~';
      const history = [];
      let histIdx = -1;

      function p(text, cls='t-out'){ const s = document.createElement('span'); s.className = cls; s.textContent = text + '\n'; out.appendChild(s); }
      function pHtml(html){ const d = document.createElement('div'); d.innerHTML = html; out.appendChild(d); }

      function prompt(){ return `${OS_NAME.toLowerCase()}:${cwd}$ `; }

      inp.addEventListener('keydown', async (e) => {
        if (e.key === 'ArrowUp'){ e.preventDefault(); if (history.length){ histIdx = Math.max(0, histIdx-1); inp.value = history[histIdx]; } return; }
        if (e.key === 'ArrowDown'){ e.preventDefault(); if (histIdx >= 0){ histIdx = Math.min(history.length-1, histIdx+1); inp.value = history[histIdx]; } return; }
        if (e.key !== 'Enter') return;
        const cmd = inp.value.trim(); inp.value = '';
        if (cmd){ history.unshift(cmd); histIdx = -1; }
        pHtml(`<span class="t-cmd">${prompt()}${esc(cmd)}</span>`);
        if (!cmd) return;
        try { await exec(cmd); } catch(err){ p('Error: ' + err.message, 't-err'); }
        out.scrollTop = out.scrollHeight;
      });

      container.addEventListener('click', () => inp.focus());
      setTimeout(() => inp.focus(), 100);

      async function exec(input){
        const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const cmd = (parts[0] || '').toLowerCase();
        const args = parts.slice(1).map(a => a.replace(/^"|"$/g,''));

        switch(cmd){
          case 'help':
            p(`${OS_NAME} Terminal v3.1
────────────────────────────────
 FILES         AI / AUTOMATION     SYSTEM
 ls            ask <msg>          sysinfo
 cat <path>    ai <msg>           storage
 write <p> <c> ai-models          gpu
 touch <path>  ai-ping            neofetch
 rm <path>     ai-set <provider>  pwd
 mkdir <path>
 mv <a> <b>    APPS               OTHER
 cp <a> <b>    open <app>         clear, echo, date
 find <text>   apps               whoami, history
 export <path> assoc [ext app]
 (rm on a path ending in "/" deletes that folder and everything in it)`, 't-out');
            break;

          case 'clear': out.innerHTML = ''; break;
          case 'echo': p(args.join(' '), 't-out'); break;
          case 'date': p(new Date().toString(), 't-out'); break;
          case 'whoami': p(OS_NAME.toLowerCase(), 't-out'); break;
          case 'pwd': p(cwd, 't-out'); break;

          case 'history': {
            if (!history.length) { p('(no history)', 't-out'); break; }
            history.slice().reverse().forEach((h, i) => p(`  ${i+1}  ${h}`, 't-out'));
            break;
          }

          case 'mv': {
            if (args.length < 2){ p('Usage: mv <from> <to>', 't-err'); break; }
            const f = await fs.read(args[0]);
            if (!f){ p(`Not found: ${args[0]}`, 't-err'); break; }
            await fs.write(args[1], f.content);
            await fs.del(args[0]);
            p(`Moved ${args[0]} -> ${args[1]}`, 't-ok');
            break;
          }

          case 'cp': {
            if (args.length < 2){ p('Usage: cp <from> <to>', 't-err'); break; }
            const f = await fs.read(args[0]);
            if (!f){ p(`Not found: ${args[0]}`, 't-err'); break; }
            await fs.write(args[1], f.content);
            p(`Copied ${args[0]} -> ${args[1]}`, 't-ok');
            break;
          }

          case 'find': {
            if (!args[0]){ p('Usage: find <substring>', 't-err'); break; }
            const files = await fs.list('');
            const hits = files.filter(f => f.path.includes(args[0]));
            if (!hits.length) p('No matches', 't-out');
            else hits.forEach(f => p(`  ${f.path}`, 't-out'));
            break;
          }

          case 'assoc': {
            // With no args, list associations. With <ext> <app-id>, set one.
            if (!args[0]){
              window._OS.fileAssoc.list().sort((a,b)=>a.ext.localeCompare(b.ext))
                .forEach(a => p(`  .${a.ext.padEnd(10)} -> ${a.appId}${a.custom ? ' (custom)' : ''}`, 't-out'));
              break;
            }
            if (!args[1]){ p('Usage: assoc <ext> <app-id>', 't-err'); break; }
            window._OS.fileAssoc.set(args[0], args[1]);
            p(`.${args[0]} now opens with ${args[1]}`, 't-ok');
            break;
          }

          case 'ls': {
            const prefix = args[0] || '';
            const files = await fs.list(prefix);
            if (!files.length) { p('(empty)', 't-out'); break; }
            files.sort((a,b) => a.path.localeCompare(b.path));
            for (const f of files){
              const sz = fmtSize(f.size || 0);
              const dt = new Date(f.modified).toLocaleDateString();
              p(`  ${f.path.padEnd(30)} ${sz.padStart(8)}  ${dt}`, 't-out');
            }
            break;
          }

          case 'cat': {
            if (!args[0]){ p('Usage: cat <path>', 't-err'); break; }
            const f = await fs.read(args[0]);
            if (!f) p(`Not found: ${args[0]}`, 't-err');
            else p(f.content || '(empty)', 't-out');
            break;
          }

          case 'write': {
            if (args.length < 2){ p('Usage: write <path> <content>', 't-err'); break; }
            await fs.write(args[0], args.slice(1).join(' '));
            p(`Written to ${args[0]}`, 't-ok');
            break;
          }

          case 'touch': {
            if (!args[0]){ p('Usage: touch <path>', 't-err'); break; }
            await fs.write(args[0], '');
            p(`Created ${args[0]}`, 't-ok');
            break;
          }

          case 'rm': {
            if (!args[0]){ p('Usage: rm <path>', 't-err'); break; }
            await fs.del(args[0]);
            p(`Deleted ${args[0]}`, 't-ok');
            break;
          }

          case 'mkdir': {
            if (!args[0]){ p('Usage: mkdir <path>', 't-err'); break; }
            await fs.write(args[0] + '/', '');
            p(`Created directory ${args[0]}/`, 't-ok');
            break;
          }

          case 'export': {
            if (!args[0]){ p('Usage: export <path>', 't-err'); break; }
            const f = await fs.read(args[0]);
            if (!f){ p(`Not found: ${args[0]}`, 't-err'); break; }
            const blob = new Blob([f.content], { type:'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = args[0].split('/').pop(); a.click(); URL.revokeObjectURL(a.href);
            p(`Exported ${args[0]}`, 't-ok');
            break;
          }

          // ── AI COMMANDS ──
          case 'ask': {
            const msg = args.join(' ');
            if (!msg){ p('Usage: ask <message>', 't-err'); break; }
            p('Thinking...', 't-ai');
            try {
              const reply = await ai.chat(msg, false);
              p(reply, 't-ai');
            } catch(e){ p(e.message, 't-err'); }
            break;
          }

          case 'ai': {
            const msg = args.join(' ');
            if (!msg){ p('Usage: ai <instruction>', 't-err'); break; }
            p('Processing...', 't-ai');
            try {
              const reply = await ai.chat(msg, true);
              // Parse and execute tools
              const tools = ai.parseTools(reply);
              if (tools.length){
                p(`Executing ${tools.length} action(s)...`, 't-warn');
                for (const tool of tools){
                  const result = await executeTool(tool.name, tool.params);
                  p(`  ${tool.name}: ${JSON.stringify(result)}`, 't-ok');
                }
              }
              // Show the text part (strip tool blocks)
              const clean = reply.replace(/\[TOOL:.*?\[\/TOOL\]/gs, '').trim();
              if (clean) p(clean, 't-ai');
            } catch(e){ p(e.message, 't-err'); }
            break;
          }

          case 'ai-models': {
            try {
              const models = await ai.getModels();
              if (models.length) models.forEach((m,i) => p(`  ${i+1}. ${m}`, 't-out'));
              else p('No models found. Is your LLM running?', 't-warn');
            } catch(e){ p(e.message, 't-err'); }
            break;
          }

          case 'ai-ping': {
            try { const ok = await ai.ping(); p(ok ? 'LLM reachable' : 'LLM not reachable', ok ? 't-ok' : 't-err'); }
            catch(e){ p(e.message, 't-err'); }
            break;
          }

          case 'ai-set': {
            if (!args[0]){ p('Providers: ' + ai.listProviders().map(p=>p.id).join(', '), 't-out'); break; }
            ai.setActive(args[0]); p(`Switched to ${args[0]}`, 't-ok');
            break;
          }

          // ── APP COMMANDS ──
          case 'open': {
            if (!args[0]){ p('Usage: open <app-id>', 't-err'); break; }
            window._OS.openApp(args[0]);
            p(`Opened ${args[0]}`, 't-ok');
            break;
          }

          case 'apps': {
            p(window._OS.listApps().map(a => `  ${a.id.padEnd(12)} ${a.name}`).join('\n'), 't-out');
            break;
          }

          // ── SYSTEM ──
          case 'sysinfo': {
            const info = getSysInfo();
            p(`  Platform: ${info.platform}`);
            p(`  Cores: ${info.cores}`);
            p(`  Memory: ${info.memory}GB`);
            p(`  GPU: ${info.gpu || 'N/A'}`);
            p(`  Screen: ${info.screen}`);
            p(`  Online: ${info.online}`);
            break;
          }

          case 'storage': {
            if (navigator.storage?.estimate){
              const s = await navigator.storage.estimate();
              p(`  Used: ${fmtSize(s.usage)} / ${fmtSize(s.quota)} (${((s.usage/s.quota)*100).toFixed(1)}%)`);
            } else p('Storage API not available', 't-err');
            break;
          }

          case 'gpu': {
            try {
              const c = document.createElement('canvas').getContext('webgl');
              const e = c.getExtension('WEBGL_debug_renderer_info');
              p(`  Vendor: ${c.getParameter(e.UNMASKED_VENDOR_WEBGL)}`);
              p(`  Renderer: ${c.getParameter(e.UNMASKED_RENDERER_WEBGL)}`);
            } catch{ p('WebGL not available', 't-err'); }
            break;
          }

          case 'neofetch': {
            const info = getSysInfo();
            pHtml(`<span class="t-ai">       ╭──────────╮       </span> <span class="t-ai" style="color:var(--ac)">${OS_NAME.toLowerCase()}</span><span style="color:var(--tx3)">@</span><span class="t-ai">os</span>`);
            pHtml(`<span class="t-ai">       │  ◈    ◈  │       </span> ─────────────────`);
            pHtml(`<span class="t-ai">       │    ◈◈    │       </span> OS: ${OS_NAME} v3.0`);
            pHtml(`<span class="t-ai">       │  ◈    ◈  │       </span> Kernel: Web Kernel + AI`);
            pHtml(`<span class="t-ai">       ╰──────────╯       </span> Platform: ${info.platform}`);
            pHtml(`<span class="t-ai">                           </span> Cores: ${info.cores} | Memory: ${info.memory}GB`);
            pHtml(`<span class="t-ai">                           </span> GPU: ${info.gpu?.split('/')[0] || 'N/A'}`);
            pHtml(`<span class="t-ai">                           </span> AI: ${ai.getP() ? ai.getP().name : 'Not configured'}`);
            pHtml(`<span class="t-ai">                           </span> Shell: ${OS_NAME}Terminal 3.0`);
            p('');
            pHtml(`<span style="color:#ff4466">███</span><span style="color:#ffaa22">███</span><span style="color:#00d4aa">███</span><span style="color:#00aacc">███</span><span style="color:#c4a0ff">███</span><span style="color:#ff7b72">███</span><span style="color:#8585a0">███</span><span style="color:#e2e2ea">███</span>`);
            break;
          }

          default: p(`Unknown command: ${cmd}. Type 'help'.`, 't-err');
        }
      }

      // Delegates to the shared executor in main.js so every entry point (terminal,
      // future apps, external callers) runs the exact same tool implementations.
      async function executeTool(name, params){
        return window._OS.executeTool(name, params);
      }
    }
  };
}

function makeFilesApp(fs, openEditor){
  return {
    name: 'Files', icon: ICO.files,
    init(container){
      container.innerHTML = `<div class="files-app">
        <div class="files-bar">
          <button id="fNew">New File</button>
          <button id="fSelectAll">Select All</button>
          <button id="fDeleteSel" style="display:none;color:var(--red)">Delete Selected</button>
          <button id="fRefresh">Refresh</button>
        </div>
        <div class="files-list" id="fList"></div>
      </div>`;

      const selected = new Set();

      function updateBar(){
        const delBtn = container.querySelector('#fDeleteSel');
        delBtn.style.display = selected.size ? '' : 'none';
        delBtn.textContent = `Delete Selected (${selected.size})`;
      }

      async function render(){
        const list = container.querySelector('#fList');
        const files = await fs.list('');
        selected.clear(); updateBar();
        if (!files.length){ list.innerHTML = `<div class="files-empty">${ICO.files}<span>No files yet</span></div>`; return; }
        files.sort((a,b) => a.path.localeCompare(b.path));
        list.innerHTML = files.map(f => {
          const isDir = f.path.endsWith('/');
          const icon = isDir ? ICO.folder : ICO.file;
          const sz = isDir ? '--' : fmtSize(f.size || 0);
          const dt = new Date(f.modified).toLocaleDateString();
          return `<div class="f-row" data-path="${esc(f.path)}" data-dir="${isDir}">
            <input type="checkbox" class="f-check" style="flex-shrink:0">
            ${icon}<span class="f-name">${esc(f.path)}</span><span class="f-size">${sz}</span><span class="f-date">${dt}</span>
            <button class="f-del" title="Delete" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px;flex-shrink:0">${ICO.close}</button>
          </div>`;
        }).join('');

        list.querySelectorAll('.f-row').forEach(row => {
          const path = row.dataset.path;
          row.querySelector('.f-check').onchange = (e) => {
            e.target.checked ? selected.add(path) : selected.delete(path);
            updateBar();
          };
          row.querySelector('.f-del').onclick = async (e) => {
            e.stopPropagation();
            if (!confirm(`Delete ${path}?`)) return;
            await fs.del(path);
            if (window.OS) window.OS.notify('Deleted', path, 'ok');
            render();
          };
          row.ondblclick = (e) => {
            if (e.target.closest('.f-check') || e.target.closest('.f-del')) return;
            if (row.dataset.dir === 'true') return;
            openEditor(path);
          };
        });
      }

      container.querySelector('#fRefresh').onclick = render;
      container.querySelector('#fSelectAll').onclick = () => {
        container.querySelectorAll('.f-check').forEach(c => { c.checked = true; selected.add(c.closest('.f-row').dataset.path); });
        updateBar();
      };
      container.querySelector('#fDeleteSel').onclick = async () => {
        if (!selected.size) return;
        if (!confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)) return;
        for (const path of selected) await fs.del(path);
        if (window.OS) window.OS.notify('Deleted', `${selected.size} item(s) removed`, 'ok');
        render();
      };
      container.querySelector('#fNew').onclick = async () => {
        const name = prompt('File name:', '/untitled.txt');
        if (name){ await fs.write(name, ''); render(); openEditor(name); }
      };
      render();
    }
  };
}

function makeEditorApp(fs){
  return {
    name: 'Editor', icon: ICO.editor,
    init(container, winObj, context){
      let currentPath = null;
      container.innerHTML = `<div class="editor-app">
        <div class="editor-bar">
          <button id="eNew">New</button>
          <button id="eSave">Save</button>
          <button id="eSaveAs">Save As</button>
          <span class="path" id="ePath">Untitled</span>
        </div>
        <div class="editor-area"><textarea id="eText" spellcheck="false"></textarea></div>
        <div class="editor-status"><span id="eInfo">0 lines, 0 chars</span><span id="eSaved">Ready</span></div>
      </div>`;

      const textarea = container.querySelector('#eText');
      const pathEl = container.querySelector('#ePath');
      const infoEl = container.querySelector('#eInfo');
      const savedEl = container.querySelector('#eSaved');

      textarea.addEventListener('input', () => {
        const lines = textarea.value.split('\n').length;
        infoEl.textContent = `${lines} lines, ${textarea.value.length} chars`;
        savedEl.textContent = 'Modified';
        savedEl.style.color = 'var(--yel)';
      });

      // Tab key support
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab'){
          e.preventDefault();
          const s = textarea.selectionStart, en = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0,s) + '  ' + textarea.value.substring(en);
          textarea.selectionStart = textarea.selectionEnd = s + 2;
        }
        if (e.key === 's' && (e.ctrlKey || e.metaKey)){
          e.preventDefault(); saveFile();
        }
      });

      async function saveFile(){
        if (!currentPath){ saveAs(); return; }
        await fs.write(currentPath, textarea.value);
        savedEl.textContent = 'Saved'; savedEl.style.color = 'var(--ac)';
        if (winObj) winObj.title = currentPath.split('/').pop();
      }

      function saveAs(){
        const name = prompt('Save as:', currentPath || '/untitled.txt');
        if (name){ currentPath = name; pathEl.textContent = name; saveFile(); }
      }

      container.querySelector('#eNew').onclick = () => { currentPath = null; textarea.value = ''; pathEl.textContent = 'Untitled'; infoEl.textContent = '0 lines, 0 chars'; savedEl.textContent = 'New'; savedEl.style.color = 'var(--tx3)'; };
      container.querySelector('#eSave').onclick = saveFile;
      container.querySelector('#eSaveAs').onclick = saveAs;

      // Public method to open a file
      container._openFile = async (path) => {
        const f = await fs.read(path);
        if (f){ currentPath = path; textarea.value = f.content || ''; pathEl.textContent = path; const lines = textarea.value.split('\n').length; infoEl.textContent = `${lines} lines, ${textarea.value.length} chars`; savedEl.textContent = 'Loaded'; savedEl.style.color = 'var(--ac)'; if (winObj) winObj.title = path.split('/').pop(); }
      };

      // Launched via a file association (Files app double-click, or the AI's
      // app_open tool with a filePath) — load it right away instead of the
      // caller having to guess when this window is ready.
      if (context?.filePath) container._openFile(context.filePath);

      return container;
    }
  };
}
