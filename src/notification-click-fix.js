const STYLE_ID = 'eg-notification-click-fix-style';
const MODAL_ID = 'eg-notification-detail-modal';

function isNotificationPage() {
  const heading = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
    .find(el => /notifications/i.test(el.textContent || ''));
  return Boolean(heading);
}

function getCard(target) {
  const card = target?.closest?.('.taskCard');
  if (!card || !isNotificationPage()) return null;
  if (target.closest('button,a,input,textarea,select')) return null;
  return card;
}

function closeModal() {
  document.getElementById(MODAL_ID)?.remove();
}

function showNotification(notification) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="egNotifOverlay" role="presentation">
      <section class="egNotifModal" role="dialog" aria-modal="true" aria-labelledby="egNotifTitle">
        <button class="egNotifClose" type="button" aria-label="Close notification">×</button>
        <div class="egNotifIcon" aria-hidden="true">🔔</div>
        <div class="egNotifType">${escapeHtml(notification.type || 'NOTIFICATION')}</div>
        <h2 id="egNotifTitle">${escapeHtml(notification.title || 'Notification')}</h2>
        <p>${escapeHtml(notification.body || 'You have a new notification.')}</p>
        <button class="egNotifDone" type="button">Done</button>
      </section>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => closeModal();
  overlay.querySelector('.egNotifClose').addEventListener('click', close);
  overlay.querySelector('.egNotifDone').addEventListener('click', close);
  overlay.querySelector('.egNotifOverlay').addEventListener('click', e => {
    if (e.target === overlay.querySelector('.egNotifOverlay')) close();
  });
  const onKey = e => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.egNotifDone').focus();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[ch]));
}

async function markNotificationRead(card) {
  try {
    const title = card.querySelector('h4')?.textContent?.trim() || '';
    const body = card.querySelector('p')?.textContent?.trim() || '';
    const mod = await import('./lib/supabase.js');
    const supabase = mod.supabase;
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return;
    let query = supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false);
    if (title) query = query.eq('title', title);
    const { data } = await query.select('id,title,body').limit(1);
    if (!data?.length && body) {
      await supabase.from('notifications').update({ read: true })
        .eq('user_id', uid).eq('read', false).eq('body', body);
    }
    card.classList.remove('unread');
    const status = card.querySelector('.taskLine span:last-child');
    if (status) status.textContent = 'Read';
  } catch (error) {
    console.warn('[ErrandGo] Notification read update failed:', error?.message || error);
  }
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .egNotifOverlay{position:fixed;inset:0;z-index:100000;background:rgba(31,22,48,.42);backdrop-filter:blur(7px);display:grid;place-items:center;padding:20px}
    .egNotifModal{width:min(380px,calc(100vw - 36px));box-sizing:border-box;background:#fff;border:1px solid #e9def7;border-radius:26px;padding:28px 24px 24px;text-align:center;box-shadow:0 28px 90px rgba(49,25,83,.28);position:relative;animation:egNotifIn .18s ease-out}
    .egNotifClose{position:absolute;right:14px;top:12px;width:34px;height:34px;border:0;border-radius:50%;background:#f6f1fc;color:#4b4358;font-size:23px;line-height:1;cursor:pointer}
    .egNotifIcon{width:66px;height:66px;margin:0 auto 13px;border-radius:20px;background:linear-gradient(145deg,#b878ff,#793fe7);display:grid;place-items:center;font-size:30px;box-shadow:8px 10px 0 rgba(100,57,160,.12)}
    .egNotifType{font-size:10px;font-weight:900;letter-spacing:.12em;color:#8d4dff;margin-bottom:6px}
    .egNotifModal h2{margin:0 0 9px;color:#252338;font-size:22px;line-height:1.2}
    .egNotifModal p{margin:0 auto 20px;max-width:310px;color:#77717f;font-size:13px;line-height:1.6}
    .egNotifDone{border:0;border-radius:14px;background:#8d4dff;color:#fff;font-weight:800;padding:12px 28px;cursor:pointer}
    .egNotifModal button:focus-visible{outline:3px solid rgba(141,77,255,.25);outline-offset:2px}
    .taskCard.eg-notification-clickable{cursor:pointer}
    @keyframes egNotifIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){.egNotifModal{animation:none}}
  `;
  document.head.appendChild(style);
}

function enhanceCards() {
  if (!isNotificationPage()) return;
  document.querySelectorAll('.taskCard').forEach(card => {
    card.classList.add('eg-notification-clickable');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    const title = card.querySelector('h4')?.textContent?.trim();
    const body = card.querySelector('p')?.textContent?.trim();
    card.dataset.egNotificationTitle = title || '';
    card.dataset.egNotificationBody = body || '';
  });
}

function handleClick(event) {
  const card = getCard(event.target);
  if (!card) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const type = card.querySelector('.taskLine span:first-child')?.textContent?.trim() || 'Notification';
  const title = card.querySelector('h4')?.textContent?.trim() || 'Notification';
  const body = card.querySelector('p')?.textContent?.trim() || 'You have a new notification.';
  markNotificationRead(card);
  showNotification({ type, title, body });
}

function handleKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const card = getCard(event.target);
  if (!card) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const type = card.querySelector('.taskLine span:first-child')?.textContent?.trim() || 'Notification';
  const title = card.querySelector('h4')?.textContent?.trim() || 'Notification';
  const body = card.querySelector('p')?.textContent?.trim() || 'You have a new notification.';
  markNotificationRead(card);
  showNotification({ type, title, body });
}

injectStyles();
document.addEventListener('click', handleClick, true);
document.addEventListener('keydown', handleKeydown, true);
const observer = new MutationObserver(enhanceCards);
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(enhanceCards, 0);
