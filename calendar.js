/* Calendar API contract: 慎言第十五節 + supplied real-backend mock responses. */
(()=>{
 'use strict';
 const repeatKinds=['無','每日','每週','隔週','每月','每月第幾個','每年','農曆每月','農曆每年'];
 const repeatLabels=['不重複','每天','每週','隔週','每月同一天','每月第幾個星期幾','每年','農曆每月','農曆每年'];
 const weekdays=['日','一','二','三','四','五','六'];
 const reminders=[['-1d@21:00','前一天晚上 9 點'],['-0d@08:00','當天早上 8 點'],['-2h','2 小時前'],['-30m','30 分鐘前']];
 let events=[],eventsRevision=0;
 const tools=document.createElement('div');tools.className='calendar-tools';
 tools.innerHTML='<button type="button" data-cal="new">＋ 我的行程</button><button type="button" data-cal="dayoff" id="calendarDayOff">這天整天不接</button><button type="button" data-cal="list">查看我的行程</button>';
 $('finish').after(tools);
 const lunar=document.createElement('p');lunar.id='calendarLunar';lunar.className='small calendar-lunar';lunar.hidden=true;document.querySelector('.date-line').after(lunar);
 const current=()=>S.dialog?.kind==='calendar'?S.dialog:null;
 const action=(name,label,cls='',attrs='')=>`<button type="button" data-cal="${name}" class="${cls}" ${attrs}>${label}</button>`;
 const check=(name,value,label,checked,attrs='')=>`<label class="check-option"><input type="checkbox" name="${name}" value="${h(value)}" ${checked?'checked':''} ${attrs}>${h(label)}</label>`;
 const lunarDay=n=>n===10?'初十':n===20?'二十':n===30?'三十':n<10?'初'+['','一','二','三','四','五','六','七','八','九'][n]:n<20?'十'+['','一','二','三','四','五','六','七','八','九'][n-10]:'廿'+['','一','二','三','四','五','六','七','八','九'][n-20];
 const dayName=date=>`${shortDate(date)}（${weekday(date)}）`;
 const errorText=r=>r?.code==='SCHEMA'?'請元家先跑「建立雅麗試算表」。':r?.code==='BAD_FN'?'行事曆功能還沒更新，請元家確認後端部署。':r?.code==='VERSION'?'這個行程剛在別處修改過了，請關閉後重新打開，再確認最新內容。':r?.message||'操作沒有完成，請稍後再試。';
 function dayRender(){
  const day=getDay(S.selected);lunar.textContent=day.lunar?'農曆'+day.lunar:'';lunar.hidden=!day.lunar;
  $('calendarDayOff').textContent=(S.selected===S.today?'今天':'這天')+'整天不接';
 }
 function renderItem(item){
  const time=item.allDay?'整天':clock(item.start)+'－'+clock(item.end),locked=item.block!==false;
  return `<article class="appointment event" data-event-id="${h(item.id)}"><div class="appointment-top"><div class="time">${h(time)}</div><span class="pill ${locked?'event-lock':'event-reminder'}">${locked?'🔒 不接客':'只是提醒'}</span></div><div class="customer">${h(item.title||'我的行程')}</div>${item.summary?`<div class="subline">${h(item.summary)}</div>`:''}${item.remindText?`<div class="subline">🔔 ${h(item.remindText)}</div>`:''}${item.movedFrom?`<div class="subline">原本 ${h(dayName(item.movedFrom.slice(0,10)))}</div>`:''}${item.note?`<div class="subline">${h(item.note)}</div>`:''}<div class="appointment-actions">${item.localEventPending?'<p class="small">✅ 已處理，正在更新行程…</p>':action('open','查看／修改行程','',`data-event-id="${h(item.id)}" data-event-date="${h(item.date||S.selected)}"`)}</div></article>`;
 }
 function show(d){openDialog({kind:'calendar',busy:false,error:'',...d});}
 function defaultForm(e={}){
  const start=String(e.start||S.selected||S.today),end=String(e.end||start);
  return {id:e.id||'',version:e.version,title:e.title||'',type:e.type||'私人',allDay:!!e.allDay,block:e.block!==false,startDate:start.slice(0,10),endDate:end.slice(0,10),startTime:start.slice(11,16)||'10:00',endTime:end.slice(11,16)||'11:00',repeat:e.repeat||'無',weekdays:Array.isArray(e.weekdays)?e.weekdays:[weekday(start.slice(0,10))],lunarDays:e.lunarDays||[],until:e.until||'',remind:e.remind===undefined?'-1d@21:00':e.remind,note:e.note||''};
 }
 function describe(f){
  const date=f.startDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '請先選開始日期。';
  const day=Number(date.slice(8)),month=Number(date.slice(5,7));let text;
  if(f.repeat==='每月第幾個')text=`每月第 ${Math.ceil(day/7)} 個星期${weekday(date)}`;
  else if(f.repeat==='每年')text=`每年 ${month} 月 ${day} 日`;
  else if(f.repeat==='每月')text=`每月 ${day} 日`;
  else if(f.repeat==='每週'||f.repeat==='隔週')text=(f.repeat==='隔週'?'隔週':'每週')+(f.weekdays.length?f.weekdays.map(w=>'星期'+w).join('、'):'（請選星期）');
  else if(f.repeat==='農曆每月')text='農曆每月'+(f.lunarDays.length?f.lunarDays.map(lunarDay).join('、'):'（請選日期）');
  else if(f.repeat==='農曆每年'){
   try{const parts=new Intl.DateTimeFormat('zh-TW-u-ca-chinese',{month:'long',day:'numeric',timeZone:'UTC'}).formatToParts(new Date(date+'T12:00:00Z'));text='農曆每年'+parts.filter(p=>['month','day'].includes(p.type)).map(p=>p.value).join('')+'（以開始那天為準）';}
   catch(_){text='農曆每年，以開始那天的農曆月日為準，儲存後顯示完整說明。';}
  }else text=f.repeat==='每日'?'每天':dayName(date);
  text+=' · '+(f.allDay?(f.repeat==='無'&&f.endDate!==date?`${dayName(date)} 至 ${dayName(f.endDate)}，整天`:'整天'):`${f.startTime}～${f.endTime}`);
  if(f.until&&f.repeat!=='無')text+='（重複到 '+dayName(f.until)+'）';
  return text;
 }
 function formHTML(d){
  const f=d.form,once=d.stage==='move';
  return `<form id="calendarForm" class="calendar-form">${once?`<p>${h(d.item.title)} · 原本 ${h(dayName(d.date))}</p>`:`<label for="eventTitle">行程名稱</label><input id="eventTitle" name="title" maxlength="30" required placeholder="例如：回診、拜拜、家裡有事" value="${h(f.title)}"><div class="calendar-shortcuts">${['回診','拜拜','吃藥','家裡有事'].map(t=>action('title',h(t),'',`data-value="${t}"`)).join('')}</div>`}
   ${check('allDay','yes','整天',f.allDay)}
   <div class="calendar-pair"><div><label for="eventDate">${f.allDay?'開始日期':'日期'}</label><input type="date" id="eventDate" name="startDate" value="${h(f.startDate)}" required></div><div id="eventEndDateBox" ${f.allDay?'':'hidden'}><label for="eventEndDate">結束日期</label><input type="date" id="eventEndDate" name="endDate" value="${h(f.endDate)}"></div></div>
   <div class="calendar-pair" id="eventTimeBox" ${f.allDay?'hidden':''}><div><label for="eventStartTime">開始時間</label><input type="time" id="eventStartTime" name="startTime" value="${h(f.startTime)}" required></div><div><label for="eventEndTime">結束時間</label><input type="time" id="eventEndTime" name="endTime" value="${h(f.endTime)}" required></div></div>
   ${once?'':`${check('block','yes','這段時間客人約不到',f.block)}<p class="small">關掉就是只提醒，不會擋住客人的預約。</p><label for="eventRepeat">重複</label><select id="eventRepeat" name="repeat">${repeatKinds.map((k,i)=>`<option value="${k}" ${f.repeat===k?'selected':''}>${repeatLabels[i]}</option>`).join('')}</select><fieldset id="eventWeekBox" ${['每週','隔週'].includes(f.repeat)?'':'hidden'}><legend>哪幾天？</legend><div class="weekday-row">${weekdays.map(w=>`<label><input type="checkbox" name="weekdays" value="${w}" ${f.weekdays.includes(w)?'checked':''}>${w}</label>`).join('')}</div></fieldset><fieldset id="eventLunarBox" ${f.repeat==='農曆每月'?'':'hidden'}><legend>農曆哪幾天？</legend><div class="calendar-shortcuts">${action('lunar-shortcut','初一、十五','','data-days="1,15"')}${action('lunar-shortcut','初二、十六','','data-days="2,16"')}</div><div class="calendar-lunar-days">${Array.from({length:30},(_,i)=>check('lunarDays',i+1,lunarDay(i+1),f.lunarDays.includes(i+1))).join('')}</div></fieldset><div id="eventUntilBox" ${f.repeat==='無'?'hidden':''}><label for="eventUntil">重複到哪一天？（可不填）</label><input type="date" id="eventUntil" name="until" value="${h(f.until)}"></div><fieldset><legend>提前提醒（可多選）</legend>${check('noReminder','yes','不提醒',!f.remind)}${reminders.map(([v,l])=>check('remind',v,l,f.remind.split(',').includes(v))).join('')}</fieldset><label for="eventNote">備註（可不填）</label><textarea id="eventNote" name="note" rows="2">${h(f.note)}</textarea>`}
   <div id="eventSummary" class="calendar-summary">${h(describe(f))}</div><div class="action-stack"><button id="sendFeedbackButton" type="submit" class="primary">${once?'確定修改這一次':f.id?'儲存行程修改':'儲存我的行程'}</button>${action('close','先不要')}</div>
   ${!once&&d.skipped?.length?`<div class="calendar-skipped"><h3>已跳過的日期</h3>${d.skipped.map(date=>`<div class="calendar-skipped-row"><span>${h(dayName(date))}</span>${action('restore','恢復','',`data-date="${h(date)}"`)}</div>`).join('')}</div>`:''}</form>`;
 }
 function clashList(list){return `<ul class="calendar-clashes">${list.map(x=>`<li>${h(dayName(String(x.date||x.start).slice(0,10)))} ${h(clock(x.start))} ${h(x.name||'客人')}</li>`).join('')}</ul>`;}
 function renderDialog(d){
  let title='我的行程',body='';
  if(d.stage==='loading'){title=d.loadingTitle||title;body='<p class="calendar-loading" role="status">正在讀取，稍等一下…</p>';}
  else if(d.stage==='form'||d.stage==='move'){title=d.stage==='move'?'只改這一次':d.form.id?'修改我的行程':'新增我的行程';body=formHTML(d);}
  else if(d.stage==='list'){title='我的行程';body=events.length?`<div class="calendar-event-list">${events.map(e=>action('list-open',`<span><strong>${h(e.title)}</strong><small>${h(e.summary)}</small><small>${e.next?'下次 '+h(longWhen(e.next)):'目前沒有下一次'}${e.remindText?' · 🔔 '+h(e.remindText):''}</small><small>${e.block?'🔒 會擋客人':'只是提醒'}</small></span><span>›</span>`,'',`data-id="${h(e.id)}"`)).join('')}</div>`:'<p class="empty">還沒有自己的行程，先安排一件吧。</p>';body+=`<div class="action-stack">${action('new','＋ 我的行程','primary')}${action('close','回到今天')}</div>`;}
  else if(d.stage==='detail'){
   const e=d.item,repeating=!!e.repeating||(e.repeat&&e.repeat!=='無');title=e.title||'我的行程';
   body=`<div class="calendar-summary">${h(e.summary||longWhen(e.start))}</div><p>${e.block!==false?'🔒 這段時間客人約不到':'只是提醒，不擋客人'}</p>${e.remindText?`<p>🔔 ${h(e.remindText)}</p>`:''}${e.movedFrom?`<p>原本 ${h(dayName(e.movedFrom.slice(0,10)))}</p>`:''}${e.note?`<p>${h(e.note)}</p>`:''}<div class="action-stack">${repeating?`${action('move','只改這一次','primary')}${action('ask-skip','跳過這一次')}${action('edit','改整個系列')}`:action('edit','修改行程','primary')}${action('delete-menu','刪除行程','danger')}${action('close','回到今天')}</div>`;
  }else if(d.stage==='deleteMenu'){
   title='要刪除哪些行程？';body=`<p>${h(d.item.title)}</p><div class="action-stack">${action('ask-skip','只刪這一次（跳過）')}${action('ask-future','這天以後都不要了','danger')}${action('ask-all','刪除整個系列','danger')}${action('detail','先不要')}</div>`;
  }else if(d.stage==='confirm'){
   title=d.question;body=`<p>${h(d.item?.title||dayName(d.date))}</p>${d.fn==='apiDayOff'?'<p>已經約好的客人不會自動取消，排好後會列給您看。</p>':''}<div class="action-stack">${action('confirm-write',h(d.confirmLabel||'確定'),d.fn==='apiEventDelete'?'danger':'primary','id="sendFeedbackButton"')}${action('back','先不要')}</div>`;
  }else if(d.stage==='conflict'){
   title='這個行程會撞到客人';body=`<p>這幾位客人已經有預約：</p>${clashList(d.clashes)}<p>照樣安排也不會取消客人的預約，記得另外聯絡他們。</p><div class="action-stack">${action('force','還是要排（客人的預約不會被取消）','danger','id="sendFeedbackButton"')}${action('back-form','回去改')}</div>`;
  }else if(d.stage==='receipt'){
   title=d.receiptTitle||'行程已安排';body=`<div class="calendar-receipt">✅ ${h(d.receipt||'已完成')}</div>${d.contacts?.length?`<p>這天已經有 ${d.contacts.length} 位客人，預約都還在：</p>${clashList(d.contacts)}<p><strong>記得聯絡這幾位客人。</strong></p>`:''}<div class="action-stack">${d.resume? action('resume','繼續修改系列','primary'):''}${action('close','我知道了','primary')}</div>`;
  }
  $('dialogTitle').textContent=title;$('dialogBody').innerHTML=`${d.error?`<p class="modal-message" role="alert">${h(d.error)}</p>`:''}${body}`;
  if(d.renderedStage!==d.stage){document.querySelector('#overlay .sheet').scrollTop=0;d.renderedStage=d.stage;}
  const form=$('calendarForm');if(form){form.onsubmit=e=>{e.preventDefault();submit();};form.addEventListener('input',e=>formChanged(e.target));form.addEventListener('change',e=>formChanged(e.target));}
 }
 function readForm(){
  const form=$('calendarForm'),data=new FormData(form),f=current().form;
  return {...f,title:data.has('title')?String(data.get('title')).trim():f.title,allDay:data.has('allDay'),block:data.has('block')||current().stage==='move'&&f.block,startDate:String(data.get('startDate')||''),endDate:String(data.get('endDate')||data.get('startDate')||''),startTime:String(data.get('startTime')||''),endTime:String(data.get('endTime')||''),repeat:String(data.get('repeat')||f.repeat),weekdays:data.getAll('weekdays').map(String),lunarDays:data.getAll('lunarDays').map(Number),until:String(data.get('until')||''),remind:data.has('noReminder')?'':data.getAll('remind').join(','),note:data.has('note')?String(data.get('note')).trim():f.note};
 }
 function formChanged(target=document.activeElement){
  const d=current();if(!d||d.busy)return;d.opId=null;d.forceOpId=null;
  if(target?.name==='weekdays')d.weekdaysTouched=true;
  if(target?.name==='noReminder'&&target.checked)document.querySelectorAll('[name=remind]').forEach(x=>x.checked=false);
  if(target?.name==='remind'&&target.checked){const none=document.querySelector('[name=noReminder]');if(none)none.checked=false;}
  const f=readForm();d.form=f;
  if(target?.name==='startDate'&&!f.id&&!d.weekdaysTouched&&d.stage==='form'&&f.startDate){f.weekdays=[weekday(f.startDate)];document.querySelectorAll('[name=weekdays]').forEach(x=>x.checked=f.weekdays.includes(x.value));}
  if(target?.name==='startDate'&&f.endDate<f.startDate){f.endDate=f.startDate;$('eventEndDate').value=f.endDate;}
  $('eventEndDateBox').hidden=!f.allDay;$('eventTimeBox').hidden=f.allDay;
  for(const id of ['eventStartTime','eventEndTime'])$(id).required=!f.allDay;
  $('eventEndDate').required=f.allDay;
  if($('eventWeekBox'))$('eventWeekBox').hidden=!['每週','隔週'].includes(f.repeat);
  if($('eventLunarBox'))$('eventLunarBox').hidden=f.repeat!=='農曆每月';
  if($('eventUntilBox'))$('eventUntilBox').hidden=f.repeat==='無';
  $('eventSummary').textContent=describe(f);
 }
 function formRequest(d){
  const f=readForm();d.form=f;
  if(!f.title)throw Error('請填行程名稱');
  if(!f.startDate||f.allDay&&(!f.endDate||f.endDate<f.startDate))throw Error('請確認開始和結束日期。');
  if(!f.allDay&&(!f.startTime||!f.endTime||f.endTime<=f.startTime))throw Error('結束時間要晚於開始時間。');
  if(d.stage!=='move'&&['每週','隔週'].includes(f.repeat)&&!f.weekdays.length)throw Error('請至少選一個星期。');
  if(d.stage!=='move'&&f.repeat==='農曆每月'&&!f.lunarDays.length)throw Error('請至少選一個農曆日期。');
  if(f.until&&f.until<f.startDate)throw Error('重複到的日期不能早於開始日。');
  const start=f.allDay?f.startDate:f.startDate+' '+f.startTime,end=f.allDay?f.endDate:f.startDate+' '+f.endTime;
  d.opId=d.opId||makeOpId();
  if(d.stage==='move')return {opId:d.opId,id:d.item.id,date:d.date,action:'move',start,end};
  return {opId:d.opId,...(f.id?{id:f.id,version:f.version}:{}),title:f.title,type:f.type,allDay:f.allDay,start,end,block:f.block,repeat:f.repeat,weekdays:['每週','隔週'].includes(f.repeat)?f.weekdays:[],lunarDays:f.repeat==='農曆每月'?f.lunarDays:[],until:f.repeat==='無'?'':f.until,remind:f.remind,note:f.note};
 }
 async function submit(){const d=current();if(!d||d.busy)return;try{const req=formRequest(d);d.returnStage=d.stage;await write(d.stage==='move'?'apiEventOnce':'apiEventSave',req);}catch(e){d.error=e.message;renderDialog(d);}}
 async function edit(item,resume){
  const d={kind:'calendar',stage:'loading',busy:false,item,loadingTitle:'讀取行程'};show(d);const live=current();
  try{const r=await call('apiEventGet',item.id);if(current()!==live)return;if(!r?.ok)throw Error(errorText(r));
   live.form=resume?{...resume,version:r.event.version}:defaultForm(r.event);live.item={...item,...r.event};live.skipped=r.event.skipped||[];live.stage='form';renderDialog(live);
  }catch(e){if(current()===live){live.stage='detail';live.error=e.message;renderDialog(live);}}
 }
 async function list(){show({stage:'loading',loadingTitle:'我的行程'});const d=current(),revision=eventsRevision;try{const r=await call('apiEvents');if(current()!==d||revision!==eventsRevision)return;if(!r?.ok)throw Error(errorText(r));events=(r.items||[]).slice().sort((a,b)=>(a.next||'9999').localeCompare(b.next||'9999'));d.stage='list';renderDialog(d);}catch(e){if(current()===d){events=[];d.stage='list';d.error=e.message;renderDialog(d);}}}
 function ask(fn,req,question,label){const d=current();Object.assign(d,{priorStage:d.stage,stage:'confirm',fn,request:req,question,confirmLabel:label,error:''});renderDialog(d);}
 async function write(fn,req){
  const d=current();if(!d||d.busy)return;d.busy=true;d.error='';d.fn=fn;d.request=req;
  try{
   const r=await call(fn,req);if(current()!==d)return;
   if(!r?.ok){if(r?.code==='CONFLICT'){d.clashes=r.extra?.clashes||[];d.stage='conflict';}else d.error=errorText(r);d.busy=false;renderDialog(d);return;}
   d.busy=false;d.contacts=r.existing||r.clashes||[];d.receipt=r.event?.summary||({apiDayOff:'這天已設為整天不接客',apiEventDelete:'已刪除行程',apiEventOnce:req.action==='skip'?'已跳過這一次':req.action==='restore'?'已恢復這一次':'已修改這一次'})[fn]||'行程已儲存';d.receiptTitle='已完成';d.stage='receipt';renderDialog(d);
   void loadDays(S.selected,false);
  }catch(e){if(current()===d){d.busy=false;d.error=e.message||'連線失敗，請稍後再試。';renderDialog(d);}}
 }
 // The server has accepted the write. Invalidate reads begun before it and
 // remove old actionable rows before the shared one-second success pause.
 function applied(fn,req,r){
  if(!['apiEventSave','apiEventOnce','apiEventDelete','apiDayOff'].includes(fn))return;
  bookingWriteRevision++;eventsRevision++;
  const id=req.id||r.event?.id,prior=[];
  for(const day of S.days){day.items=(day.items||[]).filter(item=>{if(item.kind!=='event'||item.id!==id)return true;const date=item.date||day.date;const affected=fn==='apiEventOnce'?date===req.date||item.movedFrom===req.date:fn==='apiEventDelete'&&req.mode==='future'?date>=req.date:true;if(affected)prior.push({day,item});return !affected;});}
  events=events.filter(e=>e.id!==id);
  if(fn==='apiEventSave'||fn==='apiDayOff'||fn==='apiEventOnce'&&req.action==='move'){
   const date=(req.start||req.date||S.selected).slice(0,10),day=S.days.find(d=>d.date===date),old=prior[0]?.item||{};
   if(day){const allDay=fn==='apiDayOff'||(req.allDay===undefined?String(req.start||'').length===10:req.allDay);day.items.push({...old,kind:'event',id,date,title:req.title||old.title||(fn==='apiDayOff'?'今天不接客':'行程已更新'),start:allDay?date+' 00:00':req.start,end:req.end||(date+' 23:59'),allDay,block:req.block??old.block??true,summary:r.event?.summary||'已完成，正在更新行程…',repeat:req.repeat||old.repeat||'無',localEventPending:true});}
  }
  renderHome();
 }
 document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-cal]');if(!button||button.disabled||!KEY)return;const a=button.dataset.cal,d=current();if(d?.busy)return;
  try{
   if(a==='new')show({stage:'form',form:defaultForm(),skipped:[]});
   else if(a==='list')await list();
   else if(a==='open'){const item=getItem(button.dataset.eventId,button.dataset.eventDate);if(item)show({stage:'detail',item,date:item.date||S.selected});}
   else if(a==='list-open'){const item=events.find(x=>x.id===button.dataset.id);if(item){if(!item.next)await edit(item);else show({stage:'detail',item:{...item,date:item.next.slice(0,10),start:item.next,repeating:item.repeat!=='無'},date:item.next.slice(0,10)});}}
   else if(a==='close')closeDialog();
   else if(a==='dayoff'){show({stage:'loading',date:S.selected});ask('apiDayOff',{opId:makeOpId(),date:S.selected},S.selected===S.today?'今天整天都不接客人了嗎？':'這天整天都不接客人了嗎？','確定整天不接');}
   else if(a==='edit')await edit(d.item);
   else if(a==='detail'){d.stage='detail';d.error='';renderDialog(d);}
   else if(a==='title'){$('eventTitle').value=button.dataset.value;formChanged();}
   else if(a==='lunar-shortcut'){const chosen=button.dataset.days.split(',').map(Number);document.querySelectorAll('[name=lunarDays]').forEach(x=>x.checked=chosen.includes(Number(x.value)));formChanged();}
   else if(a==='move'){
    let item=d.item;
    if(!item.end){d.stage='loading';renderDialog(d);const r=await call('apiEventGet',item.id);if(current()!==d)return;if(!r?.ok){d.stage='detail';throw Error(errorText(r));}item={...item,...r.event};const startClock=String(r.event.start).slice(11),endClock=String(r.event.end).slice(11);item.start=d.date+(startClock?' '+startClock:'');item.end=d.date+(endClock?' '+endClock:'');}
    d.form=defaultForm({...item,start:item.start||d.date+' 10:00',end:item.end||d.date+' 11:00'});d.stage='move';d.error='';d.opId=null;renderDialog(d);
   }
   else if(a==='delete-menu'){if(d.item.repeating||d.item.repeat&&d.item.repeat!=='無'){d.stage='deleteMenu';renderDialog(d);}else ask('apiEventDelete',{opId:makeOpId(),id:d.item.id,mode:'all'},d.item.type==='休息'?'要恢復這天接客嗎？':'要刪除這個行程嗎？','確定刪除');}
   else if(a==='ask-skip')ask('apiEventOnce',{opId:makeOpId(),id:d.item.id,date:d.date,action:'skip'},'要跳過這一次行程嗎？','確定跳過這一次');
   else if(a==='ask-future')ask('apiEventDelete',{opId:makeOpId(),id:d.item.id,mode:'future',date:d.date},'這天以後都不要這個行程了嗎？','刪除這天以後的行程');
   else if(a==='ask-all')ask('apiEventDelete',{opId:makeOpId(),id:d.item.id,mode:'all'},'要刪除整個行程系列嗎？','刪除全部');
   else if(a==='confirm-write')await write(d.fn,d.request);
   else if(a==='force'){d.forceOpId=d.forceOpId||makeOpId();await write(d.fn,{...d.request,opId:d.forceOpId,force:true});}
   else if(a==='back-form'){d.stage=d.returnStage||'move';d.error='';d.opId=null;d.forceOpId=null;renderDialog(d);}
   else if(a==='back'){if(d.fn==='apiDayOff')closeDialog();else{d.stage=d.priorStage;d.error='';renderDialog(d);}}
   else if(a==='restore'){d.returnStage='form';d.form=readForm();d.resume={...d.form};ask('apiEventOnce',{opId:makeOpId(),id:d.form.id,date:button.dataset.date,action:'restore'},'要恢復這一次行程嗎？','確定恢復');}
   else if(a==='resume')await edit(d.item,d.resume);
  }catch(err){if(current()){current().error=err.message;renderDialog(current());}else flash(err.message,'error');}
 });
 window.YaliCalendar={renderHome:dayRender,renderItem,renderDialog,applied,isBusy:()=>!!current()};
 dayRender();
})();
