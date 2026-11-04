/* Push only. No offline cache, customer data or management key. */
function appURL(value){
 const root=new URL('./',self.registration.scope);
 try{const url=new URL(value||root.href,root);if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return root.href;url.search='';url.hash='';return url.href;}catch{return root.href;}
}
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification(data.title||'雅麗',{body:data.body||'有新的預約消息，請開啟 App 查看。',tag:data.tag||'yali-update',data:{url:appURL(data.url)},icon:'icons/icon-192-v2.png',badge:'icons/icon-192-v2.png'}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const root=new URL('./',self.registration.scope),windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>{try{const u=new URL(client.url);return u.origin===root.origin&&u.pathname===root.pathname;}catch{return false;}});
  if(existing){await existing.focus();return;}await self.clients.openWindow(appURL(event.notification.data?.url));
 })());
});
