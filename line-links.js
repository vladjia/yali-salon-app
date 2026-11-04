/* YALI LINE connections. Data stays in GAS; no LINE user IDs are bundled here. */
(() => {
  'use strict';
  const state = {items:[],autoLinked:[],loaded:false,pending:false,loading:false};
  const panel = document.createElement('section');
  panel.id='lineLinksPanel'; panel.className='panel'; panel.hidden=true;
  document.getElementById('accessPanel').after(panel);
  const dialog=document.createElement('dialog');
  dialog.id='lineLinkDialog';dialog.className='line-link-dialog';
  document.body.append(dialog);
  let operation=null;
  const safe=s=>h(s);
  function since(value) {
    if(!value)return '';
    const stamp=String(value),time=Date.parse(stamp.replace(' ','T')+'+08:00');
    if(!Number.isFinite(time))return stamp;
    const minutes=Math.floor((Date.now()-time)/60000);
    if(minutes<0)return stamp;
    const age=minutes<1?'剛剛':minutes<60?minutes+' 分鐘前':minutes<1440?Math.floor(minutes/60)+' 小時前':Math.floor(minutes/1440)+' 天前';
    return age+' · '+stamp;
  }
  const busy=()=>Boolean(S.dialog || dialog.open || document.querySelector('#priceAppFrame:not([hidden])') || document.activeElement?.matches('input,select,textarea'));
  function errorText(r) {
    const map={ALREADY:'這個 LINE 已經連上客人，請重新整理名單。',CONFLICT:'這位客人已經有另一個 LINE，請確認後再處理。',NOT_FOUND:'這筆名單已經處理過，請重新整理。',BAD_INPUT:'請確認客人稱呼、手機和選擇的項目。',BUSY:'系統正在處理，稍等幾秒再按一次。',BAD_FN:'後端還沒更新這個功能，請元家確認部署版本。',FORBIDDEN:'請用元家給的連結打開。'};
    return map[r?.code] || r?.message || '操作還沒完成，請稍後再試。';
  }
  function render() {
    const pendingOpen=panel.querySelector('#linePendingDetails')?.open;
    const autoOpen=panel.querySelector('#lineAutoDetails')?.open;
    panel.className='line-links-compact';
    panel.hidden=!state.items.length&&!state.autoLinked.length;
    if(panel.hidden){panel.replaceChildren();return;}
    panel.innerHTML=`${state.items.length ? `<details id="linePendingDetails" ${pendingOpen?'open':''}><summary>有 ${state.items.length} 位 LINE 客人還沒連上</summary><div class="line-link-list">${state.items.map((item,i)=>`<article class="line-link-row"><strong>${safe(item.name || 'LINE 訪客')}</strong><p class="line-last-text">${safe(item.lastText || '剛加入好友，還沒有留言')}</p><p class="small">${safe(since(item.lastAt || item.firstAt))}</p><div class="line-link-actions"><button type="button" class="primary" data-link-index="${i}">連到客人</button><button type="button" data-ignore-index="${i}">不是客人</button></div></article>`).join('')}<button type="button" id="refreshLineLinks">↻ 更新名單</button></div></details>` : ''}
      ${state.autoLinked.length ? `<details id="lineAutoDetails" ${autoOpen?'open':''}><summary>最近 14 天有 ${state.autoLinked.length} 位客人自動連上 LINE</summary><div>${state.autoLinked.map((item,i)=>`<article class="line-link-row"><strong>✅ ${safe(item.customerName || '客人')} 已自動連上 LINE</strong><p class="small">${safe(item.name ? 'LINE 名稱：'+item.name : 'LINE 未設定顯示名稱')}<br>${safe(item.at || '')}</p><button type="button" class="danger" data-unlink-index="${i}">不是本人，取消</button></article>`).join('')}${!state.items.length?'<button type="button" id="refreshLineLinks">↻ 更新名單</button>':''}</div></details>` : ''}<p class="small" id="lineLinksStatus" role="status"></p>`;
  }
  async function refresh(force=false) {
    if(!KEY || state.loading)return;
    if(!force && busy()){state.pending=true;return;}
    state.loading=true;
    try {
      const r=await call('apiLineLinks');
      if(!r?.ok){
        if(!state.loaded){panel.hidden=false;panel.innerHTML='<h2>LINE 客人</h2><p role="status">'+safe(errorText(r))+'</p><button type="button" id="refreshLineLinks">重新讀取</button>';}
        else {const e=document.getElementById('lineLinksStatus');if(e)e.textContent=errorText(r);}
        return;
      }
      if(!force && busy()){state.pending=true;return;}
      state.items=Array.isArray(r.items)?r.items:[];
      state.autoLinked=Array.isArray(r.autoLinked)?r.autoLinked:[];
      state.loaded=true;state.pending=false;render();
    } catch(e) {
      if(!state.loaded){panel.hidden=false;panel.innerHTML='<h2>LINE 客人</h2><p>暫時讀不到名單，預約管理仍可使用。</p><button type="button" id="refreshLineLinks">重新讀取</button>';}
      else {const el=document.getElementById('lineLinksStatus');if(el)el.textContent='名單更新失敗，稍後再試。';}
    } finally {state.loading=false;}
  }
  function endDialog() {
    if(operation?.busy)return;
    dialog.close();operation=null;
    if(state.pending)refresh();
    if(pulsePending)pulseTick();
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();endDialog();});
  async function open(item,kind) {
    if(!item?.lineUserId){flash('這筆 LINE 資料不完整，請更新名單。','error');return;}
    operation={item,kind,busy:false,opId:makeOpId(),signature:null,revision:0};
    const op=operation;
    const title=kind==='link'?'連到客人':kind==='ignore'?'確認不是客人':'確認取消連接';
    dialog.innerHTML=`<div class="sheet-head"><h2>${title}</h2><button type="button" id="closeLineDialog" aria-label="關閉">×</button></div><strong>${safe(item.name || item.customer?.name || item.customerName || 'LINE 訪客')}</strong><p class="line-last-text">${safe(item.lastText || '')}</p><p id="lineDialogMessage" role="status"></p><form id="lineLinkForm">${kind==='link'?'<p>正在讀取客人清單…</p>':`<p>${kind==='ignore'?'從待連上名單移除，之後不再自動列入。':'取消這個 LINE 與客人的連接，請先確認確實不是本人。'}</p><button class="danger" id="lineSubmit">${kind==='ignore'?'確定不是客人':'確定取消連接'}</button>`}</form>`;
    dialog.showModal();
    if(kind==='link') {
      try {
        const r=await call('apiCustomers');if(operation!==op)return;
        if(!r?.ok)throw Error(errorText(r));
        document.getElementById('lineLinkForm').innerHTML=`<label for="linkCustomer">選擇既有客人</label><select id="linkCustomer"><option value="">（新客人）</option>${(r.customers||[]).map(c=>`<option value="${safe(c.id)}" ${c.hasLine?'disabled':''}>${safe(c.name)} ${safe(c.phone||'')}${c.hasLine?'（已有 LINE）':''}</option>`).join('')}</select><div id="linkNewFields"><label for="linkNickname">新客人稱呼</label><input id="linkNickname" value="${safe(item.name||'')}" autocomplete="off"><label for="linkPhone">手機（選填）</label><input id="linkPhone" type="tel" autocomplete="off"></div><button type="submit" id="lineSubmit" class="good">確定連到客人</button>`;
        document.getElementById('linkCustomer').onchange=()=>{
          const existing=!!document.getElementById('linkCustomer').value;
          document.getElementById('linkNewFields').hidden=existing;
          document.getElementById('linkNickname').disabled=existing;document.getElementById('linkPhone').disabled=existing;
        };
      } catch(e){if(operation===op)document.getElementById('lineDialogMessage').textContent=e.message;}
    }
  }
  async function submit(event) {
    event.preventDefault();const op=operation;if(!op||op.busy)return;
    const req={lineUserId:op.item.lineUserId};
    const fn=op.kind==='link'?'apiLinkLine':op.kind==='ignore'?'apiLineIgnore':'apiLineUnlink';
    if(op.kind==='link') {
      const customerId=document.getElementById('linkCustomer')?.value;
      if(customerId)req.customerId=customerId;
      else {
        req.nickname=document.getElementById('linkNickname')?.value.trim();
        req.phone=document.getElementById('linkPhone')?.value.trim();
        if(!req.nickname){document.getElementById('lineDialogMessage').textContent='請填寫客人的稱呼。';return;}
      }
    }
    const signature=JSON.stringify(req);
    if(op.signature && op.signature!==signature)op.opId=makeOpId();
    op.signature=signature;req.opId=op.opId;op.busy=true;
    dialog.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);
    document.getElementById('lineDialogMessage').textContent='正在儲存，請稍候…';
    try {
      const r=await call(fn,req);if(operation!==op)return;
      if(!r?.ok)throw Error(errorText(r));
      op.busy=false;endDialog();
      flash(op.kind==='link'?'已幫客人連上 LINE。':op.kind==='ignore'?'已從名單移除。':'已取消這個 LINE 的連接。','success');
      await refresh(true);await loadDays(S.selected,true);
    } catch(e) {
      if(operation!==op)return;
      op.busy=false;dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);
      if(op.kind==='link')document.getElementById('linkCustomer').onchange();
      document.getElementById('lineDialogMessage').textContent=e.message+' 若要重試，直接再按一次即可。';
    }
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.id==='refreshLineLinks')refresh(true);
    if(button.id==='closeLineDialog')endDialog();
    if(button.dataset.linkIndex!==undefined)open(state.items[Number(button.dataset.linkIndex)],'link');
    if(button.dataset.ignoreIndex!==undefined)open(state.items[Number(button.dataset.ignoreIndex)],'ignore');
    if(button.dataset.unlinkIndex!==undefined)open(state.autoLinked[Number(button.dataset.unlinkIndex)],'unlink');
  });
  dialog.addEventListener('submit',submit);
  function rememberDraft() {
    const d=S.dialog;if(d?.view!=='new')return;
    const before=JSON.stringify(d.newDraft||{});
    const fields=['newCustomer','newName','newPhone','createDate','createTime','createMinutes','createNote'];
    d.newDraft=d.newDraft||{};
    fields.forEach(id=>{const el=document.getElementById(id);if(el)d.newDraft[id]=el.value;});
    d.newDraft.serviceIds=Array.from(document.querySelectorAll('input[name="newService"]:checked')).map(x=>x.value);
    if(before!==JSON.stringify(d.newDraft)&&!d.busy)d.opId=null;
  }
  document.getElementById('dialogBody').addEventListener('input',rememberDraft);
  document.getElementById('dialogBody').addEventListener('change',rememberDraft);
  function mountNew() {
    const d=S.dialog;if(d?.view!=='new')return;
    if(d.newDraft) {
      Object.entries(d.newDraft).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value;});
      document.querySelectorAll('input[name="newService"]').forEach(el=>el.checked=d.newDraft.serviceIds?.includes(el.value));
    }
    const box=document.createElement('section');box.className='line-create-source';
    box.innerHTML=`<label for="newLineSource">📱 剛剛傳 LINE 來的人</label><select id="newLineSource"><option value="">（這次不連 LINE）</option>${state.items.map(x=>`<option value="${safe(x.lineUserId)}">${safe(x.name||'LINE 訪客')}｜${safe((x.lastText||'剛加入好友').slice(0,70))}｜${safe(x.lastAt||'')}</option>`).join('')}</select><p class="small">選了這位，再選既有客人或填新客人，建立預約時會一起連上。</p>`;
    document.getElementById('dialogBody').prepend(box);
    const select=document.getElementById('newLineSource');select.value=d.lineUserId||'';
    const update=()=>{
      d.lineUserId=select.value;
      if(d.lineUserId && !document.getElementById('newCustomer').value && !document.getElementById('newName').value.trim()) {
        document.getElementById('newName').value=state.items.find(i=>i.lineUserId===d.lineUserId)?.name || '';
      }
      const label=document.querySelector('label[for="newPhone"]');if(label)label.textContent=d.lineUserId?'電話（選填）':'電話';
      const customer=document.getElementById('newCustomer');
      Array.from(customer.options).forEach(option=>{
        const c=S.customers.find(x=>x.id===option.value);option.disabled=!!(d.lineUserId&&c?.hasLine);
      });
      if(customer.selectedOptions[0]?.disabled)customer.value='';
      const existing=!!customer.value;
      document.querySelector('[data-new-customer-fields]').hidden=existing;
      document.getElementById('newName').disabled=existing;document.getElementById('newPhone').disabled=existing;
      rememberDraft();
    };
    select.addEventListener('change',update);update();
  }
  window.YaliLineLinks={refresh,mountNew,state};
  document.addEventListener('focusout',()=>{if(state.pending&&!busy())setTimeout(()=>refresh(),0);});
  if(KEY)refresh();
})();
