// Password attempt limiter. State lives in localStorage so a refresh doesn't reset it.
// 3 wrong tries -> 30s lock, next 3 -> 60s, 120s, ... capped at 15 min.
const KEY = 'rc_gate_v1';

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { fails: 0, until: 0 };
  } catch {
    return { fails: 0, until: 0 };
  }
};
const save = (s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignored */
  }
};

export const lockLeft = () => Math.max(0, Math.ceil((load().until - Date.now()) / 1000));
export const triesLeft = () => 3 - (load().fails % 3);

export function registerFail() {
  const s = load();
  s.fails += 1;
  if (s.fails % 3 === 0) {
    const round = s.fails / 3;
    s.until = Date.now() + Math.min(30 * 2 ** (round - 1), 900) * 1000;
  }
  save(s);
}

export const resetFails = () => save({ fails: 0, until: 0 });

// ---- "remember me": once unlocked, skip the gate on this device ----
// Stores a hash of the current password, so changing VITE_APP_PASSWORD and redeploying
// automatically locks everyone out again.
const OK_KEY = 'rc_unlocked_v1';
const PASS = import.meta.env.VITE_APP_PASSWORD || '';

async function digest(s) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('rc:' + s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381;
    for (const c of 'rc:' + s) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
    return 'x' + h;
  }
}

export async function markUnlocked() {
  try {
    localStorage.setItem(OK_KEY, await digest(PASS));
  } catch {
    /* ignored */
  }
}

export async function isUnlocked() {
  if (!PASS) return false;
  try {
    const v = localStorage.getItem(OK_KEY);
    return !!v && v === (await digest(PASS));
  } catch {
    return false;
  }
}

// Constant-time-ish string compare.
export function safeEqual(a, b) {
  let d = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
