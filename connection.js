/* No real key belongs in this file or this public repository. */
window.YaliConnection = (() => {
  const BASE = "https://script.google.com/macros/s/AKfycbwqoeuDgkqyVVMgauSyui6zdMf8rapHBPWxQ6fylPRLTs8RuibtHjQptaxlDLBkK8Wc/exec";
  const KEY_NAME = 'yaliKey';
  const validKey = value => /^[A-Za-z0-9]{64}$/.test(value || '');
  function saveKey(value) { try { localStorage.setItem(KEY_NAME, value); } catch (_) {} }
  function readKey() {
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.has('k')) {
      const value = hash.get('k');
      if (!validKey(value)) return '';
      saveKey(value);
      return value;
    }
    try { const value = localStorage.getItem(KEY_NAME); return validKey(value) ? value : ''; }
    catch (_) { return ''; }
  }
  async function call(key, fn, ...args) {
    const r = await fetch(BASE + '?api=1', {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      body: JSON.stringify({fn, key, args})
    });
    if (!r.ok) throw new Error('連線失敗（HTTP ' + r.status + '）');
    try { return await r.json(); }
    catch (_) { throw new Error('連線回覆不完整，請稍後再試。'); }
  }
  return {BASE, readKey, saveKey, validKey, call};
})();
