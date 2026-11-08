// Minimal WebRTC signaling server: Express (health) + ws (rooms, relay, pinch).
// No database. Rooms live in memory and vanish when the last user leaves.
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 3001;
const MAX_PEERS = Number(process.env.MAX_PEERS) || 10;
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
const ANY_ORIGIN = ALLOWED.includes('*');

/** @type {Map<string, Map<string, {ws: import('ws').WebSocket, name: string, lastPinch: number}>>} */
const rooms = new Map();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: ANY_ORIGIN ? true : ALLOWED }));
app.get('/', (_req, res) => res.type('text').send('p2p-call signaling server'));
app.get('/health', (_req, res) => {
  let peers = 0;
  rooms.forEach((m) => (peers += m.size));
  res.json({ ok: true, rooms: rooms.size, peers, uptime: Math.round(process.uptime()) });
});

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  maxPayload: 16 * 1024,
  verifyClient: ({ origin }) => ANY_ORIGIN || (origin && ALLOWED.includes(origin)),
});

const normRoom = (r) => {
  const v = String(r || '').toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(v) ? v : null;
};
const cleanName = (n) =>
  String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20);

const send = (ws, obj) => {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
};

function broadcast(room, exceptId, obj) {
  const members = rooms.get(room);
  if (!members) return;
  for (const [id, p] of members) if (id !== exceptId) send(p.ws, obj);
}

function cleanup(ws) {
  const info = ws.peer;
  if (!info) return;
  ws.peer = null;
  const members = rooms.get(info.room);
  if (!members) return;
  members.delete(info.id);
  if (members.size === 0) rooms.delete(info.room);
  else broadcast(info.room, info.id, { t: 'peer-left', id: info.id });
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.peer = null;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('error', () => {});

  // token bucket: 60 messages burst, refills 60/s (ICE candidates come in bursts)
  let tokens = 60;
  let last = Date.now();

  ws.on('message', (raw) => {
    const now = Date.now();
    tokens = Math.min(60, tokens + ((now - last) / 1000) * 60);
    last = now;
    if (--tokens < 0) return ws.close(1008, 'rate limit');

    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!m || typeof m.t !== 'string') return;

    switch (m.t) {
      case 'join': {
        if (ws.peer) return;
        const room = normRoom(m.room);
        if (!room) return send(ws, { t: 'error', code: 'bad-room' });
        let members = rooms.get(room);
        if (m.mode === 'create' && members) return send(ws, { t: 'error', code: 'exists' });
        if (m.mode === 'join' && !members) return send(ws, { t: 'error', code: 'no-room' });
        if (members && members.size >= MAX_PEERS) return send(ws, { t: 'error', code: 'room-full' });
        if (!members) {
          members = new Map();
          rooms.set(room, members);
        }
        const id = crypto.randomBytes(6).toString('hex');
        const name = cleanName(m.name) || 'Guest';
        const peers = [...members].map(([pid, p]) => ({ id: pid, name: p.name }));
        members.set(id, { ws, name, lastPinch: 0 });
        ws.peer = { id, room, name };
        send(ws, { t: 'joined', id, peers });
        broadcast(room, id, { t: 'peer-joined', id, name });
        break;
      }
      case 'signal': {
        const p = ws.peer;
        if (!p || typeof m.to !== 'string') return;
        const target = rooms.get(p.room)?.get(m.to);
        if (target) send(target.ws, { t: 'signal', from: p.id, data: m.data });
        break;
      }
      case 'pinch': {
        const p = ws.peer;
        if (!p) return;
        const me = rooms.get(p.room)?.get(p.id);
        if (!me || now - me.lastPinch < 1000) return;
        me.lastPinch = now;
        broadcast(p.room, p.id, { t: 'pinch', from: p.id, name: p.name });
        break;
      }
      case 'ping':
        send(ws, { t: 'pong' });
        break;
      case 'leave':
        cleanup(ws);
        break;
    }
  });

  ws.on('close', () => cleanup(ws));
});

// Drop half-open connections (common on mobile networks).
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`signaling server on :${PORT} (max ${MAX_PEERS}/room)`));

function shutdown() {
  clearInterval(heartbeat);
  wss.clients.forEach((c) => c.close(1001, 'server restart'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
