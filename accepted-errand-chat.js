/* ErrandGo: open the real chat immediately after a runner is accepted. */
(function(){
  let lastOpened='';
  const textOf=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
  const clickMessages=()=>{
    const els=[...document.querySelectorAll('button,a,[role="button"]')];
    const el=els.find(x=>/^messages$/i.test(textOf(x))) || els.find(x=>/messages/i.test(textOf(x))&&!/mark all|notification/i.test(textOf(x)));
    if(el){el.click();return true} return false;
  };
  const openLatestConversation=()=>{
    const rows=[...document.querySelectorAll('button,[role="button"],.chatRow,.conversationRow')];
    const row=rows.find(x=>x.querySelector('.chatAvatar')||x.classList.contains('chatRow')||x.classList.contains('conversationRow'));
    if(row){row.click();return true} return false;
  };
  const watch=()=>{
    const body=textOf(document.body);
    const accepted=/runner accepted/i.test(body) || /application accepted/i.test(body);
    if(!accepted)return;
    const key=(body.match(/runner accepted.{0,100}/i)||['runner accepted'])[0];
    if(key===lastOpened)return;
    lastOpened=key;
    /* Let the Supabase trigger finish creating the conversation before navigating. */
    setTimeout(()=>{
      if(!clickMessages())return;
      setTimeout(openLatestConversation,500);
    },700);
  };
  const start=()=>new MutationObserver(watch).observe(document.body,{subtree:true,childList:true,characterData:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
