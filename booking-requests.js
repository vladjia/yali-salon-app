/* Pending customer applications. This reminder never approves anything by itself. */
(()=>{
  const panel=document.createElement('section');panel.id='bookingRequests';panel.className='panel';panel.hidden=true;
  document.querySelector('main .header').after(panel);
  let cached=[],loading=false,again=false,failed=false;
  function pending(days){const seen=new Set(),list=[];days.forEach(day=>(day.items||[]).forEach(item=>{if(item.kind==='booking'&&item.booking?.status==='PENDING'&&!seen.has(item.id)){seen.add(item.id);list.push({id:item.id,date:day.date,start:item.start,name:item.customer?.name||'客人'});}}));return list;}
  async function refresh(){
    if(!KEY||!S.today)return;
    if(loading){again=true;return;}
    loading=true;
    try{
      // apiDays caps one request at 31 days; background reads cover day 0..60.
      const results=await Promise.all([call('apiDays',S.today,31),call('apiDays',plusDays(S.today,31),30)]);
      if(results.some(r=>!r?.ok||!Array.isArray(r.days)))throw Error('read failed');
      cached=pending(results.flatMap(r=>r.days));failed=false;
    }catch(e){failed=true;}
    finally{loading=false;if(!refreshBusy())render();if(again){again=false;refresh();}}
  }
  function render(){
    const open=panel.querySelector('details')?.open;
    const visibleDates=new Set(S.days.map(d=>d.date));
    const list=[...cached.filter(i=>!visibleDates.has(i.date)),...pending(S.days)].sort((a,b)=>a.start.localeCompare(b.start));
    panel.hidden=!list.length&&!failed;
    if(panel.hidden){panel.replaceChildren();return;}
    panel.innerHTML=`${list.length?`<details ${open?'open':''}><summary>有 ${list.length} 筆 LINE 新申請</summary><div class="request-list">${list.map((item,i)=>`<div class="request-row"><div><strong>${h(item.name)}</strong><p class="small">${h(item.start)}</p></div><button type="button" data-request-index="${i}">查看申請</button></div>`).join('')}</div></details>`:''}${failed?'<p class="small" role="status">其他日期的申請提醒暫時更新不到，請按上方「更新」重試。</p>':''}`;
    panel.querySelectorAll('[data-request-index]').forEach(button=>button.onclick=async()=>{
      const item=list[Number(button.dataset.requestIndex)];
      await showDay(item.date);
      const confirm=document.querySelector('[data-act="transition"][data-to="CONFIRMED"][data-id="'+CSS.escape(item.id)+'"]');
      const article=confirm?.closest('.appointment');
      if(article){article.classList.add('pending-highlight');article.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});confirm.focus({preventScroll:true});setTimeout(()=>article.classList.remove('pending-highlight'),3500);}
    });
  }
  window.YaliRequests={render,refresh};render();if(S.today)refresh();
  document.addEventListener('focusout',()=>{if(!refreshBusy())setTimeout(render,0);});
})();
