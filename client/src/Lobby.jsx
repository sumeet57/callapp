import { useEffect, useState } from "react";
import { HTTP_BASE } from "./lib/rtc.js";
import { randomName } from "./lib/names.js";
import { Shuffle } from "./icons.jsx";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no I/O/0/1
export const genCode = () => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((v) => ALPHA[v % 32]).join("");
};
export const cleanCode = (s) =>
  (s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

// Saved name, or a random one from the pool on first launch.
function initialName() {
  try {
    const s = (localStorage.getItem("rc_name") || "").trim();
    if (s) return s.slice(0, 20);
  } catch {
    /* ignored */
  }
  return "";
}

export default function Lobby({ busy, error, onStart, canInstall, onInstall }) {
  const [name, setName] = useState(initialName());
  const [code, setCode] = useState(() =>
    cleanCode(new URLSearchParams(location.search).get("room")),
  );
  const [pub, setPub] = useState(true);
  const [rooms, setRooms] = useState(null); // null = loading
  const [listErr, setListErr] = useState(false);

  // Poll the public room list while this screen is visible.
  useEffect(() => {
    let stop = false;
    let ctl;
    const load = async () => {
      if (document.hidden) return;
      ctl?.abort();
      ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      try {
        const r = await fetch(`${HTTP_BASE}/rooms`, {
          signal: ctl.signal,
          cache: "no-store",
        });
        if (!r.ok) throw new Error("bad status");
        const j = await r.json();
        if (!stop) {
          setRooms(Array.isArray(j.rooms) ? j.rooms : []);
          setListErr(false);
        }
      } catch {
        if (!stop) setListErr(true);
      } finally {
        clearTimeout(timer);
      }
    };
    const onVis = () => {
      if (!document.hidden) load();
    };
    load();
    const id = setInterval(load, 4000);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(id);
      ctl?.abort();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Final display name: trimmed, falls back to a random one if left empty.
  const finalName = () => {
    const n = name.trim().slice(0, 20) || randomName();
    setName(n);
    try {
      localStorage.setItem("rc_name", n);
    } catch {
      /* ignored */
    }
    return n;
  };

  const create = () =>
    onStart({ room: genCode(), mode: "create", name: finalName(), pub });
  const join = (e) => {
    e.preventDefault();
    if (code.length >= 4)
      onStart({ room: code, mode: "join", name: finalName() });
  };
  const joinPublic = (r) =>
    onStart({ room: r.code, mode: "join", name: finalName() });

  return (
    <main className="screen top">
      <h1>Room Call</h1>
      <p className="dim">Voice rooms, up to 10 people</p>

      <div className="stack">
        <div className="namerow">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter Your Name"
            maxLength={20}
            aria-label="Your name"
            disabled={busy}
          />
          <button
            type="button"
            className="iconbtn"
            onClick={() => setName(randomName())}
            disabled={busy}
            aria-label="Pick a random name"
          >
            <Shuffle size={20} />
          </button>
        </div>
        <p className="hint">Other people in the room see this name</p>

        <button className="btn" onClick={create} disabled={busy}>
          {busy ? "Connecting…" : "Create room"}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={pub}
          className={`switch${pub ? " on" : ""}`}
          onClick={() => setPub(!pub)}
          disabled={busy}
        >
          <span className="knob" />
          <span className="lbl">
            {pub ? "Listed publicly" : "Private (code only)"}
          </span>
        </button>

        <div className="or">
          <span>join with code</span>
        </div>

        <form onSubmit={join} className="row">
          <input
            className="code"
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder="ROOM CODE"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Room code"
            disabled={busy}
          />
          <button
            className="btn ghost sm"
            type="submit"
            disabled={busy || code.length < 4}
          >
            Join
          </button>
        </form>

        <div className="or">
          <span>public rooms</span>
        </div>

        <ul className="rooms">
          {rooms === null && (
            <li className="empty">
              {listErr ? "Cannot load rooms" : "Loading…"}
            </li>
          )}
          {rooms !== null && rooms.length === 0 && (
            <li className="empty">
              {listErr ? "Cannot refresh rooms" : "No public rooms right now"}
            </li>
          )}
          {(rooms || []).map((r) => {
            const full = r.count >= r.max;
            return (
              <li key={r.code} className="room-row">
                <div className="room-info">
                  <b>{r.host}&apos;s room</b>
                  <small>{r.code}</small>
                </div>
                <span className="count">
                  {r.count}/{r.max}
                </span>
                <button
                  className="btn ghost sm"
                  onClick={() => joinPublic(r)}
                  disabled={busy || full}
                >
                  {full ? "Full" : "Join"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="msg" role="alert">
        {error}
      </p>
      {canInstall && (
        <button className="link" onClick={onInstall}>
          Install app
        </button>
      )}
    </main>
  );
}
