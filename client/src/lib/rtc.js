// WebRTC mesh engine. Each user connects directly to every other user (audio only).
// The NEW joiner always creates the offers, so offer collisions ("glare") cannot happen.
import { getCtx, unlock, playPinch, watchLevel } from './audio.js';

const SIGNAL_URL =
  import.meta.env.VITE_SIGNAL_URL ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3001`;

function iceServers() {
  try {
    const raw = import.meta.env.VITE_ICE_SERVERS;
    if (raw) return JSON.parse(raw);
  } catch {
    console.warn('VITE_ICE_SERVERS is not valid JSON, using default STUN');
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EARPIECE = /ear\s?piece|receiver|handset/i;
const SPEAKER = /speaker/i;

export class CallEngine {
  constructor() {
    this.h = {};
    this.peers = new Map();
    this.stream = null;
    this.ws = null;
    this.myId = null;
    this.muted = false;
    this.closed = false;
    this.sinkId = '';
    this.speakerOn = true;
    this.status = 'connecting';
    this.retry = 0;
    this.reconnecting = false;
    this.lastSeen = 0;
    this.lastPinch = 0;
    this.host = document.createElement('div');
    this.host.hidden = true;
    document.body.appendChild(this.host);
    this._wake = () => {
      if (document.visibilityState === 'visible' || document.visibilityState === undefined) this.wake();
    };
    this._online = () => this.wake();
  }

  // ---------- tiny event emitter ----------
  on(evt, fn) {
    (this.h[evt] ||= []).push(fn);
    return () => {
      this.h[evt] = (this.h[evt] || []).filter((f) => f !== fn);
    };
  }
  emit(evt, data) {
    (this.h[evt] || []).slice().forEach((f) => {
      try {
        f(data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  snapshot() {
    return [...this.peers.values()].map((p) => ({
      id: p.id,
      name: p.name,
      state: p.state,
      speaking: p.speaking,
    }));
  }
  emitPeers() {
    this.emit('peers', this.snapshot());
  }

  // ---------- lifecycle ----------
  async start({ room, mode, name }) {
    this.room = room;
    this.mode = mode;
    this.name = name;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone needs a secure (https) connection.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    await this.connect();
    this.mode = 'rejoin';
    this.status = 'connected';
    document.addEventListener('visibilitychange', this._wake);
    window.addEventListener('online', this._online);
    this.pingTimer = setInterval(() => this.tick(), 15000);
    this.setupMediaSession();
    this.initOutput();
  }

  end() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.pingTimer);
    document.removeEventListener('visibilitychange', this._wake);
    window.removeEventListener('online', this._online);
    this.send({ t: 'leave' });
    this.dropAllPeers();
    this.dropWs();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.host.remove();
    try {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
      }
    } catch {
      /* ignored */
    }
    this.h = {};
  }

  wake() {
    if (this.closed) return;
    unlock();
    if (!this.ws || this.ws.readyState > 1) {
      this.retry = 0;
      this.scheduleReconnect();
    }
  }

  // ---------- signaling socket ----------
  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  dropWs() {
    const w = this.ws;
    this.ws = null;
    if (w) {
      w.onmessage = w.onclose = w.onerror = w.onopen = null;
      try {
        w.close();
      } catch {
        /* ignored */
      }
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      this.dropWs();
      const ws = new WebSocket(SIGNAL_URL);
      this.ws = ws;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      };
      const timer = setTimeout(() => {
        if (this.ws === ws) this.dropWs();
        fail(new Error('Cannot reach the server.'));
      }, 10000);

      ws.onopen = () => {
        this.lastSeen = Date.now();
        ws.send(JSON.stringify({ t: 'join', room: this.room, mode: this.mode, name: this.name }));
      };
      ws.onmessage = (e) => {
        let m;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        this.lastSeen = Date.now();
        if (m.t === 'joined') {
          clearTimeout(timer);
          this.myId = m.id;
          this.retry = 0;
          m.peers.forEach((p) => this.addPeer(p.id, p.name, true));
          this.emitPeers();
          if (!settled) {
            settled = true;
            resolve();
          }
        } else if (m.t === 'error') {
          const err = Object.assign(new Error(m.code), { code: m.code });
          if (!settled) {
            if (this.ws === ws) this.dropWs();
            fail(err);
          } else {
            this.emit('fatal', m.code);
          }
        } else {
          this.onMessage(m);
        }
      };
      ws.onclose = () => {
        if (!settled) return fail(new Error('Cannot reach the server.'));
        if (ws === this.ws) {
          this.ws = null;
          this.scheduleReconnect();
        }
      };
      ws.onerror = () => {};
    });
  }

  async scheduleReconnect() {
    if (this.closed || this.reconnecting) return;
    this.reconnecting = true;
    this.status = 'reconnecting';
    this.emit('status', this.status);
    this.dropAllPeers();
    while (!this.closed) {
      const delay = Math.min(1000 * 2 ** this.retry, 8000);
      this.retry++;
      await sleep(delay);
      if (this.closed) break;
      try {
        this.mode = 'rejoin';
        await this.connect();
        this.reconnecting = false;
        this.status = 'connected';
        this.emit('status', this.status);
        return;
      } catch (err) {
        if (err.code === 'room-full' || err.code === 'bad-room') {
          this.reconnecting = false;
          this.emit('fatal', err.code);
          return;
        }
      }
    }
    this.reconnecting = false;
  }

  // Keepalive + half-open detection (mobile networks silently drop sockets).
  tick() {
    if (this.closed || this.reconnecting) return;
    if (this.ws && this.ws.readyState === 1) {
      if (Date.now() - this.lastSeen > 45000) {
        this.dropWs();
        this.retry = 0;
        this.scheduleReconnect();
        return;
      }
      this.send({ t: 'ping' });
    } else if (!this.ws) {
      this.scheduleReconnect();
    }
  }

  onMessage(m) {
    switch (m.t) {
      case 'peer-joined':
        this.addPeer(m.id, m.name, false);
        this.emitPeers();
        break;
      case 'peer-left':
        this.removePeer(m.id);
        break;
      case 'signal':
        this.handleSignal(m.from, m.data);
        break;
      case 'pinch':
        this.handlePinch(m);
        break;
    }
  }

  // ---------- peers ----------
  addPeer(id, name, initiator) {
    if (this.peers.has(id)) this.removePeer(id, false);
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const peer = {
      id,
      name,
      pc,
      initiator,
      state: 'connecting',
      pending: [],
      chain: Promise.resolve(),
      audio: null,
      speaking: false,
      stopLevel: null,
      timer: null,
    };
    this.peers.set(id, peer);
    this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ t: 'signal', to: id, data: { c: e.candidate } });
    };
    pc.ontrack = (e) => this.attachAudio(peer, e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      peer.state = pc.connectionState;
      this.emitPeers();
      clearTimeout(peer.timer);
      if (pc.connectionState === 'failed') this.restartIce(peer);
      else if (pc.connectionState === 'disconnected') {
        peer.timer = setTimeout(() => {
          if (pc.connectionState !== 'connected') this.restartIce(peer);
        }, 4000);
      }
    };
    if (initiator) this.makeOffer(peer, false);
  }

  removePeer(id, emit = true) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    clearTimeout(p.timer);
    p.stopLevel?.();
    try {
      p.pc.close();
    } catch {
      /* ignored */
    }
    if (p.audio) {
      p.audio.srcObject = null;
      p.audio.remove();
    }
    if (emit) this.emitPeers();
  }

  dropAllPeers() {
    [...this.peers.keys()].forEach((id) => this.removePeer(id, false));
    this.emitPeers();
  }

  restartIce(peer) {
    if (peer.initiator && this.peers.get(peer.id) === peer) this.makeOffer(peer, true);
  }

  makeOffer(peer, iceRestart) {
    peer.chain = peer.chain
      .then(async () => {
        const offer = await peer.pc.createOffer({ iceRestart });
        await peer.pc.setLocalDescription(offer);
        this.send({ t: 'signal', to: peer.id, data: { d: peer.pc.localDescription } });
      })
      .catch((e) => console.warn('offer failed', e));
  }

  handleSignal(from, data) {
    const peer = this.peers.get(from);
    if (!peer || !data) return;
    peer.chain = peer.chain
      .then(async () => {
        const pc = peer.pc;
        if (data.d) {
          await pc.setRemoteDescription(data.d);
          for (const c of peer.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
          if (data.d.type === 'offer') {
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            this.send({ t: 'signal', to: from, data: { d: pc.localDescription } });
          }
        } else if (data.c) {
          if (pc.remoteDescription) await pc.addIceCandidate(data.c).catch(() => {});
          else peer.pending.push(data.c);
        }
      })
      .catch((e) => console.warn('signal failed', e));
  }

  attachAudio(peer, stream) {
    if (!peer.audio) {
      const a = document.createElement('audio');
      a.autoplay = true;
      a.playsInline = true;
      this.host.appendChild(a);
      peer.audio = a;
    }
    const a = peer.audio;
    a.srcObject = stream;
    if (this.sinkId && a.setSinkId) a.setSinkId(this.sinkId).catch(() => {});
    a.play().catch(() => {});
    peer.stopLevel?.();
    peer.stopLevel = watchLevel(stream, (lvl) => {
      const s = lvl > 0.06;
      if (s !== peer.speaking) {
        peer.speaking = s;
        this.emitPeers();
      }
    });
  }

  // ---------- controls ----------
  setMuted(m) {
    this.muted = m;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !m));
    try {
      navigator.mediaSession?.setMicrophoneActive?.(!m);
    } catch {
      /* ignored */
    }
    this.emit('muted', m);
  }

  pinch() {
    const now = Date.now();
    if (now - this.lastPinch < 1500) return false;
    this.lastPinch = now;
    this.send({ t: 'pinch' });
    return true;
  }

  async handlePinch(m) {
    const who = m.name || 'Someone';
    this.emit('pinch', { name: who });
    try {
      playPinch();
    } catch {
      /* ignored */
    }
    try {
      navigator.vibrate?.(1000);
    } catch {
      /* ignored */
    }
    // Page hidden -> vibrate()/beep may be blocked, so also raise a system notification.
    if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        reg?.showNotification(`${who} pinged you`, {
          body: `Room ${this.room}`,
          vibrate: [1000],
          tag: 'pinch',
          renotify: true,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
        });
      } catch {
        /* ignored */
      }
    }
  }

  // ---------- audio output (speaker / phone) ----------
  async outputs() {
    try {
      return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
    } catch {
      return [];
    }
  }

  async route(id) {
    this.sinkId = id;
    const jobs = [];
    this.peers.forEach((p) => p.audio?.setSinkId && jobs.push(p.audio.setSinkId(id)));
    const c = getCtx();
    if (c.setSinkId) jobs.push(c.setSinkId(id));
    await Promise.allSettled(jobs);
  }

  async initOutput() {
    const outs = await this.outputs();
    const spk = outs.find((d) => SPEAKER.test(d.label) && !EARPIECE.test(d.label));
    if (spk && 'setSinkId' in HTMLMediaElement.prototype) {
      await this.route(spk.deviceId);
      this.speakerOn = true;
      this.emit('speaker', true);
    }
  }

  // Returns false when the browser/device doesn't expose selectable outputs.
  async toggleSpeaker() {
    if (!('setSinkId' in HTMLMediaElement.prototype)) return false;
    const outs = await this.outputs();
    if (outs.length < 2) return false;
    const ear = outs.find((d) => EARPIECE.test(d.label));
    const spk = outs.find((d) => SPEAKER.test(d.label) && !EARPIECE.test(d.label));
    let target;
    if (ear && spk) target = this.speakerOn ? ear : spk;
    else {
      const i = outs.findIndex((d) => d.deviceId === (this.sinkId || 'default'));
      target = outs[(i + 1) % outs.length];
    }
    await this.route(target.deviceId);
    this.speakerOn = !EARPIECE.test(target.label) && (SPEAKER.test(target.label) || target.deviceId === 'default');
    this.emit('speaker', this.speakerOn);
    return true;
  }

  // ---------- media notification (keeps the call visible/alive in background) ----------
  setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: `Room ${this.room}`,
        artist: 'Call in progress',
        artwork: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
      ms.playbackState = 'playing';
    } catch {
      /* ignored */
    }
    try {
      ms.setActionHandler('hangup', () => this.emit('hangup-request'));
    } catch {
      /* unsupported */
    }
    try {
      ms.setActionHandler('togglemicrophone', () => this.setMuted(!this.muted));
    } catch {
      /* unsupported */
    }
  }
}
