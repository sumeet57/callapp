import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Speaker,
  Handset,
  EndCall,
  Bell,
  Share,
  Walkie,
  Wave,
} from "./icons.jsx";

/* Self-contained, responsive styles for the call screen (no changes to styles.css needed).
   Every class is prefixed "cl-" so nothing clashes with the rest of the app. */
const CSS = `
.cl{
  --fg:#fff; --bg:#000; --dim:#8c8c8c; --line:#2b2b2b; --gap:clamp(8px,2.4vw,14px);
  height:100vh; height:100dvh; width:100%; max-width:560px; margin:0 auto;
  display:grid; grid-template-columns:minmax(0,1fr);
  grid-template-rows:auto minmax(0,1fr) auto auto;
  grid-template-areas:"top" "mid" "note" "dock";
  padding:calc(env(safe-area-inset-top,0px) + 10px) clamp(12px,4vw,20px) calc(env(safe-area-inset-bottom,0px) + 12px);
  overflow:hidden; position:relative; color:var(--fg); background:var(--bg);
}
.cl button{font-family:inherit}

/* top bar */
.cl-top{grid-area:top; display:flex; justify-content:space-between; align-items:center; gap:8px}
.cl-end{width:44px;height:44px;flex:0 0 auto;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--dim);display:grid;place-items:center;cursor:pointer}
.cl-chip{display:flex;align-items:center;gap:8px;height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--fg);font-weight:600;letter-spacing:.18em;font-size:14px;cursor:pointer;min-width:0}

/* middle: status + people */
.cl-mid{grid-area:mid; min-height:0; overflow-y:auto; display:flex; flex-direction:column; align-items:center; padding-top:clamp(2px,4dvh,40px); -webkit-overflow-scrolling:touch}
.cl-sub{margin:0;color:var(--dim);font-size:clamp(13px,3.8vw,15px);text-align:center}
.cl-timer{margin:4px 0 clamp(8px,2.6dvh,24px);font-size:clamp(30px,10vw,44px);font-weight:300;font-variant-numeric:tabular-nums;line-height:1.1}
.cl-grid{list-style:none;margin:0;padding:0 0 6px;width:100%;display:flex;flex-wrap:wrap;justify-content:center;gap:14px 8px}
.cl-tile{width:clamp(62px,19vw,84px);display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;text-align:center}
.cl-tile span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cl .avatar{width:clamp(44px,13.5vw,64px);height:clamp(44px,13.5vw,64px);font-size:clamp(13px,3.8vw,16px)}

.cl-note{grid-area:note;min-height:18px;margin:6px 0;text-align:center;font-size:13px;color:var(--dim)}

/* bottom dock */
.cl-dock{grid-area:dock; display:flex; flex-direction:column; gap:var(--gap); min-width:0}
.cl-row{display:flex; gap:var(--gap); min-width:0}

.cl-sec{
  flex:1 1 0; min-width:0; height:clamp(46px,7.5dvh,56px);
  display:flex; align-items:center; justify-content:center; gap:8px; padding:0 10px;
  border:1.5px solid var(--line); border-radius:14px; background:transparent; color:var(--fg);
  font-size:clamp(12px,3.5vw,14px); font-weight:600; cursor:pointer;
}
.cl-sec span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cl-sec svg{width:20px;height:20px;flex:0 0 auto}
.cl-sec:disabled{opacity:.35}
.cl-sec:active{background:#161616}

/* the two big buttons: hold-to-talk (or mute) and speaker */
.cl-big{
  min-width:0; height:clamp(104px,24dvh,200px);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:clamp(6px,1.4dvh,10px);
  border:2px solid var(--fg); border-radius:22px; background:transparent; color:var(--fg);
  font-size:clamp(12px,3.8vw,16px); font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  cursor:pointer; touch-action:none; user-select:none; -webkit-user-select:none;
  -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent;
  transition:background .1s,color .1s,transform .08s;
}
.cl-big svg{width:clamp(30px,9vw,44px);height:auto}
.cl-talk{flex:1.7 1 0}
.cl-spk{flex:1 1 0}
.cl-big.on{background:var(--fg);color:var(--bg);transform:scale(.985)}
.cl-big:active{transform:scale(.97)}
/* white fill is reserved for "talking" / "muted"; loudspeaker-on is a subtle tint so the two never look alike */
.cl-spk.on{background:#1c1c1c;color:var(--fg);transform:none}

/* short phones (e.g. 320x568, small browsers with toolbars) */
@media (max-height:620px){
  .cl-mid{padding-top:0}
  .cl-timer{margin-bottom:6px}
  .cl-big{height:clamp(88px,21dvh,130px)}
  .cl-sec{height:44px}
}

/* phones in landscape: info on the left, controls on the right */
@media (orientation:landscape) and (max-height:520px){
  .cl{
    max-width:none;
    grid-template-columns:minmax(0,1fr) minmax(250px,48%);
    grid-template-rows:auto minmax(0,1fr) auto;
    grid-template-areas:"top dock" "mid dock" "note dock";
    column-gap:18px;
    padding-left:calc(env(safe-area-inset-left,0px) + 16px);
    padding-right:calc(env(safe-area-inset-right,0px) + 16px);
  }
  .cl-dock{align-self:center}
  .cl-big{height:clamp(84px,34dvh,150px)}
  .cl-timer{font-size:28px;margin-bottom:6px}
}

/* tablets / desktop */
@media (min-width:700px) and (orientation:portrait){
  .cl-big{height:clamp(150px,22dvh,220px)}
}

@media (prefers-reduced-motion:reduce){.cl-big{transition:none}}
`;

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
// "Calm Fox" -> "CF", "Alex" -> "AL"
const initials = (n) => {
  const w = (n || "?").trim().split(/\s+/).filter(Boolean);
  return (
    w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)
  ).toUpperCase();
};
const fatalMsg = (c) =>
  c === "room-full"
    ? "Room is full (max 10)."
    : c === "bad-room"
      ? "Invalid room code."
      : "Disconnected from the room.";

