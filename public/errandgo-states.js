(() => {
  const makeArt = (kind) => {
    const art = document.createElement('div');
    art.className = `eg-state-art ${kind}`;
    const symbols = {offline:'☁️',server:'▤',notfound:'🔭',locked:'🔒',search:'⌕',empty:'📦',loading:'🛵',rate:'⏱️'};
    const labels = {offline:'Connection issue',server:'Server issue',notfound:'Wrong turn',locked:'Access check',search:'Nothing matched',empty:'Ready when you are',loading:'Getting things ready',rate:'Please slow down'};
    art.innerHTML = `<div class="eg-orb"></div><div class="eg-ring"></div><div class="eg-symbol">${symbols[kind] || '✨'}</div><div class="eg-dot"></div><div class="eg-mini one">E</div><div class="eg-mini two">✓</div>`;
    return {art,label:labels[kind] || 'ErrandGo'};
  };

  const getKind = (text) => {
    const t = text.toLowerCase();
    if (/offline|internet|connection|connect/.test(t)) return 'offline';
    if (/server|something went wrong|temporarily|try again/.test(t)) return 'server';
    if (/page not found|404|wandered/.test(t)) return 'notfound';
    if (/permission|unauthorized|access denied|sign in to/.test(t)) return 'locked';
    if (/no results|match your search|search/.test(t)) return 'search';
    if (/no chats|chat with|conversation/.test(t)) return 'empty';
    if (/loading|getting ready/.test(t)) return 'loading';
    if (/too many|rate limit|requests/.test(t)) return 'rate';
    if (/no live errands|don't have any errands|saved errands|empty|appear here/.test(t)) return 'empty';
    return 'empty';
  };

  const enhance = () => {
    document.querySelectorAll('.infoCard').forEach(card => {
      if (card.classList.contains('eg-state-card')) return;
      const icon = card.querySelector(':scope > svg:first-child');
      if (!icon) return;
      const text = card.innerText || '';
      const kind = getKind(text);
      const {art,label} = makeArt(kind);
      card.classList.add('eg-state-card');
      card.insertBefore(art, card.firstChild);
      const caption = document.createElement('div');
      caption.className = 'eg-state-caption';
      caption.textContent = label;
      card.insertBefore(caption, art.nextSibling);
      icon.remove();
    });
  };

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, {subtree:true, childList:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
})();
