/* Shared visual feedback only: one request, no automatic retry. */
(()=>{
 const writes=new Set(['apiTransition','apiReschedule','apiCreate','apiRecurringOnce','apiRecurringSkip','apiRecurringUnskip','apiRecurringChange','apiLinkLine','apiLineIgnore','apiLineUnlink','apiPriceSave','apiEventSave','apiEventOnce','apiEventDelete','apiDayOff','apiCustomerEdit']);
 let clicked=null;
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!b.disabled)clicked=b;},true);
 function begin(scope,button){
  const id=typeof S!=='undefined'?S.dialog?.item?.id:null;
  const related=id?[...document.querySelectorAll('[data-booking-id="'+CSS.escape(id)+'"] button,[data-event-id="'+CSS.escape(id)+'"] button,[data-id="'+CSS.escape(id)+'"]')]:[];
  const customerId=typeof S!=='undefined'&&S.dialog?.kind==='customerEdit'?S.dialog.customerId:null;
  if(customerId)related.push(...document.querySelectorAll('[data-customer-edit="'+CSS.escape(customerId)+'"]'));
  const controls=[...new Set([...scope.querySelectorAll('button,input,select,textarea'),...related])].map(el=>({el,disabled:el.disabled}));controls.forEach(x=>x.el.disabled=true);
  const old=button?.innerHTML;
  let note=scope.querySelector('.send-feedback');if(!note){note=document.createElement('p');note.className='send-feedback';note.setAttribute('role','status');scope.append(note);}
  function show(text,state){if(button?.isConnected){button.textContent=text;button.classList.toggle('send-processing',state==='busy');button.disabled=true;}note.textContent=text;note.className='send-feedback '+state;}
  show('⏳ 處理中…','busy');const timer=setTimeout(()=>show('網路比較慢，還在處理…','busy'),8000);
  return {async finish(ok,text){clearTimeout(timer);show(text||(ok?'✅ 已完成':'操作未完成，請稍後再試。'),ok?'success':'error');if(ok)await new Promise(r=>setTimeout(r,1000));controls.forEach(x=>{if(x.el.isConnected)x.el.disabled=x.disabled;});if(button?.isConnected){button.classList.remove('send-processing');if(!ok)button.innerHTML=old;}}};
 }
 function current(){
  const scope=document.querySelector('#lineLinkDialog[open]')||document.querySelector('#overlay:not([hidden]) .sheet')||document.querySelector('#mask.on .sheet')||document.querySelector('#mask.on')||clicked?.closest('.appointment,.panel')||document.body;
  const button=scope.querySelector('#sendFeedbackButton')||scope.querySelector('#lineSubmit')||scope.querySelector('#go')||(clicked?.isConnected&&scope.contains(clicked)?clicked:null)||scope.querySelector('button');return{scope,button};
 }
 function success(fn,args){if(fn==='apiTransition')return({CONFIRMED:'✅ 已確認',REJECTED:'✅ 已拒絕',CANCELLED:'✅ 已取消',COMPLETED:'✅ 已完成'})[args[0]?.to]||'✅ 已更新';if(fn==='apiEventOnce')return({skip:'✅ 已跳過',restore:'✅ 已恢復',move:'✅ 已修改這一次'})[args[0]?.action];return({apiCreate:'✅ 已新增',apiReschedule:'✅ 已修改時間',apiPriceSave:'✅ 已儲存',apiLinkLine:'✅ 已連到客人',apiLineIgnore:'✅ 已略過',apiLineUnlink:'✅ 已取消連接',apiEventSave:'✅ 已儲存行程',apiEventDelete:'✅ 已刪除行程',apiDayOff:'✅ 已設為整天不接客',apiCustomerEdit:'✅ 已存好'})[fn]||'✅ 已更新';}
 async function run(fn,args,operation){
  if(!writes.has(fn))return operation();const {scope,button}=current(),feedback=begin(scope,button);
  try{const result=await operation();if(result?.ok){window.YaliMonth?.invalidate();window.YaliCustomer?.applied(fn,args[0],result);if(typeof applySuccessfulBookingWrite==='function')applySuccessfulBookingWrite(fn,args[0],result);window.YaliCalendar?.applied(fn,args[0],result);}await feedback.finish(!!result?.ok,result?.ok?success(fn,args):(result?.message||'操作未完成，請看下方原因。'));return result;}
  catch(e){await feedback.finish(false,e.message||'連線失敗，請稍後再試。');throw e;}
 }
 window.YaliSendFeedback={begin,run};
})();
