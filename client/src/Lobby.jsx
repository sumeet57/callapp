import { useState } from 'react';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no I/O/0/1
export const genCode = () => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((v) => ALPHA[v % 32]).join('');
};
export const cleanCode = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export default function Lobby({ busy, error, onStart, canInstall, onInstall }) {
  const [name, setName] = useState(() => localStorage.getItem('rc_name') || '');
  const [code, setCode] = useState(() => cleanCode(new URLSearchParams(location.search).get('room')));

  const nm = () => {
    const n = name.trim().slice(0, 20);
    try {
      localStorage.setItem('rc_name', n);
    } catch {
      /* ignored */
    }
    return n;
  };
  const create = () => onStart({ room: genCode(), mode: 'create', name: nm() });
  const join = (e) => {
    e.preventDefault();
    if (code.length >= 4) onStart({ room: code, mode: 'join', name: nm() });
  };

  return (
    <main className="screen center">
      <h1>Room Call</h1>
      <p className="dim">Voice rooms, up to 10 people</p>

      <div className="stack">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          maxLength={20}
          aria-label="Your name"
          disabled={busy}
        />
        <button className="btn" onClick={create} disabled={busy}>
          {busy ? 'Connecting…' : 'Create room'}
        </button>

        <div className="or">
          <span>or join</span>
        </div>

        <form onSubmit={join} className="stack">
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
          <button className="btn ghost" type="submit" disabled={busy || code.length < 4}>
            Join room
          </button>
        </form>
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