export default function Call({ engine, room, name, onEnd }) {
  const [peers, setPeers] = useState(() => engine.snapshot());
  const [status, setStatus] = useState(engine.status);
  const [mic, setMic] = useState(() => engine.micState());
  const [speaker, setSpeaker] = useState(engine.speakerOn);
  const [confirm, setConfirm] = useState(false);
  const [secs, setSecs] = useState(0);
  const [alertName, setAlertName] = useState(null);
  const [cool, setCool] = useState(false);
  const [note, setNote] = useState("");
  const t0 = useRef(Date.now());
  const noteTimer = useRef();
  const alertTimer = useRef();

  const ptt = mic.mode === "ptt";

  const flashNote = (t) => {
    setNote(t);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(""), 2500);
  };

  useEffect(() => {
    const offs = [
      engine.on("peers", setPeers),
      engine.on("status", setStatus),
      engine.on("mic", setMic),
      engine.on("speaker", setSpeaker),
      engine.on("hangup-request", () => setConfirm(true)),
      engine.on("pinch", (p) => {
        setAlertName(p.name);
        clearTimeout(alertTimer.current);
        alertTimer.current = setTimeout(() => setAlertName(null), 1000);
      }),
      engine.on("fatal", (code) => {
        engine.end();
        onEnd(fatalMsg(code));
      }),
    ];
    const timer = setInterval(
      () => setSecs(Math.floor((Date.now() - t0.current) / 1000)),
      1000,
    );
    return () => {
      offs.forEach((f) => f());
      clearInterval(timer);
      clearTimeout(noteTimer.current);
      clearTimeout(alertTimer.current);
    };
  }, [engine]);

  // Safety: never leave an open mic behind in push-to-talk if the finger slips off,
  // the app goes to the background, or the window loses focus.
  useEffect(() => {
    const release = () => engine.setTalking(false);
    const vis = () => document.visibilityState === "hidden" && release();
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [engine]);

  // Block accidental exits: Android back button / reload both ask first.
  useEffect(() => {
    history.pushState({ call: 1 }, "");
    const onPop = () => {
      setConfirm(true);
      history.pushState({ call: 1 }, "");
    };
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  const doEnd = () => {
    engine.end();
    onEnd();
  };

  const onPinch = () => {
    if (peers.length === 0) return flashNote("No one else is here yet");
    if (engine.pinch()) {
      setCool(true);
      setTimeout(() => setCool(false), 1500);
      flashNote("Pinged everyone");
    }
  };

  const onSpeaker = async () => {
    const ok = await engine.toggleSpeaker();
    if (!ok) flashNote("Output switching is not available on this device");
  };

  const onShare = async () => {
    const url = `${location.origin}/?room=${room}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "Join my call",
          text: `Room ${room}`,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        flashNote("Invite link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const onMode = () => {
    const next = ptt ? "open" : "ptt";
    engine.setTalkMode(next);
    flashNote(
      next === "open"
        ? "Open mic: everyone can hear you"
        : "Push to talk: hold the button to speak",
    );
  };

  // Hold-to-talk button handlers
  const talkDown = (e) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignored */
    }
    engine.setTalking(true);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignored */
    }
  };
  const talkUp = () => engine.setTalking(false);
  const talkKeyDown = (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      engine.setTalking(true);
    }
  };
  const talkKeyUp = (e) => {
    if (e.key === " " || e.key === "Enter") engine.setTalking(false);
  };

  const sub =
    status === "reconnecting"
      ? "Reconnecting…"
      : peers.length === 0
        ? "Waiting for others to join"
        : `${peers.length + 1} in call`;

  return (
    <main className="cl">
      <style>{CSS}</style>

      <header className="cl-top">
        <button
          className="cl-end"
          onClick={() => setConfirm(true)}
          aria-label="End call"
        >
          <EndCall size={18} />
        </button>
        <button
          className="cl-chip"
          onClick={onShare}
          aria-label="Share room link"
        >
          <span>{room}</span>
          <Share size={16} />
        </button>
      </header>

      <section className="cl-mid">
        <p className="cl-sub">{sub}</p>
        <p className="cl-timer">{fmt(secs)}</p>

        <ul className="cl-grid">
          <li className="cl-tile">
            <div
              className={`avatar me${mic.live ? "" : " muted"}${ptt && mic.talking ? " speaking" : ""}`}
            >
              {initials(name || "You")}
            </div>
            <span>{mic.live ? "You" : "You · mic off"}</span>
          </li>
          {peers.map((p) => (
            <li className="cl-tile" key={p.id}>
              <div
                className={`avatar${p.speaking ? " speaking" : ""}${p.state !== "connected" ? " pending" : ""}`}
              >
                {initials(p.name)}
              </div>
              <span>{p.state === "connected" ? p.name : `${p.name}…`}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="cl-note" role="status">
        {note}
      </p>

      <footer className="cl-dock">
        {/* secondary row: mode + pinch */}
        <div className="cl-row">
          <button
            className="cl-sec"
            onClick={onMode}
            aria-label={ptt ? "Mode: push to talk" : "Mode: open mic"}
          >
            {ptt ? <Walkie /> : <Wave />}
            <span>{ptt ? "Push to talk" : "Open mic"}</span>
          </button>
          <button
            className="cl-sec"
            onClick={onPinch}
            disabled={cool}
            aria-label="Pinch"
          >
            <Bell />
            <span>Pinch</span>
          </button>
        </div>

        {/* primary row: big talk (or mute) + big speaker */}
        <div className="cl-row">
          {ptt ? (
            <button
              key="talk"
              className={`cl-big cl-talk${mic.talking ? " on" : ""}`}
              onPointerDown={talkDown}
              onPointerUp={talkUp}
              onPointerCancel={talkUp}
              onLostPointerCapture={talkUp}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={talkKeyDown}
              onKeyUp={talkKeyUp}
              aria-label="Hold to talk"
              aria-pressed={mic.talking}
            >
              <Mic />
              <span>{mic.talking ? "Talking…" : "Hold to talk"}</span>
            </button>
          ) : (
            <button
              key="mute"
              className={`cl-big cl-talk${mic.muted ? " on" : ""}`}
              onClick={() => engine.setMuted(!mic.muted)}
              aria-pressed={mic.muted}
              aria-label="Mute"
            >
              {mic.muted ? <MicOff /> : <Mic />}
              <span>{mic.muted ? "Unmute" : "Mute"}</span>
            </button>
          )}

          <button
            className={`cl-big cl-spk${speaker ? " on" : ""}`}
            onClick={onSpeaker}
            aria-pressed={speaker}
            aria-label="Speaker"
          >
            {speaker ? <Speaker /> : <Handset />}
            <span>{speaker ? "Speaker" : "Phone"}</span>
          </button>
        </div>
      </footer>

      {alertName && (
        <div className="flash" role="alert">
          <Bell size={48} />
          <p>{alertName} pinged you</p>
        </div>
      )}

      {confirm && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-title"
        >
          <div className="sheet">
            <h2 id="end-title">End call?</h2>
            <p className="dim">You will leave room {room}.</p>
            <button className="btn" onClick={() => setConfirm(false)} autoFocus>
              Keep talking
            </button>
            <button className="btn ghost" onClick={doEnd}>
              End call
            </button>
          </div>
        </div>
      )}
    </main>
  );
}