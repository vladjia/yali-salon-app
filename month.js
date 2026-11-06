/* Read-only monthly overview. Private data stays in memory behind the existing key. */
(()=>{
 'use strict';
 let active=false,month='',data=null,loading=false,dayLoading=false,error='',request=0,epoch=0,dirty=false,lastKey=KEY;
 const cache=new Map();
 const tabs=document.querySelector('.day-tabs'),panel=tabs.parentElement;
 const tab=document.createElement('button');tab.id='tabMonth';tab.type='button';tab.dataset.month='open';tab.textContent='整個月';tab.setAttribute('aria-controls','monthView');tab.setAttribute('aria-expanded','false');tabs.append(tab);
 const controls=document.createElement('div');controls.className='calendar-day-controls';
 while(tabs.nextSibling)controls.append(tabs.nextSibling);panel.append(controls);
 const view=document.createElement('section');view.id='monthView';view.hidden=true;view.setAttribute('aria-label','整個月行事曆');panel.append(view);
 const number=n=>Math.max(0,Number.isFinite(Number(n))?Math.floor(Number(n)):0);
 function normal(value){const m=/^(\d{4})-(\d{1,2})$/.exec(value||'');if(!m||+m[1]<1||+m[1]>9999||+m[2]<1||+m[2]>12)throw Error('請選擇正確的月份。');return m[1]+'-'+String(+m[2]).padStart(2,'0');}
 function shift(value,step){const [year,m]=value.split('-').map(Number),index=year*12+m-1+step;return normal(String(Math.floor(index/12)).padStart(4,'0')+'-'+String(index%12+1));}
 const title=value=>{const [y,m]=value.split('-');return `${y} 年 ${Number(m)} 月`;};
 function shortLunar(value){if(!value)return '';return value.endsWith('初一')?value:value.slice(-2);}
 function label(day){const c=day.counts||{},events=(day.items||[]).filter(i=>i.kind==='event');return [day.date,'星期'+weekday(day.date),day.lunar?'農曆'+day.lunar:'',day.closed?'整天不接客':'',number(c.customers)?number(c.customers)+'位客人':'沒有客人',number(c.pending)?number(c.pending)+'筆申請中':'',...events.map(i=>(i.block===false?'提醒：':'行程：')+i.title)].filter(Boolean).join('，');}
 function cell(day){
  const c=day.counts||{},customers=number(c.customers),pending=number(c.pending),events=(day.items||[]).filter(i=>i.kind==='event'),first=events[0],more=Math.max(0,number(c.events)-1),today=!!day.isToday||day.date===data.today;
  const classes=['month-day',day.closed?'closed':'',today?'is-today':'',day.isPast?'is-past':'',customers>=3?'busy':customers?'some':''].filter(Boolean).join(' ');
  return `<button type="button" class="${classes}" data-month="day" data-date="${h(day.date)}" aria-label="${h(label(day))}" ${today?'aria-current="date"':''}><span class="month-date">${number(day.day)}${today?'<span class="month-today-dot" aria-hidden="true"></span>':''}</span><span class="month-lunar ${String(day.lunar||'').endsWith('初一')?'new-lunar-month':''}">${h(shortLunar(day.lunar))||'&nbsp;'}</span>${customers?`<span class="month-customers">${customers}<span> 位</span></span>`:'<span class="month-customers empty-count" aria-hidden="true">&nbsp;</span>'}${pending?`<span class="month-pending">申請 ${pending}</span>`:''}${day.closed?'<span class="month-closed">🔒不接</span>':''}${first?`<span class="month-event ${first.block===false?'reminder':''}" title="${h(first.title)}">${h(first.title)}</span>${more?`<span class="month-more">＋${more}</span>`:''}`:''}</button>`;
 }
 function sync(){
  view.hidden=!active;controls.hidden=active;tab.classList.toggle('active',active);tab.setAttribute('aria-expanded',String(active));
  document.body.classList.toggle('month-active',active);
  panel.classList.toggle('month-panel',active);
  if(active)for(const id of ['tabToday','tabTomorrow','tabOther'])$(id).classList.remove('active');
 }
 function render(){
  sync();if(!active)return;
  const current=S.today?.slice(0,7)||month;
  view.innerHTML=`<div class="month-heading"><div><span class="month-eyebrow">MONTHLY OVERVIEW</span><h2 id="monthTitle">${h(title(month))}</h2></div><button type="button" data-month="current" ${month===current?'disabled':''}>回到這個月</button></div><div class="month-navigation"><button type="button" data-month="prev" aria-label="上一個月" ${month==='0001-01'?'disabled':''}>‹ 上個月</button><p class="small">點日期，查看當天安排</p><button type="button" data-month="next" aria-label="下一個月" ${month==='9999-12'?'disabled':''}>下個月 ›</button></div><p id="monthStatus" class="month-status ${error?'send-error':''}" role="status" aria-live="polite">${h(error||(loading?'正在讀取 '+title(month)+'…':'客人數包含固定客；申請中仍需確認。'))}</p>${data?`<div class="month-summary"><span>有客人 <strong>${data.days.filter(d=>number(d.counts?.customers)>0).length}</strong> 天</span><span>整天不接 <strong>${data.days.filter(d=>d.closed).length}</strong> 天</span></div><div class="month-grid" aria-labelledby="monthTitle"><div class="month-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(w=>`<span>${w}</span>`).join('')}</div><div class="month-cells">${Array.from({length:data.firstDow-1},()=>'<span class="month-blank" aria-hidden="true"></span>').join('')}${data.days.map(cell).join('')}</div></div><p class="month-legend small"><span>● 今天</span><span>🔒 整天不接</span><span>申請＝等您確認</span></p>`:loading?'<div class="month-loading" role="status"><span class="send-processing" aria-hidden="true"></span>正在整理這個月的安排…</div>':'<button type="button" class="wide" data-month="retry">重新讀取這個月</button>'}`;
  if(loading)view.setAttribute('aria-busy','true');else view.removeAttribute('aria-busy');
 }
 function validate(r,wanted){
  // Supplied real-backend month mocks intentionally omit ok on success.
  if(!r||r.ok===false||r.code)throw Error(r?.code==='BAD_FN'?'整個月功能還沒更新，請元家確認後端部署。':r?.message||'目前讀不到這個月，請稍後重試。');
  if(normal(r.month)!==wanted||!Array.isArray(r.days)||!Number.isInteger(r.firstDow)||r.firstDow<1||r.firstDow>7||!r.days.length)throw Error('月份資料不完整，請重新讀取。');
  if(!r.days.every(d=>typeof d.date==='string'&&d.date.startsWith(wanted+'-')&&Array.isArray(d.items)))throw Error('月份資料不完整，請重新讀取。');
  return r;
 }
 async function load(value,{force=false,automatic=false}={}){
  if(!KEY)return false;
  if(dayLoading){listRequest++;dayLoading=false;}
  const wanted=normal(value),key=KEY,version=epoch,token=++request,same=month===wanted,scroll={x:scrollX,y:scrollY};
  if(lastKey!==KEY){cache.clear();data=null;lastKey=KEY;}
  month=wanted;active=true;error='';
  const hit=cache.get(wanted);if(!force&&!dirty&&hit&&Date.now()-hit.at<60000){data=hit.data;loading=false;render();return true;}
  if(!same)data=null;loading=true;render();
  try{
   const r=validate(await call('apiMonth',wanted),wanted);
   if(token!==request||version!==epoch||KEY!==key||!active)return false;
   if(automatic&&refreshBusy()){loading=false;dirty=true;deferRefresh();render();return false;}
   cache.set(wanted,{data:r,at:Date.now()});while(cache.size>3)cache.delete(cache.keys().next().value);
   data=r;dirty=false;loading=false;error='';if(r.today)S.today=r.today;render();
   if(automatic)window.scrollTo(scroll.x,scroll.y);return true;
  }catch(e){if(token!==request||!active)return false;if(KEY!==key){cache.clear();data=null;leave();return false;}loading=false;error=(data?'更新失敗，先保留上次的安排。':'')+(e.message||'讀取失敗，請稍後再試。');render();return false;}
 }
 function leave(){if(dayLoading){listRequest++;dayLoading=false;}active=false;loading=false;request++;sync();}
 function invalidate(){cache.clear();epoch++;dirty=true;if(active&&loading){loading=false;render();}}
 async function openDay(date){
  if(loading)return;
  const prior=S.selected,token=++request;loading=true;dayLoading=true;error='正在讀取 '+shortDate(date)+' 的安排…';render();
  S.selected=date;const loaded=await loadDays(date,false,false,1);
  if(token!==request||!active)return;
  loading=false;dayLoading=false;
  if(loaded){leave();renderHome();$('dayTitle').scrollIntoView({block:'start'});}
  else{S.selected=prior;error='這天的安排還沒讀到，請再點一次日期。';render();}
 }
 document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-month]');if(!button||button.disabled||!KEY||S.dialog)return;
  try{
   const a=button.dataset.month;
   if(a==='open')await load(S.selected?.slice(0,7)||S.today.slice(0,7));
   else if(a==='prev'||a==='next')await load(shift(month,a==='prev'?-1:1));
   else if(a==='current')await load(S.today.slice(0,7));
   else if(a==='retry')await load(month,{force:true});
   else if(a==='day')await openDay(button.dataset.date);
  }catch(e){error=e.message;render();}
 });
 window.YaliMonth={isActive:()=>active,leave,sync,invalidate,refresh:(automatic=false)=>load(month||S.today.slice(0,7),{force:true,automatic}),onDialogClosed:()=>{if(active&&dirty&&!refreshBusy())void load(month,{force:true});}};
 sync();
})();
