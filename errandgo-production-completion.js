/* ErrandGo production completion helpers. No secrets; safe for the browser. */
(() => {
  const hideWarnings = () => {
    document.querySelectorAll('svg.lucide-alert-triangle,svg.lucide-triangle-alert,[data-icon="alert-triangle"],[data-icon="triangle-alert"],.alert-triangle,.alertTriangle,.warning-triangle,.warningTriangle,.triangle-alert,.triangleWarning').forEach(el => el.remove());
  };

  const addOfflineStatus = () => {
    if (document.getElementById('eg-network-status')) return;
    const el = document.createElement('div');
    el.id = 'eg-network-status';
    el.textContent = 'You are offline — changes will resume when you reconnect.';
    Object.assign(el.style,{position:'fixed',left:'50%',top:'12px',transform:'translateX(-50%) translateY(-12px)',zIndex:'9999',padding:'10px 16px',borderRadius:'999px',background:'#241a39',color:'#fff',font:'600 12px system-ui,sans-serif',boxShadow:'0 10px 30px rgba(0,0,0,.2)',opacity:'0',pointerEvents:'none',transition:'all .25s ease'});
    document.body.appendChild(el);
    const update = () => { const offline=!navigator.onLine; el.style.opacity=offline?'1':'0'; el.style.transform=`translateX(-50%) translateY(${offline?'0':'-12px'})`; };
    window.addEventListener('online',update); window.addEventListener('offline',update); update();
  };

  const addInstallSupport = () => {
    let deferred;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred=e; window.__errandGoInstall=async()=>{if(!deferred)return false;deferred.prompt();await deferred.userChoice;deferred=null;return true}; });
    window.addEventListener('appinstalled',()=>{deferred=null;window.__errandGoInstall=null});
  };

  const enhanceForms = () => {
    document.querySelectorAll('input[type=email]').forEach(i=>i.setAttribute('autocomplete','email'));
    document.querySelectorAll('input[type=password]').forEach(i=>i.setAttribute('autocomplete',i.closest('form')?.textContent?.match(/create|sign up|account/i)?'new-password':'current-password'));
  };

  const boot = () => { hideWarnings(); addOfflineStatus(); addInstallSupport(); enhanceForms(); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  new MutationObserver(() => { hideWarnings(); enhanceForms(); }).observe(document.documentElement,{subtree:true,childList:true});
})();
