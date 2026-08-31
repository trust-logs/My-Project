import { supabase } from './lib/supabase';

const WELCOME_RE = /welcome\s*(to)?\s*errandgo|welcome/i;
let userId = null;
let busy = false;

async function getUser() {
  if (userId) return userId;
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  userId = data.session?.user?.id || null;
  return userId;
}

function notificationCards() {
  return [...document.querySelectorAll('.infoCard,.notificationCard,[data-notification-id]')]
    .filter(el => !el.closest('.bottomNav,.topbar'));
}

function findNotificationText(el) {
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

async function markOneRead(el) {
  const id = el.dataset.notificationId || el.getAttribute('data-id');
  const uid = await getUser();
  if (!supabase || !uid) return;
  let query = supabase.from('notifications').update({ read: true }).eq('user_id', uid);
  if (id) query = query.eq('id', id);
  else {
    const text = findNotificationText(el);
    if (!text) return;
    const { data } = await supabase.from('notifications').select('id').eq('user_id', uid).eq('read', false).limit(50);
    const match = (data || []).find(n => text.toLowerCase().includes(String(n.id).toLowerCase()));
    if (!match) return;
    query = supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('id', match.id);
  }
  await query;
  el.classList.remove('unread');
  el.setAttribute('data-read', 'true');
}

async function markAllRead() {
  if (busy) return;
  busy = true;
  try {
    const uid = await getUser();
    if (!supabase || !uid) return;
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false);
    if (error) throw error;
    notificationCards().forEach(el => {
      el.classList.remove('unread');
      el.setAttribute('data-read', 'true');
    });
    document.querySelectorAll('[data-eg-mark-all-read]').forEach(b => {
      b.textContent = 'All read';
      b.disabled = true;
    });
    document.querySelectorAll('.topbar .circleBtn i').forEach(i => i.remove());
  } catch (e) {
    console.warn('[ErrandGo] Could not mark notifications read:', e?.message || e);
  } finally {
    busy = false;
  }
}

function enhance() {
  const heading = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
    .find(el => /notifications/i.test(el.textContent || ''));
  if (!heading) return;

  const buttons = [...document.querySelectorAll('button')].filter(b => /mark all read/i.test(b.textContent || ''));
  buttons.forEach(button => {
    if (button.dataset.egMarkAllRead) return;
    button.dataset.egMarkAllRead = 'true';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      markAllRead();
    }, true);
  });

  notificationCards().forEach(card => {
    const text = findNotificationText(card);
    if (!text || card.dataset.egNotificationEnhanced) return;
    card.dataset.egNotificationEnhanced = 'true';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.style.cursor = 'pointer';

    if (WELCOME_RE.test(text)) {
      card.addEventListener('click', async () => {
        await markOneRead(card);
        if (document.querySelector('[data-eg-welcome-dialog]')) return;
        const overlay = document.createElement('div');
        overlay.dataset.egWelcomeDialog = 'true';
        overlay.innerHTML = `<div class="egWelcomeOverlay"><div class="egWelcomeModal" role="dialog" aria-modal="true"><button class="egWelcomeClose" aria-label="Close">×</button><div class="egWelcomeIcon">E</div><h2>Welcome to ErrandGo 👋</h2><p>You're all set. Post errands, find opportunities, chat securely and get things done.</p><button class="egWelcomeDone">Got it</button></div></div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.egWelcomeClose').onclick = close;
        overlay.querySelector('.egWelcomeDone').onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay.firstElementChild) close(); });
      });
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
    }
  });
}

const style = document.createElement('style');
style.textContent = `.egWelcomeOverlay{position:fixed;inset:0;z-index:99999;background:rgba(35,24,55,.38);backdrop-filter:blur(6px);display:grid;place-items:center;padding:24px}.egWelcomeModal{width:min(360px,calc(100vw - 48px));background:#fff;border:1px solid #eadff8;border-radius:26px;padding:28px 24px;text-align:center;box-shadow:0 24px 70px rgba(65,35,110,.25);position:relative}.egWelcomeClose{position:absolute;right:14px;top:12px;border:0;background:#f7f3fc;border-radius:50%;width:32px;height:32px;font-size:22px;cursor:pointer;color:#4a4257}.egWelcomeIcon{width:58px;height:58px;margin:0 auto 14px;border-radius:18px;background:linear-gradient(145deg,#a86cff,#773de3);color:#fff;display:grid;place-items:center;font-size:28px;font-weight:900;box-shadow:8px 10px 0 rgba(93,47,160,.12)}.egWelcomeModal h2{margin:0 0 8px;color:#252338;font-size:22px}.egWelcomeModal p{margin:0 0 20px;color:#77717f;line-height:1.55;font-size:13px}.egWelcomeDone{border:0;border-radius:14px;background:#8d4dff;color:#fff;font-weight:800;padding:12px 22px;cursor:pointer}`;
document.head.appendChild(style);

if (typeof window !== 'undefined') {
  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setTimeout(enhance, 0);
}
