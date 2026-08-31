import { supabase } from './lib/supabase';

let userId = null;
let busy = false;
const WELCOME_RE = /welcome/i;

async function getUser() {
  if (userId) return userId;
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id || null;
  } catch (_) {}
  return userId;
}

function onNotificationsPage() {
  return [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
    .some(el => /notifications/i.test(el.textContent || ''));
}

function cards() {
  if (!onNotificationsPage()) return [];
  return [...document.querySelectorAll('.taskList .taskCard')];
}

function getNotification(card) {
  return {
    type: card.querySelector('.taskLine span:first-child')?.textContent?.trim() || 'Notification',
    title: card.querySelector('h4')?.textContent?.trim() || 'Notification',
    body: card.querySelector('p')?.textContent?.trim() || 'You have a new notification.',
  };
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[c]));
}

function closeWelcome() {
  document.getElementById('eg-notification-detail')?.remove();
}

function openNotification(card) {
  const n = getNotification(card);
  closeWelcome();

  const overlay = document.createElement('div');
  overlay.id = 'eg-notification-detail';
  overlay.innerHTML = `<div class="egNotifOverlay"><section class="egNotifModal" role="dialog" aria-modal="true" aria-labelledby="egNotifTitle"><button class="egNotifClose" type="button" aria-label="Close">×</button><div class="egNotifIcon">🔔</div><div class="egNotifType">${esc(n.type)}</div><h2 id="egNotifTitle">${esc(n.title)}</h2><p>${esc(n.body)}</p><button class="egNotifDone" type="button">Done</button></section></div>`;
  document.body.appendChild(overlay);

  const close = () => closeWelcome();
  overlay.querySelector('.egNotifClose').addEventListener('click', close);
  overlay.querySelector('.egNotifDone').addEventListener('click', close);
  overlay.querySelector('.egNotifOverlay').addEventListener('click', e => {
    if (e.target === overlay.querySelector('.egNotifOverlay')) close();
  });
  overlay.querySelector('.egNotifDone').focus();

  markOneRead(card, n);
}

async function markOneRead(card, n) {
  try {
    const uid = await getUser();
    if (!supabase || !uid) return;
    let result = await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false).eq('title', n.title).select('id');
    if (!result.data?.length && n.body) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false).eq('body', n.body);
    }
    card.classList.remove('unread');
    const status = card.querySelector('.taskLine span:last-child');
    if (status) status.textContent = 'Read';
  } catch (e) {
    console.warn('[ErrandGo] Could not mark notification read:', e?.message || e);
  }
}

async function markAllRead() {
  if (busy) return;
  busy = true;
  try {
    const uid = await getUser();
    if (!supabase || !uid) return;
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false);
    if (error) throw error;
    cards().forEach(card => {
      card.classList.remove('unread');
      const status = card.querySelector('.taskLine span:last-child');
      if (status) status.textContent = 'Read';
    });
    document.querySelectorAll('button').forEach(button => {
      if (/mark all read/i.test(button.textContent || '')) {
        button.textContent = 'All read';
        button.disabled = true;
      }
    });
  } catch (e) {
    console.warn('[ErrandGo] Could not mark all notifications read:', e?.message || e);
  } finally {
    busy = false;
  }
}

function enhance() {
  if (!onNotificationsPage()) return;
  cards().forEach(card => {
    card.classList.add('eg-notification-clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
  });
}

function handleClick(event) {
  const button = event.target.closest?.('button');
  if (button && /mark all read/i.test(button.textContent || '') && onNotificationsPage()) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    markAllRead();
    return;
  }

  const card = event.target.closest?.('.taskList .taskCard');
  if (!card || !onNotificationsPage()) return;
  if (event.target.closest('button,a,input,textarea,select')) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openNotification(card);
}

function handleKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const card = event.target.closest?.('.taskList .taskCard');
  if (!card || !onNotificationsPage()) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openNotification(card);
}

function injectStyles() {
  if (document.getElementById('eg-notification-detail-style')) return;
  const style = document.createElement('style');
  style.id = 'eg-notification-detail-style';
  style.textContent = `.eg-notification-clickable{cursor:pointer!important}.egNotifOverlay{position:fixed;inset:0;z-index:100000;background:rgba(31,22,48,.42);backdrop-filter:blur(7px);display:grid;place-items:center;padding:20px}.egNotifModal{width:min(380px,calc(100vw - 36px));box-sizing:border-box;background:#fff;border:1px solid #e9def7;border-radius:26px;padding:28px 24px 24px;text-align:center;box-shadow:0 28px 90px rgba(49,25,83,.28);position:relative;animation:egNotifIn .18s ease-out}.egNotifClose{position:absolute;right:14px;top:12px;width:34px;height:34px;border:0;border-radius:50%;background:#f6f1fc;color:#4b4358;font-size:23px;line-height:1;cursor:pointer}.egNotifIcon{width:66px;height:66px;margin:0 auto 13px;border-radius:20px;background:linear-gradient(145deg,#b878ff,#793fe7);display:grid;place-items:center;font-size:30px;box-shadow:8px 10px 0 rgba(100,57,160,.12)}.egNotifType{font-size:10px;font-weight:900;letter-spacing:.12em;color:#8d4dff;margin-bottom:6px}.egNotifModal h2{margin:0 0 9px;color:#252338;font-size:22px;line-height:1.2}.egNotifModal p{margin:0 auto 20px;max-width:310px;color:#77717f;font-size:13px;line-height:1.6}.egNotifDone{border:0;border-radius:14px;background:#8d4dff;color:#fff;font-weight:800;padding:12px 28px;cursor:pointer}@keyframes egNotifIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.egNotifModal{animation:none}}`;
  document.head.appendChild(style);
}

injectStyles();
document.addEventListener('click', handleClick, true);
document.addEventListener('keydown', handleKeydown, true);
const observer = new MutationObserver(enhance);
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(enhance, 0);
