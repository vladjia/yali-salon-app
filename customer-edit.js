/* Customer name/phone only; no persistence, telemetry, or booking/LINE writes. */
(()=>{
 'use strict';let revision=0;
 const current=()=>S.dialog?.kind==='customerEdit'?S.dialog:null;
 function button(customer={},fallback=''){
  const id=customer.id||fallback;if(!id)return '';
  return `<button type="button" class="customer-edit-button" data-customer-edit="${h(id)}" ${current()?.busy&&current().customerId===id?'disabled':''}>改稱呼、電話</button>`;
 }
 function find(id){
  for(const day of S.days)for(const item of day.items||[])if(item.kind!=='event'&&(item.customer?.id||item.booking?.customerId)===id)return {...item.customer,id};
  return S.customers.find(c=>c.id===id)||window.YaliRequests?.getCustomer(id);
 }
 function setCustomer(d,c){d.customerId=c.id;d.old={name:c.name||'',phone:c.phone||''};d.form={...d.old};d.opId=null;d.forceOpId=null;d.request=null;d.stage='form';}
 function open(c){if(!c?.id)return;const d={kind:'customerEdit',busy:false,error:'',note:'',stage:'form'};setCustomer(d,c);openDialog(d);}
 function renderDialog(d){
  document.querySelector('#overlay .sheet > .send-feedback')?.remove();
  $('dialogTitle').textContent='改客人稱呼、電話';
  let body='';
  if(d.stage==='loading')body='<p role="status">正在讀取最新客人資料…</p>';
  else if(d.stage==='version')body='<p>重新讀取後，會顯示最新的稱呼與電話，再修改就好。</p><div class="action-stack"><button type="button" data-customer-action="reload" class="primary">重新讀取再修改</button><button type="button" data-act="close">先不要</button></div>';
  else if(d.stage==='duplicate')body=`<p class="customer-duplicate">這支電話已經是「${h(d.duplicateName||'另一位客人')}」的。是家人共用嗎？</p><div class="action-stack"><button type="button" data-customer-action="force" id="sendFeedbackButton" class="primary">是，照樣存</button><button type="button" data-customer-action="back">我再看看</button></div>`;
  else body=`<p class="small">只改這位客人的稱呼與電話，原本的預約會保留。</p><form id="customerEditForm"><label for="customerEditName">客人稱呼</label><input id="customerEditName" name="name" maxlength="20" required autocomplete="off" value="${h(d.form.name)}" placeholder="例如：黃小姐"><p class="small">必填，最多 20 字。</p><label for="customerEditPhone">電話（選填）</label><input id="customerEditPhone" name="phone" type="tel" inputmode="tel" maxlength="40" autocomplete="off" value="${h(d.form.phone)}" placeholder="沒有電話可以留白"><p class="small">可填空白、- 或括號，存好後會整理成數字。</p><div class="action-stack"><button type="submit" id="sendFeedbackButton" class="primary">存好</button><button type="button" data-act="close">先不要</button></div></form>`;
  $('dialogBody').innerHTML=`${d.error?`<p class="modal-message" role="alert">${h(d.error)}</p>`:''}${d.note?`<p class="small" role="status">${h(d.note)}</p>`:''}${body}`;
  const form=$('customerEditForm');if(form){form.onsubmit=e=>{e.preventDefault();save();};form.oninput=()=>{d.form=values();d.opId=null;d.forceOpId=null;};}
  if(d.busy)$('dialogBody').querySelectorAll('button,input').forEach(el=>el.disabled=true);
 }
 function values(){return {name:$('customerEditName').value.trim(),phone:$('customerEditPhone').value.trim()};}
 function request(d){
  const v=values();d.form=v;
  if(!v.name||v.name.length>20)throw Error('請填 1～20 字的客人稱呼。');
  const digits=v.phone.replace(/[\s()-]/g,'');if(v.phone&&!/^\d{8,12}$/.test(digits))throw Error('電話請填 8～12 個數字，可加空白、- 或括號。');
  d.opId=d.opId||makeOpId();return {opId:d.opId,customerId:d.customerId,name:v.name,phone:v.phone,old:{...d.old},force:false};
 }
 async function save(){const d=current();if(!d||d.busy)return;try{await send(d,request(d));}catch(e){if(current()===d){d.error=e.message;renderDialog(d);}}}
 async function send(d,req){
  if(d.busy)return;d.busy=true;d.error='';d.request=req;
  try{
   const r=await call('apiCustomerEdit',req);if(current()!==d)return;d.busy=false;
   if(!r?.ok){
    if(r?.code==='FORBIDDEN'){document.querySelector('#overlay .sheet > .send-feedback')?.remove();closeDialog(true);return;}
    if(r?.code==='DUP_PHONE'){d.stage='duplicate';d.duplicateName=r.extra?.name||'另一位客人';}
    else if(r?.code==='VERSION'){d.stage='version';d.error='這位客人的資料剛剛被改過了，請重新整理再改。';}
    else d.error=r?.message||({BUSY:'系統正在處理，請稍等幾秒再按一次。',NOT_FOUND:'找不到這位客人，請關閉後更新名單。',FORBIDDEN:'請用元家給的連結打開。',BAD_FN:'客人資料修改還沒更新，請元家確認後端部署。'})[r?.code]||'還沒存好，請稍後再試。';
    renderDialog(d);return;
   }
   document.querySelector('#overlay .sheet > .send-feedback')?.remove();closeDialog(true);renderHome();if(r.changed!==false)flash('✅ 客人稱呼與電話已存好','success');
   void refreshCustomers();void loadDays(S.selected,true);
  }catch(e){if(current()===d){d.busy=false;d.error=e.message||'連線失敗，請稍後再試。';renderDialog(d);}}
 }
 async function refreshCustomers(){
  const started=revision;try{const r=await call('apiCustomers');if(started===revision&&r?.ok&&Array.isArray(r.customers))S.customers=r.customers;}catch(_){/* The accepted local update stays visible; next normal read can refresh it. */}
 }
 async function reload(){
  const d=current();if(!d||d.busy)return;d.busy=true;d.stage='loading';d.error='';renderDialog(d);
  try{const r=await call('apiCustomers');if(current()!==d)return;if(!r?.ok||!Array.isArray(r.customers))throw Error(r?.message||'客人資料暫時讀不到，請再試一次。');const c=r.customers.find(c=>c.id===d.customerId);if(!c)throw Error('找不到這位客人，請關閉後更新名單。');S.customers=r.customers;setCustomer(d,c);d.note='已讀取最新資料，請確認後再修改。';d.busy=false;applied('apiCustomerEdit',null,{customer:c});renderDialog(d);}catch(e){if(current()===d){d.busy=false;d.stage='version';d.error=e.message;renderDialog(d);}}
 }
 function applied(fn,req,r){
  if(fn!=='apiCustomerEdit'||!r?.customer)return;
  const c=r.customer;if(!c.id)return;revision++;bookingWriteRevision++;
  // Replace only the returned public-to-this-admin fields; keep booking and LINE state.
  const patch={id:c.id,name:c.name,phone:c.phone||''};
  for(const day of S.days)for(const item of day.items||[])if(item.kind!=='event'&&(item.customer?.id||item.booking?.customerId)===c.id)item.customer={...item.customer,...patch};
  S.customers=S.customers.map(old=>old.id===c.id?{...old,...patch}:old);window.YaliRequests?.updateCustomer(patch);renderHome();
 }
 document.addEventListener('click',async e=>{
  if(!KEY)return;const edit=e.target.closest('[data-customer-edit]');if(edit&&!edit.disabled&&!S.dialog){const c=find(edit.dataset.customerEdit);if(c)open(c);else flash('客人資料還沒讀到，請按更新再試。','error');return;}
  const control=e.target.closest('[data-customer-action]'),d=current();if(!control||control.disabled||!d||d.busy)return;
  if(control.dataset.customerAction==='back'){d.stage='form';d.error='';d.forceOpId=null;renderDialog(d);}
  else if(control.dataset.customerAction==='reload')await reload();
  else if(control.dataset.customerAction==='force'){d.forceOpId=d.forceOpId||makeOpId();await send(d,{...d.request,opId:d.forceOpId,force:true});}
 });
 window.YaliCustomer={button,renderDialog,applied,revision:()=>revision};
})();
