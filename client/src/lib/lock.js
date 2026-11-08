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

// Constant-time-ish string compare.
export function safeEqual(a, b) {
  let d = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
