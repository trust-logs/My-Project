import { createClient } from '@supabase/supabase-js';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
}) : null;

// Never allow initial app boot to hang forever if Supabase is unreachable.
export async function currentUser() {
  if (!supabase) return null;
  try {
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase session timeout')), 5000)),
    ]);
    return sessionResult?.data?.session?.user ?? null;
  } catch (error) {
    console.warn('[ErrandGo] Supabase session unavailable:', error?.message || error);
    return null;
  }
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return supabase.auth.signInWithPassword({ email, password });
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countryOptions = getCountries()
  .map((iso) => ({ iso, name: regionNames.of(iso) || iso, code: `+${getCountryCallingCode(iso)}` }))
  .sort((a, b) => a.name.localeCompare(b.name));

function setupPhoneSignupUI() {
  if (typeof document === 'undefined') return;
  const ensure = () => {
    const modal = [...document.querySelectorAll('.postModal')].find((el) => /Create your account/i.test(el.textContent || ''));
    if (!modal || modal.querySelector('[data-eg-phone-field]')) return;
    const email = modal.querySelector('input[type="email"]');
    if (!email) return;

    const wrapper = document.createElement('div');
    wrapper.dataset.egPhoneField = 'true';
    wrapper.className = 'egPhoneField';
    wrapper.innerHTML = `<label>Phone number<div class="egPhoneRow"><select aria-label="Country calling code" class="egCountryCode">${countryOptions.map(c => `<option value="${c.iso}" data-code="${c.code}">${c.name} (${c.code})</option>`).join('')}</select><input type="tel" inputmode="tel" autocomplete="tel" class="egPhoneNumber" placeholder="Phone number" aria-label="Phone number"></div><small class="egPhoneHint">Choose your country and enter your number.</small></label>`;

    const nameInput = modal.querySelector('input[placeholder="Your name"]');
    const anchor = nameInput?.closest('label')?.nextElementSibling;
    (anchor || email.closest('label'))?.before(wrapper);

    const select = wrapper.querySelector('.egCountryCode');
    const phone = wrapper.querySelector('.egPhoneNumber');
    const nigeria = countryOptions.find(c => c.iso === 'NG');
    if (nigeria) select.value = nigeria.iso;
    const sync = () => {
      const option = select.options[select.selectedIndex];
      const code = option?.dataset?.code || '';
      const digits = phone.value.replace(/\D/g, '');
      window.__errandGoSignupPhone = digits ? `${code}${digits.replace(/^0+(?=\d)/, '')}` : '';
      window.__errandGoSignupCountry = option?.textContent?.replace(/\s*\(\+\d[\d-]*\)$/, '') || '';
    };
    select.addEventListener('change', sync);
    phone.addEventListener('input', sync);
    sync();
  };
  const observer = new MutationObserver(ensure);
  observer.observe(document.body, { childList: true, subtree: true });
  ensure();
}

if (typeof window !== 'undefined') {
  window.__errandGoSignupPhone = '';
  window.__errandGoSignupCountry = '';
  window.setTimeout(setupPhoneSignupUI, 0);
}

export async function signUp(email, password, profile = {}) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const phone = window.__errandGoSignupPhone || '';
  const country = window.__errandGoSignupCountry || '';
  if (!phone) return { data: null, error: new Error('Please enter your phone number and select your country code.') };
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { ...profile, phone, country } },
  });
}

export async function signOut() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}
