/* ErrandGo contextual 3D empty/error states — deterministic page mapping. */
(function(){
const rules=[
['chat',['chat','messages','conversation'],'eg-3d-chat'],
['notification',['notification','notifications','caught up'],'eg-3d-bell'],
['wallet',['wallet','your money','balance','withdraw','fund'],'eg-3d-wallet'],
['rating',['rating','ratings','review','reviews'],'eg-3d-star'],
['saved',['saved errands','saved','save'],'eg-3d-heart'],
['errand',['errand','errands','task','tasks','applications','application'],'eg-3d-package'],
['internet',['internet','offline','connection','network'],'eg-3d-globe'],
['auth',['sign in','login','account','authentication','register','sign up'],'eg-3d-lock'],
['success',['success','successful','completed','complete'],'eg-3d-check'],
['error',['error','failed','failure','something went wrong'],'eg-3d-repair']
];
function markup(c){switch(c){
case'eg-3d-chat':return '<div class="eg-chat-orb"><i></i><i></i></div><span class="eg-chat-dot"></span>';
case'eg-3d-bell':return '<div class="eg-bell-body"><span></span></div><div class="eg-bell-clapper"></div>';
case'eg-3d-wallet':return '<div class="eg-wallet-body"><span></span><b>₦</b></div><div class="eg-wallet-card"></div>';
case'eg-3d-star':return '<div class="eg-star-3d">★</div>';
case'eg-3d-heart':return '<div class="eg-heart-3d">♥</div>';
case'eg-3d-globe':return '<div class="eg-globe-3d"><i></i><b></b></div>';
case'eg-3d-lock':return '<div class="eg-lock-3d"><i></i><b></b></div>';
case'eg-3d-check':return '<div class="eg-check-3d">✓</div>';
case'eg-3d-repair':return '<div class="eg-repair-3d">⚒</div>';
default:return '<div class="eg-package-3d"><i></i><b></b><em></em></div>';}}
function pageText(){return Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"],.pageTitle,.sectionTitle')).map(x=>(x.textContent||'').trim().toLowerCase()).join(' ')}
function classify(el){if(!el||!el.matches('.infoCard,.emptyState,.eg-empty-state'))return;const text=(el.textContent||'').toLowerCase(),heading=pageText(),combined=heading+' '+text,isEmpty=el.classList.contains('emptyState')||el.classList.contains('eg-empty-state')||!!el.querySelector('svg');if(!isEmpty)return;el.classList.remove(...rules.map(r=>r[2]));let found=null;for(const[,words,cls]of rules){if(words.some(w=>heading.includes(w))){found=cls;break}}if(!found){for(const[,words,cls]of rules){if(words.some(w=>combined.includes(w))){found=cls;break}}}const cls=found||'eg-3d-package';el.classList.add(cls,'eg-contextual-3d');el.querySelectorAll('svg,.alert-triangle,[data-lucide="alert-triangle"],[data-lucide="triangle-alert"],.warning-triangle').forEach(x=>x.remove());const old=el.querySelector('.eg3d-scene');if(old&&!old.classList.contains(cls))old.remove();if(!el.querySelector('.eg3d-scene')){const scene=document.createElement('div');scene.className='eg3d-scene '+cls;scene.setAttribute('aria-hidden','true');scene.innerHTML=markup(cls);el.insertBefore(scene,el.firstChild)}}
function removeWarningTriangles(root=document){root.querySelectorAll?.('.alert-triangle,.warning-triangle,.warningTriangle,.triangle-alert,[data-lucide="alert-triangle"],[data-lucide="triangle-alert"],[data-icon="alert-triangle"],[data-icon="triangle-alert"],svg.lucide-alert-triangle,svg.lucide-triangle-alert').forEach(x=>x.remove())}
function scan(){removeWarningTriangles();document.querySelectorAll('.infoCard,.emptyState,.eg-empty-state').forEach(classify);removeWarningTriangles()}
const start=()=>{scan();new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,characterData:true})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

/* Production ratings/reviews widget. */
(function(){
  function load(){
    if(document.getElementById('eg-reviews-widget-script'))return;
    const css=document.createElement('link');css.rel='stylesheet';css.href='./reviews-polish.css?v=2';document.head.appendChild(css);
    const s=document.createElement('script');s.id='eg-reviews-widget-script';s.src='./reviews-widget.js?v=2';s.defer=true;document.body.appendChild(s);
    const enhancer=document.createElement('script');enhancer.id='eg-reviews-enhancer-script';enhancer.type='module';enhancer.src='./src/reviews-enhancer.js?v=1';document.body.appendChild(enhancer);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(load,250));else setTimeout(load,250);
})();

/* Accepted-errand flow: when the existing React acceptance toast appears, open Messages automatically. */
(function(){
  const openedFor=new Set();
  const openChat=()=>{
    const candidates=[...document.querySelectorAll('button')];
    const chat=candidates.find(b=>/^(chat|messages)$/i.test((b.textContent||'').trim())) ||
      candidates.find(b=>/messages/i.test((b.textContent||'').trim()) && !/mark all/i.test((b.textContent||'')));
    if(chat){chat.click();return true}
    return false;
  };
  const watch=()=>{
    const toast=document.querySelector('.toast');
    const text=(toast?.textContent||'').trim();
    if(!/runner accepted/i.test(text))return;
    const key=text+'|'+Math.floor(Date.now()/5000);
    if(openedFor.has(key))return;
    openedFor.add(key);
    setTimeout(()=>openChat(),120);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>new MutationObserver(watch).observe(document.body,{subtree:true,childList:true,characterData:true}));
  else new MutationObserver(watch).observe(document.body,{subtree:true,childList:true,characterData:true});
})();
