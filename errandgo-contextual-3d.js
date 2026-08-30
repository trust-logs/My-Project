/* ErrandGo contextual 3D empty/error states. Keeps visuals page-specific without touching app logic. */
(function(){
  const rules=[
    ['chat',['chat','message','conversation'],'eg-3d-chat'],
    ['notification',['notification','notifications'],'eg-3d-bell'],
    ['wallet',['wallet','money','fund','balance','withdraw'],'eg-3d-wallet'],
    ['rating',['rating','review','reviews'],'eg-3d-star'],
    ['saved',['saved','save'],'eg-3d-heart'],
    ['errand',['errand','task','tasks','applications','application'],'eg-3d-package'],
    ['internet',['internet','offline','connection','network'],'eg-3d-globe'],
    ['auth',['sign in','login','account','authentication'],'eg-3d-lock'],
    ['success',['success','completed','complete'],'eg-3d-check'],
    ['error',['error','failed','something went wrong'],'eg-3d-repair']
  ];
  function classify(el){
    if(!el || !el.matches('.infoCard,.emptyState,.eg-empty-state')) return;
    const text=(el.textContent||'').toLowerCase();
    el.classList.remove(...rules.map(r=>r[2]));
    let found=null;
    for(const [,words,cls] of rules){if(words.some(w=>text.includes(w))){found=cls;break}}
    el.classList.add(found||'eg-3d-package');
    el.classList.add('eg-contextual-3d');
    el.querySelectorAll('svg[data-lucide="alert-triangle"],.alert-triangle').forEach(x=>x.remove());
  }
  function scan(){document.querySelectorAll('.infoCard,.emptyState,.eg-empty-state').forEach(classify)}
  const start=()=>{scan();new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,characterData:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
