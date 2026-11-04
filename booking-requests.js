/* Pending customer applications. This reminder never approves anything by itself. */
(()=>{
  const panel=document.createElement('section');panel.id='bookingRequests';panel.className='panel';panel.hidden=true;
  document.querySelector('main .header').after(panel);
  function render(){
    const open=panel.querySelector('details')?.open;
    const seen=new Set(),list=[];
    S.days.forEach(day=>(day.items||[]).forEach(item=>{
      if(item.kind==='booking'&&item.booking?.status==='PENDING'&&!seen.has(item.id)){
        seen.add(item.id);list.push({id:item.id,date:day.date,start:item.start,name:item.customer?.name||'客人'});
      }
    }));
    panel.hidden=!list.length;
    if(!list.length){panel.replaceChildren();return;}
    panel.innerHTML=`<details ${open?'open':''}><summary>有 ${list.length} 筆 LINE 新申請</summary><div class="request-list">${list.map((item,i)=>`<div class="request-row"><div><strong>${h(item.name)}</strong><p class="small">${h(item.start)}</p></div><button type="button" data-request-index="${i}">查看申請</button></div>`).join('')}</div></details>`;
    panel.querySelectorAll('[data-request-index]').forEach(button=>button.onclick=async()=>{
      const item=list[Number(button.dataset.requestIndex)];
      await showDay(item.date);
      const confirm=document.querySelector('[data-act="transition"][data-to="CONFIRMED"][data-id="'+CSS.escape(item.id)+'"]');
      const article=confirm?.closest('.appointment');
      if(article){article.classList.add('pending-highlight');article.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});confirm.focus({preventScroll:true});setTimeout(()=>article.classList.remove('pending-highlight'),3500);}
    });
  }
  window.YaliRequests={render};render();
})();
