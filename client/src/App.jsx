import { useEffect, useState } from 'react';
import Gate from './Gate.jsx';
import Lobby, { genCode } from './Lobby.jsx';
import Call from './Call.jsx';
import { CallEngine } from './lib/rtc.js';
import { unlock } from './lib/audio.js';

function explain(e) {
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError')
    return 'Microphone access was denied. Allow it in site settings and try again.';
  if (e?.name === 'NotFoundError') return 'No microphone found.';
  switch (e?.code) {
    case 'room-full':
      return 'Room is full (max 10).';
    case 'no-room':
      return 'No such room. Check the code.';
    case 'bad-room':
      return 'Invalid room code.';
  }
  return e?.message || 'Something went wrong.';
}

export default function App() {
  const [stage, setStage] = useState('gate');
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [installEvt, setInstallEvt] = useState(null);

  useEffect(() => {
    const h = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const begin = async ({ room, mode, name }) => {
    setBusy(true);
    setError('');
    unlock(); // inside the click gesture
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch {
      /* ignored */
    }
    let code = room;
    for (let attempt = 0; attempt < 4; attempt++) {
      const engine = new CallEngine();
      try {
        await engine.start({ room: code, mode, name });
        setSession({ engine, room: code, name });
        setStage('call');
        setBusy(false);
        return;
      } catch (e) {
        engine.end();
        if (e?.code === 'exists' && mode === 'create') {
          code = genCode(); // extremely rare collision: try another code
          continue;
        }
        setError(explain(e));
        break;
      }
    }
    setBusy(false);
  };

  const onEnd = (msg) => {
    setSession(null);
    setStage('lobby');
    setError(msg || '');
  };

  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice.catch(() => {});
    setInstallEvt(null);
  };

  if (stage === 'gate') return <Gate onOk={() => setStage('lobby')} />;
  if (stage === 'call' && session)
    return <Call engine={session.engine} room={session.room} name={session.name} onEnd={onEnd} />;
  return <Lobby busy={busy} error={error} onStart={begin} canInstall={!!installEvt} onInstall={install} />;
}
