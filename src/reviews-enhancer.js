import { supabase } from './lib/supabase';

const STYLE_ID = 'eg-reviews-enhancer-style';
const MODAL_ID = 'eg-reviews-modal';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .eg-rating-clickable{cursor:pointer!important;transition:transform .18s ease,box-shadow .18s ease}.eg-rating-clickable:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(100,60,180,.12)}
    .eg-review-backdrop{position:fixed;inset:0;background:rgba(28,20,45,.42);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:16px}
    .eg-review-modal{width:min(520px,100%);max-height:min(88vh,760px);overflow:auto;background:#fff;border:1px solid #eadff7;border-radius:28px;box-shadow:0 24px 70px rgba(46,28,75,.25);padding:20px;color:#282332}
    .eg-review-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.eg-review-head h3{margin:0;font-size:20px}.eg-review-close{border:0;background:#f7f3fb;border-radius:50%;width:38px;height:38px;cursor:pointer;font-size:22px;color:#625b6e}
    .eg-rating-summary{display:flex;align-items:center;gap:18px;background:#faf7ff;border:1px solid #eee4f8;border-radius:20px;padding:18px;margin-bottom:16px}.eg-rating-number{font-size:38px;font-weight:900}.eg-stars{color:#8d4dff;letter-spacing:2px;font-size:22px}.eg-muted{font-size:12px;color:#81798c}
    .eg-review-form{border:1px solid #eadff7;border-radius:20px;padding:16px;margin-bottom:18px}.eg-review-form h4{margin:0 0 12px;font-size:15px}.eg-star-row{display:flex;gap:6px;margin-bottom:12px}.eg-star-btn{border:0;background:transparent;color:#d6cbe4;font-size:30px;padding:0;cursor:pointer;line-height:1}.eg-star-btn.active{color:#8d4dff}.eg-review-form textarea{width:100%;min-height:86px;resize:vertical;border:1px solid #e5dced;border-radius:14px;padding:12px;font:inherit;box-sizing:border-box;outline:none}.eg-review-form textarea:focus{border-color:#9b61ff;box-shadow:0 0 0 3px rgba(141,77,255,.1)}.eg-review-select{width:100%;border:1px solid #e5dced;border-radius:14px;padding:11px;background:#fff;margin-bottom:12px;font:inherit}.eg-review-submit{width:100%;border:0;border-radius:14px;padding:13px;background:#8d4dff;color:#fff;font-weight:800;cursor:pointer}.eg-review-submit:disabled{opacity:.55;cursor:not-allowed}
    .eg-review-item{border-top:1px solid #eee7f5;padding:16px 0}.eg-review-item:first-child{border-top:0}.eg-review-meta{display:flex;align-items:center;gap:10px}.eg-review-avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#8d4dff;color:#fff;font-weight:800}.eg-review-name{font-weight:800}.eg-review-date{font-size:11px;color:#8c8496}.eg-review-comment{font-size:13px;line-height:1.55;margin:10px 0 0;color:#514a5b}.eg-reply{margin:10px 0 0 48px;background:#f8f5fc;border-radius:14px;padding:10px 12px}.eg-reply b{font-size:11px}.eg-reply p{margin:4px 0 0;font-size:12px;line-height:1.45}.eg-reply-form{margin:10px 0 0 48px;display:flex;gap:7px}.eg-reply-form input{min-width:0;flex:1;border:1px solid #e4dced;border-radius:12px;padding:9px 10px;font:inherit}.eg-reply-form button{border:0;border-radius:12px;padding:0 12px;background:#baff19;color:#253000;font-weight:800;cursor:pointer}.eg-empty-reviews{text-align:center;padding:28px 12px;color:#81798c;font-size:13px}
    @media(max-width:520px){.eg-review-backdrop{padding:0}.eg-review-modal{border-radius:28px 28px 0 0;max-height:92vh}.eg-rating-summary{padding:14px}.eg-rating-number{font-size:32px}}
  `;
  document.head.appendChild(style);
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const stars = n => '★★★★★'.split('').map((s,i)=>i < Math.round(Number(n)||0) ? '★' : '☆').join('');
const initials = name => (String(name || 'E').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('') || 'E').toUpperCase();

async function getCurrentUser(){
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

async function loadReviews(profileId){
  if (!supabase) return { reviews: [], count: 0, average: 0 };
  const { data, error } = await supabase
    .from('reviews')
    .select('id,errand_id,reviewer_id,reviewee_id,rating,comment,created_at,reviewer:reviewer_id(full_name,email),reply:review_replies(id,reply,replier_id,created_at,replier:replier_id(full_name,email))')
    .eq('reviewee_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const reviews = data || [];
  const average = reviews.length ? reviews.reduce((sum,r)=>sum + Number(r.rating||0),0) / reviews.length : 0;
  return { reviews, count: reviews.length, average };
}

async function loadRateableErrands(userId, profileId){
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('errands')
    .select('id,title,status,customer_id,runner_id,customer:customer_id(full_name,email),runner:runner_id(full_name,email)')
    .eq('status','completed')
    .or(`customer_id.eq.${userId},runner_id.eq.${userId}`)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  const { data: mine } = await supabase.from('reviews').select('errand_id').eq('reviewer_id', userId);
  const already = new Set((mine || []).map(x=>x.errand_id));
  return (data || []).filter(e => {
    const otherId = e.customer_id === userId ? e.runner_id : e.customer_id;
    return otherId && otherId !== userId && !already.has(e.id) && otherId === profileId;
  });
}

async function submitReview(profileId, errandId, rating, comment){
  const user = await getCurrentUser();
  if (!user) throw new Error('Please sign in to leave a review.');
  const { error } = await supabase.rpc('submit_review', {
    p_errand_id: errandId,
    p_reviewee_id: profileId,
    p_rating: rating,
    p_comment: comment || null
  });
  if (error) throw error;
}

async function submitReply(reviewId, reply){
  const { error } = await supabase.rpc('reply_to_review', { p_review_id: reviewId, p_reply: reply });
  if (error) throw error;
}

function closeModal(){ document.getElementById(MODAL_ID)?.remove(); }

async function renderModal(profileId, profileName){
  closeModal();
  const user = await getCurrentUser();
  let summary;
  try { summary = await loadReviews(profileId); } catch(e) { alert(e.message || 'Unable to load reviews.'); return; }

  const backdrop = document.createElement('div');
  backdrop.id = MODAL_ID;
  backdrop.className = 'eg-review-backdrop';
  backdrop.innerHTML = `<div class="eg-review-modal" role="dialog" aria-modal="true" aria-label="Ratings and reviews">
    <div class="eg-review-head"><h3>Ratings & reviews</h3><button class="eg-review-close" aria-label="Close">×</button></div>
    <div class="eg-rating-summary"><div><div class="eg-rating-number">${summary.average.toFixed(1)}</div><div class="eg-stars">${stars(summary.average)}</div></div><div><b>${summary.count} ${summary.count===1?'review':'reviews'}</b><div class="eg-muted">Real ratings from completed errands</div></div></div>
    <div class="eg-review-form" id="eg-review-form"></div>
    <div id="eg-review-list"></div>
  </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector('.eg-review-close').onclick = closeModal;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  const form = backdrop.querySelector('#eg-review-form');
  if (!user) {
    form.innerHTML = `<h4>Want to leave a review?</h4><p class="eg-muted">Sign in and complete an errand with this user first.</p>`;
  } else if (user.id === profileId) {
    form.innerHTML = `<h4>Your reviews</h4><p class="eg-muted">You can't rate yourself. Reviews left by other users appear below.</p>`;
  } else {
    let rateable = [];
    try { rateable = await loadRateableErrands(user.id, profileId); } catch(e) { console.warn(e); }
    if (!rateable.length) {
      form.innerHTML = `<h4>Leave a review</h4><p class="eg-muted">You can rate ${esc(profileName || 'this user')} after completing an errand together.</p>`;
    } else {
      form.innerHTML = `<h4>Rate ${esc(profileName || 'this user')}</h4>
        <select class="eg-review-select" id="eg-review-errand">${rateable.map(e=>`<option value="${e.id}">${esc(e.title || 'Completed errand')}</option>`).join('')}</select>
        <div class="eg-star-row" aria-label="Choose rating">${[1,2,3,4,5].map(n=>`<button type="button" class="eg-star-btn" data-rating="${n}">★</button>`).join('')}</div>
        <textarea id="eg-review-comment" maxlength="1000" placeholder="Share your experience..."></textarea>
        <button class="eg-review-submit" id="eg-review-submit" disabled>Post review</button>`;
      let chosen = 0;
      const starButtons = [...form.querySelectorAll('.eg-star-btn')];
      const updateStars = () => starButtons.forEach(b=>b.classList.toggle('active', Number(b.dataset.rating) <= chosen));
      starButtons.forEach(b=>b.onclick=()=>{chosen=Number(b.dataset.rating);updateStars();form.querySelector('#eg-review-submit').disabled=false;});
      form.querySelector('#eg-review-submit').onclick = async () => {
        const btn=form.querySelector('#eg-review-submit'); btn.disabled=true; btn.textContent='Posting…';
        try { await submitReview(profileId, form.querySelector('#eg-review-errand').value, chosen, form.querySelector('#eg-review-comment').value.trim()); await renderModal(profileId, profileName); }
        catch(e){ alert(e.message || 'Could not post review.'); btn.disabled=false; btn.textContent='Post review'; }
      };
    }
  }

  const list = backdrop.querySelector('#eg-review-list');
  if (!summary.reviews.length) {
    list.innerHTML = `<div class="eg-empty-reviews">No reviews yet. Be the first real reviewer after a completed errand.</div>`;
    return;
  }
  list.innerHTML = summary.reviews.map(r=>{
    const reviewerName = r.reviewer?.full_name || r.reviewer?.email || 'ErrandGo user';
    const reply = Array.isArray(r.reply) ? r.reply[0] : r.reply;
    return `<article class="eg-review-item" data-review-id="${r.id}">
      <div class="eg-review-meta"><div class="eg-review-avatar">${esc(initials(reviewerName))}</div><div><div class="eg-review-name">${esc(reviewerName)}</div><div class="eg-stars" style="font-size:14px;letter-spacing:1px">${stars(r.rating)}</div><div class="eg-review-date">${new Date(r.created_at).toLocaleDateString()}</div></div></div>
      ${r.comment ? `<p class="eg-review-comment">${esc(r.comment)}</p>` : ''}
      ${reply ? `<div class="eg-reply"><b>Reply from ${esc(profileName || 'profile owner')}</b><p>${esc(reply.reply)}</p></div>` : ''}
      ${user && user.id === profileId ? `<div class="eg-reply-form"><input maxlength="1000" placeholder="Reply to this review…"/><button class="eg-reply-btn">Reply</button></div>` : ''}
    </article>`;
  }).join('');

  list.querySelectorAll('.eg-reply-btn').forEach(btn=>btn.onclick=async()=>{
    const article=btn.closest('.eg-review-item'); const input=article.querySelector('input'); const text=input.value.trim(); if(!text)return;
    btn.disabled=true; btn.textContent='…';
    try { await submitReply(article.dataset.reviewId,text); await renderModal(profileId,profileName); }
    catch(e){ alert(e.message || 'Could not reply.'); btn.disabled=false; btn.textContent='Reply'; }
  });
}

function attach(){
  injectStyles();
  const statCards = document.querySelectorAll('.stats > div');
  if (!statCards.length) return;
  const ratingCard = statCards[1];
  if (!ratingCard || ratingCard.dataset.egReviewsBound === '1') return;
  ratingCard.dataset.egReviewsBound='1';
  ratingCard.classList.add('eg-rating-clickable');
  ratingCard.setAttribute('role','button');
  ratingCard.setAttribute('tabindex','0');
  const open = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    let profile = null;
    if (supabase) { const { data } = await supabase.from('profiles').select('id,full_name,email').eq('id',user.id).maybeSingle(); profile=data; }
    await renderModal(user.id, profile?.full_name || user.email || 'ErrandGo user');
  };
  ratingCard.addEventListener('click', open);
  ratingCard.addEventListener('keydown', e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
}

attach();
new MutationObserver(attach).observe(document.body,{subtree:true,childList:true});
