/* Notification permission and subscription writes require an explicit click. */
(()=>{
 const panel=document.createElement('section');panel.id='pushSettings';panel.className='push-settings';panel.hidden=true;document.querySelector('.header-actions').after(panel);
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 const supported=()=>window.isSecureContext&&'Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window;
 let info=null,sub=null,busy=false,registered=false,message='',offEndpoint='',settingsOpen=false,confirmOff=false,actionError=false;
 function render(){
  panel.hidden=!KEY;if(panel.hidden)return;
  const canPush=standalone()&&supported();
  const denied=canPush&&Notification.permission==='denied';
  let status='',controls='';
  if(!standalone())status='🔔 先加到主畫面，再從主畫面開啟，就能設定通知。';
  else if(!supported())status='這個裝置或瀏覽器暫不支援 App 通知。';
  else{
   status=message||(registered?'✅ 通知已開啟':denied?'通知權限已關閉，請到手機或瀏覽器設定允許通知。':info?.on&&info?.publicKey?'有新申請或改期消息，讓手機提醒您。':'通知還沒設定好，請元家確認設定。');
   controls=registered?(confirmOff?'<p>關掉之後，有新的預約申請時手機不會提醒您。確定要關嗎？</p><div class="push-actions"><button type="button" data-push="keep">先不要</button><button type="button" class="danger" data-push="off">確定關閉</button></div>':'<div class="push-actions"><button type="button" data-push="test">送一則測試</button><button type="button" data-push="ask-off">關閉通知</button></div>'):offEndpoint?'<button type="button" data-push="off">重試關閉通知</button>':info?.on&&info?.publicKey&&!denied?'<button type="button" data-push="on">🔔 開啟通知</button>':'';
   if(!info)controls+='<button type="button" data-push="refresh">重新檢查</button>';
  }
  panel.innerHTML=`<div class="push-status-line"><button type="button" class="push-settings-toggle" data-push="settings" aria-expanded="${settingsOpen}" aria-controls="pushOptions">設定</button></div>${!registered&&!settingsOpen?`<p class="small ${actionError?'send-error':''}" role="status">${h(status)}</p><div class="push-actions">${controls}</div>`:''}${settingsOpen?`<div id="pushOptions" class="push-options"><a class="button-link guide-link" href="guide.html" target="_self">📖 使用小抄</a><p class="small ${actionError?'send-error':''}" role="status">${h(status)}</p>${controls}<p class="small app-version">版本 v13</p></div>`:''}`;
  panel.querySelectorAll('[data-push]').forEach(button=>{button.disabled=busy;button.onclick=()=>act(button.dataset.push);});
 }
 function keyBytes(value){const s=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}
 async function inspect(force=false){
  if(!KEY || (busy&&!force))return;try{const r=await call('apiPushInfo');if(busy&&!force)return;if(!r?.ok)throw Error('通知設定暫時讀取不到，請稍後重新檢查。');info=r;
   if(standalone()&&supported()){
    const reg=await navigator.serviceWorker.getRegistration('./');sub=reg?await reg.pushManager.getSubscription():null;
    registered=!!info.on&&!!sub&&Notification.permission==='granted'&&(info.devices||[]).some(d=>String(d.endpointTail||'').length>=8&&sub.endpoint.endsWith(d.endpointTail));
   }
  }catch(e){message=e.message;}render();
 }
 async function act(action){
  if(busy)return;
  if(action==='settings'){settingsOpen=!settingsOpen;confirmOff=false;render();return;}
  if(action==='ask-off'){confirmOff=true;message='';render();return;}
  if(action==='keep'){confirmOff=false;render();return;}
  // Keep the permission request directly in the user's click, before any network wait.
  const permission=action==='on'?Notification.requestPermission():null;
  busy=true;actionError=false;message='正在處理，請稍等…';render();
  const feedback=action==='refresh'?null:YaliSendFeedback.begin(panel,panel.querySelector('[data-push="'+action+'"]'));
  try{
   if(action==='refresh'){message='';await inspect(true);return;}
   if(action==='on'){
    if(await permission!=='granted')throw Error('還沒有允許通知；需要時可再從這裡開啟。');
    const reg=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
    const r=await call('apiPushInfo');if(!r?.ok||!r.on||!r.publicKey)throw Error('通知還沒設定好，請元家確認設定。');info=r;
    sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(info.publicKey)});
    const label=/iPhone|iPad|iPod/.test(navigator.userAgent)?'媽媽的 iPhone':/Android/.test(navigator.userAgent)?'媽媽的 Android':'媽媽的裝置';
    const saved=await call('apiPushSubscribe',{subscription:sub.toJSON(),label});
    if(!saved?.ok)throw Error(saved?.code==='BAD_INPUT'?'通知資料還沒存好，請再按一次開啟通知。':'通知登記未完成，請再按一次開啟通知。');
    registered=true;message='';settingsOpen=false;confirmOff=false;
   }else if(action==='test'){
    const r=await call('apiPushTest');if(!r?.ok)throw Error('測試通知還沒送出，請稍後再試。');
    actionError=Number(r.failed)>0||!Number(r.sent);
    message=Number(r.failed)>0?`測試已送出 ${Number(r.sent)||0} 則，${Number(r.failed)} 則未成功。`:Number(r.sent)>0?'測試通知已送出，請看看手機有沒有收到。':'這次沒有送出通知，請元家確認後端推播設定。';
   }else if(action==='off'){
    offEndpoint=offEndpoint||sub?.endpoint||'';
    if(!offEndpoint)throw Error('這支手機沒有通知訂閱。');
    if(sub){const removed=await sub.unsubscribe();if(!removed)throw Error('手機通知尚未關閉，請再試一次。');sub=null;registered=false;}
    const r=await call('apiPushUnsubscribe',{endpoint:offEndpoint});if(!r?.ok)throw Error('手機已停用通知，伺服器清理尚未完成，請按「重試關閉通知」。');
    offEndpoint='';message='這支手機的通知已關閉。';settingsOpen=false;confirmOff=false;
   }
    if(feedback)await feedback.finish(!actionError,actionError?message:action==='on'?'✅ 已開啟通知':action==='off'?'✅ 已關閉通知':'✅ 測試已處理');
  }catch(e){actionError=true;message=e.message||'操作尚未完成，請稍後再試。';if(feedback)await feedback.finish(false,message);}
  finally{busy=false;render();}
 }
 window.YaliPush={refresh:inspect,isBusy:()=>busy};render();inspect();
})();
