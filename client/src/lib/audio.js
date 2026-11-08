// Shared AudioContext: pinch beep + speaking-level detection.
let ctx;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
  }
  return ctx;
}

// Call from a user gesture (button click) so autoplay policy lets audio run later.
export async function unlock() {
  const c = getCtx();
  if (c.state !== 'running') {
    try {
      await c.resume();
    } catch {
      /* ignored */
    }
  }
  return c;
}

// ~1s of full-scale square-wave beeps (5 x 200ms).
export function playPinch() {
  const c = getCtx();
  if (c.state !== 'running') c.resume().catch(() => {});
  const t0 = c.currentTime + 0.02;
  const master = c.createGain();
  master.gain.value = 1;
  master.connect(c.destination);
  for (let i = 0; i < 5; i++) {
    const s = t0 + i * 0.2;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = i % 2 ? 1400 : 1000;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(1, s + 0.01);
    g.gain.setValueAtTime(1, s + 0.13);
    g.gain.linearRampToValueAtTime(0, s + 0.15);
    o.connect(g);
    g.connect(master);
    o.start(s);
    o.stop(s + 0.16);
  }
}

// Calls cb(level 0..1) every 250ms. Returns a stop function.
export function watchLevel(stream, cb) {
  const c = getCtx();
  let src;
  let an;
  try {
    src = c.createMediaStreamSource(stream);
    an = c.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
  } catch {
    return () => {};
  }
  const buf = new Uint8Array(an.fftSize);
  const id = setInterval(() => {
    an.getByteTimeDomainData(buf);
    let max = 0;
    for (let i = 0; i < buf.length; i++) {
      const d = Math.abs(buf[i] - 128);
      if (d > max) max = d;
    }
    cb(max / 128);
  }, 250);
  return () => {
    clearInterval(id);
    try {
      src.disconnect();
    } catch {
      /* ignored */
    }
  };
}
