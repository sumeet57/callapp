import { useEffect, useState } from 'react';
import { lockLeft, triesLeft, registerFail, resetFails, safeEqual, markUnlocked } from './lib/lock.js';

const PASS = import.meta.env.VITE_APP_PASSWORD || '';

export default function Gate({ onOk }) {
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');
  const [left, setLeft] = useState(lockLeft());

  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => {
      const l = lockLeft();
      setLeft(l);
      if (l <= 0) setMsg('');
    }, 500);
    return () => clearInterval(id);
  }, [left > 0]);

  if (!PASS) {
    return (
      <main className="screen center">
        <h1>Room Call</h1>
        <p className="dim">VITE_APP_PASSWORD is not set. Add it to the client .env and rebuild.</p>
      </main>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (lockLeft() > 0) return;
    if (safeEqual(value, PASS)) {
      resetFails();
      await markUnlocked();
      onOk();
      return;
    }
    registerFail();
    setValue('');
    const l = lockLeft();
    setLeft(l);
    setMsg(l > 0 ? 'Too many attempts.' : `Wrong password. ${triesLeft()} ${triesLeft() === 1 ? 'try' : 'tries'} left.`);
  };

  const locked = left > 0;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <main className="screen center">
      <h1>Room Call</h1>
      <p className="dim">Enter password to continue</p>
      <form onSubmit={submit} className="stack" autoComplete="off">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Password"
          disabled={locked}
          autoFocus
          autoComplete="off"
          aria-label="Password"
        />
        <button className="btn" type="submit" disabled={locked || !value}>
          Unlock
        </button>
      </form>
      <p className="msg" role="status">
        {locked ? `${msg} Try again in ${mm}:${ss}` : msg}
      </p>
    </main>
  );
}
