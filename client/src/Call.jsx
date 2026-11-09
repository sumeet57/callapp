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
    <main className="call">
      <header className="call-top">
        <button
          className="end-corner"
          onClick={() => setConfirm(true)}
          aria-label="End call"
        >
          <EndCall size={18} />
        </button>
        <button
          className="room-chip"
          onClick={onShare}
          aria-label="Share room link"
        >
          <span>{room}</span>
          <Share size={16} />
        </button>
      </header>

      <section className="call-mid">
        <p className="sub">{sub}</p>
        <p className="timer">{fmt(secs)}</p>

        <ul className="grid">
          <li className="tile">
            <div
              className={`avatar me${mic.live ? "" : " muted"}${ptt && mic.talking ? " speaking" : ""}`}
            >
              {initials(name || "You")}
            </div>
            <span>{mic.live ? "You" : "You · mic off"}</span>
          </li>
          {peers.map((p) => (
            <li className="tile" key={p.id}>
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

      <p className="note" role="status">
        {note}
      </p>

      <footer className="controls">
        <div className="ctl">
          <button
            className="circle"
            onClick={onMode}
            aria-label={ptt ? "Mode: push to talk" : "Mode: open mic"}
          >
            {ptt ? <Walkie /> : <Wave />}
          </button>
          <span>{ptt ? "Push to talk" : "Open mic"}</span>
        </div>

        <div className="ctl">
          {ptt ? (
            <button
              className={`circle big${mic.talking ? " on" : ""}`}
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
              <Mic size={34} />
            </button>
          ) : (
            <button
              className={`circle big${mic.muted ? " on" : ""}`}
              onClick={() => engine.setMuted(!mic.muted)}
              aria-pressed={mic.muted}
              aria-label="Mute"
            >
              {mic.muted ? <MicOff size={34} /> : <Mic size={34} />}
            </button>
          )}
          <span>
            {ptt
              ? mic.talking
                ? "Talking…"
                : "Hold to talk"
              : mic.muted
                ? "Unmute"
                : "Mute"}
          </span>
        </div>

        <div className="ctl">
          <button
            className={`circle${speaker ? " on" : ""}`}
            onClick={onSpeaker}
            aria-pressed={speaker}
            aria-label="Speaker"
          >
            {speaker ? <Speaker /> : <Handset />}
          </button>
          <span>{speaker ? "Speaker" : "Phone"}</span>
        </div>

        <div className="ctl">
          <button
            className="circle"
            onClick={onPinch}
            disabled={cool}
            aria-label="Pinch"
          >
            <Bell />
          </button>
          <span>Pinch</span>
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
