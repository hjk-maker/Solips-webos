/* ── UTILITY ── */
function fmtSize(b){ if (!b) return '0 B'; const k=1024,s=['B','KB','MB','GB','TB'],i=Math.floor(Math.log(b)/Math.log(k)); return (b/Math.pow(k,i)).toFixed(1)+' '+s[i]; }
function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function getSysInfo(){
  let gpu = null;
  try { const c=document.createElement('canvas').getContext('webgl'),e=c.getExtension('WEBGL_debug_renderer_info'); gpu=c.getParameter(e.UNMASKED_RENDERER_WEBGL); } catch{}
  return { platform:navigator.platform, cores:navigator.hardwareConcurrency||0, memory:navigator.deviceMemory||0, gpu, screen:`${screen.width}x${screen.height}`, online:navigator.onLine };
}
