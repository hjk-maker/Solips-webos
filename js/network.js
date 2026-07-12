/* ── NETWORK BRIDGE (same-browser tab discovery + shared LLMs) ── */
class NetworkBridge {
  constructor(){
    this.peers = new Map();
    this.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    this.onLLMShare = null;
    try {
      this.ch = new BroadcastChannel('os-network');
      this.ch.onmessage = (e) => this._onMsg(e.data);
    } catch(e){ this.ch = null; }
  }
  announce(llmEndpoint){
    if (!this.ch) return;
    this.ch.postMessage({ type:'announce', id:this.id, llm: llmEndpoint || null });
  }
  shareLLM(endpoint, model){
    if (!this.ch) return;
    this.ch.postMessage({ type:'llm-share', id:this.id, endpoint, model });
  }
  _onMsg(d){
    if (d.id === this.id) return;
    if (d.type === 'announce') this.peers.set(d.id, { llm: d.llm });
    if (d.type === 'llm-share' && this.onLLMShare) this.onLLMShare(d.endpoint, d.model, d.id);
    if (d.type === 'goodbye') this.peers.delete(d.id);
  }
  destroy(){ if (this.ch) this.ch.close(); }
}
