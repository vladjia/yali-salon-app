/* Dedicated pending list, independent of the selected date. */
(()=>{
 const panel=document.createElement('section');panel.id='bookingRequests';panel.className='panel';panel.hidden=true;document.querySelector('main .header').after(panel);
 let items=[],loading=false,again=false,error='',revision=0;
 async function refresh(){
  if(!KEY)return;if(loading){again=true;return;}loading=true;const startedRevision=revision;
  try{const r=await call('apiPendingList');if(!r?.ok||!Array.isArray(r.items))throw Error(r?.code==='BAD_FN'?'新申請功能還沒更新，請元家確認後端部署。':'新申請暫時更新不到，請按上方「更新」重試。');if(startedRevision!==revision){again=true;return;}items=r.items;error='';}
  catch(e){error=e.message||'新申請更新失敗，請稍後再試。';}
  finally{loading=false;if(!refreshBusy())render();if(again){again=false;refresh();}}
 }
 function render(){
  const open=panel.querySelector('details')?.open;panel.hidden=!items.length&&!error;if(panel.hidden){panel.replaceChildren();return;}
  panel.innerHTML=`${items.length?`<details ${open?'open':''}><summary>🔔 有 ${items.length} 筆新申請</summary><div class="request-list">${items.map((item,i)=>`<article class="request-row pending-request" data-booking-id="${h(item.id)}"><div><strong>${h(item.customer?.name||'客人')}</strong>${window.YaliCustomer?.button(item.customer)||''}<p class="small">${h(item.start)} ～ ${h((item.end||'').slice(11))}</p><p>${h((item.services||[]).join(' ＋ '))}</p>${item.holdExpired?'<p class="pending-expired">保留時間過了，確認前會重新檢查時段。</p>':''}<p class="small">申請時間：${h(item.createdAt||'')}</p></div><div class="pending-actions"><button type="button" class="good" data-pending-index="${i}" data-pending-to="CONFIRMED">確認申請</button><button type="button" class="danger" data-pending-index="${i}" data-pending-to="REJECTED">拒絕</button></div></article>`).join('')}</div></details>`:''}${error?`<p class="small" role="status">${h(error)}${items.length?' 目前保留上次讀到的清單。':''}</p>`:''}`;
  panel.querySelectorAll('[data-pending-index]').forEach(button=>button.onclick=()=>{
   const item=items[Number(button.dataset.pendingIndex)],to=button.dataset.pendingTo;
   const adapted={kind:'booking',id:item.id,start:item.start,end:item.end,customer:item.customer,services:item.services,booking:{...item.booking,id:item.id,version:item.version}};
   openSimple(adapted,'transition',to==='CONFIRMED'?'要確認這筆預約申請嗎？':'確定要拒絕這筆申請嗎？',{to,danger:to==='REJECTED'});
  });
 }
 window.YaliRequests={render,refresh,getCustomer(id){return items.find(i=>i.customer?.id===id)?.customer;},updateCustomer(customer){revision++;items=items.map(i=>i.customer?.id===customer.id?{...i,customer:{...i.customer,...customer}}:i);render();},dismiss(id){revision++;items=items.filter(item=>item.id!==id);render();}};render();refresh();
 document.addEventListener('focusout',()=>setTimeout(()=>{if(!refreshBusy())render();},0));
})();
