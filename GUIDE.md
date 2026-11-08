# Room Call: setup, deploy, Android app

```
call-app/
├── server/   Node + Express + ws   (signaling only, no DB, audio never touches it)
└── client/   React + Vite PWA      (WebRTC mesh, password gate, call UI)
```

Audio goes **directly phone to phone** (WebRTC mesh). The server only introduces people, relays pinches, and tells you who is in the room. With 10 people each phone holds 9 audio connections, which is fine for voice.

---

## 1. Run locally

```bash
# terminal 1
cd server
npm install
npm start                      # http://localhost:3001  (check /health)

# terminal 2
cd client
cp .env.example .env           # edit VITE_APP_PASSWORD
npm install
npm run dev                    # http://localhost:5173
```

`localhost` counts as a secure origin, so the mic works. To test from a real phone you need HTTPS (see section 2); a quick way is `npx localtunnel --port 5173` or `cloudflared tunnel --url http://localhost:5173`, but then point `VITE_SIGNAL_URL` at a tunnelled/wss server too.

Test the PWA build (service worker only registers in production builds):
```bash
npm run build && npm run preview
```

---

## 2. Deploy (HTTPS is mandatory)

Browsers only allow the microphone on `https://`, and an HTTPS page can only open `wss://` sockets. So both client and server need TLS.

### Server (any host that supports WebSockets)
Render, Railway, Fly.io, or a small VPS all work.

**Render / Railway:** new Web Service, root directory `server`, build `npm install`, start `npm start`. Set env:
```
ALLOWED_ORIGINS=https://call.yourdomain.com
```
Your URL (e.g. `https://roomcall-api.onrender.com`) becomes `wss://roomcall-api.onrender.com` for the client. Free tiers sleep when idle, so open `/health` a few minutes before your event.

**VPS (Ubuntu) with Caddy for automatic TLS:**
```bash
cd server && npm install --omit=dev
npm i -g pm2 && pm2 start index.js --name roomcall && pm2 save && pm2 startup
```
`/etc/caddy/Caddyfile`:
```
api.yourdomain.com {
    reverse_proxy localhost:3001
}
```
Caddy proxies WebSockets automatically. A `Dockerfile` is also included.

### Client (static files)
```bash
cd client
# set these in your host's build env, or in client/.env
VITE_APP_PASSWORD=your-event-password
VITE_SIGNAL_URL=wss://api.yourdomain.com
npm run build                  # output: client/dist
```
Upload `dist` to Netlify, Cloudflare Pages, Vercel, or any static host. Needs HTTPS and **SPA fallback to `/index.html`** (Netlify/Cloudflare Pages do this by default for SPAs; nginx: `try_files $uri /index.html;`). Serve `/.well-known/assetlinks.json` and `/manifest.webmanifest` as plain files.

### TURN server (strongly recommended)
STUN alone fails for a good share of mobile users (carrier-grade NAT is very common on Indian mobile networks). Without TURN, some people will connect and hear nothing.

- Easiest: a free/cheap hosted TURN (Metered, Twilio, Cloudflare Calls). Copy their credentials.
- Self-host: `coturn` on a small VPS (port 3478 + 5349 TLS).

Then set at build time:
```
VITE_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.yourdomain.com:3478","username":"USER","credential":"PASS"}]
```
Rebuild and redeploy the client after changing it.

---

## 3. Using the app

1. Open the app, enter the password. After 3 wrong tries it locks for 30s, then 60s, 120s... up to 15 min. The lock survives page refresh.
2. **Create room** gives a 6-character code. Tap the code chip in the call to share an invite link (`/?room=CODE`).
3. Others open the link or type the code and tap **Join** (max 10 per room).
4. **Mute**, **Speaker/Phone**, **Pinch** are the bottom buttons. **End** is the small button in the top-left corner and always asks for confirmation. The Android back button and page reload also ask first.
5. **Pinch** makes everyone else's phone play a loud ~1s beep sequence, vibrate for 1s, and flash the screen. If their app is in the background, they also get a system notification that vibrates.

---

## 4. Turn it into an Android app (TWA with Bubblewrap)

A TWA is your PWA running full-screen inside Chrome, packaged as an APK. It must be deployed first, with a valid manifest on a real HTTPS domain.

### Prerequisites
- Node 18+
- JDK 17 and Android SDK. Bubblewrap offers to download both on first run; accept.
- Your client deployed at e.g. `https://call.yourdomain.com`

### Steps
```bash
npm i -g @bubblewrap/cli
mkdir twa && cd twa
bubblewrap init --manifest=https://call.yourdomain.com/manifest.webmanifest
```
Answer the prompts. Important ones:
- **Application ID**: e.g. `com.yourname.roomcall` (cannot change later)
- **Enable notifications**: **Yes** (needed for the background pinch alert)
- **Signing key**: let it create one, and **back up the `.keystore` file and passwords**. You need the same key for every future update.

Build:
```bash
bubblewrap build
```
Output: `app-release-signed.apk` (install on phones) and `app-release-bundle.aab` (Play Store).

### Remove the browser URL bar (Digital Asset Links)
Until this is done, the app shows a Chrome address bar at the top.

1. Get your signing key fingerprint:
   ```bash
   bubblewrap fingerprint list
   ```
   (or `keytool -list -v -keystore android.keystore`)
2. Edit `client/public/.well-known/assetlinks.json`:
   - `package_name` = your Application ID
   - `sha256_cert_fingerprints` = the SHA-256 value
3. Rebuild and redeploy the client, then check `https://call.yourdomain.com/.well-known/assetlinks.json` loads.
4. Uninstall and reinstall the APK. Fully close and reopen it.

---

## 5. Getting the app onto phones

**Option A: share the APK** (best for an event)
- Upload `app-release-signed.apk` to Google Drive / GitHub Releases / your own server and share the link, or turn the link into a QR code.
- On each Android phone: open the link, download, tap the file, allow "Install unknown apps" for that browser/file manager once, then install.

**Option B: direct install over USB**
```bash
adb install app-release-signed.apk
```

**Option C: no APK at all.** Open the site in Chrome, then menu, **Install app** (the lobby also shows an "Install app" link when Chrome offers it). Same app, just not from the Bubblewrap build.

**Option D: Play Store.** Upload the `.aab` ($25 one-time developer fee, review needed). Overkill for an event.

---

## 6. Tips for stable calls on the day

On each phone, once:
- Allow **Microphone** and **Notifications** when asked.
- Settings, Apps, Room Call, Battery: set to **Unrestricted** (stops aggressive phone makers like Xiaomi, Oppo, Vivo, Samsung from killing the app in background).
- Join on Wi-Fi or 4G/5G with a decent signal; keep the app open once before switching apps.

Event checklist:
- Open the server `/health` URL beforehand (wakes free-tier hosts).
- Test one full run with 3+ real phones on mobile data, not just Wi-Fi.
- Use headphones if people are in the same physical room (prevents echo).

---

## 7. Honest limitations

- **The password is not real security.** `VITE_*` values are compiled into the JS, so anyone who looks can read it. It keeps casual visitors out, nothing more. Anyone with the URL could also use the signaling server directly; for stronger control, put the server behind `ALLOWED_ORIGINS` and rotate room codes per event.
- **Background audio** works on Android Chrome/TWA while the mic is active and a call is connected (a media notification appears). Some phone makers still kill apps; the battery setting above is the fix. iPhones are far stricter: iOS suspends web apps in the background, so this is an Android-first design.
- **Vibration**: browsers block `navigator.vibrate` while the page is hidden. That is why a background pinch uses a notification (which vibrates according to the phone's notification settings and sound mode).
- **Beep volume**: a web app can use full-scale audio but cannot override the phone's system volume or silent mode.
- **Speaker/Phone button**: web apps can only switch outputs the browser lists (`setSinkId`). Recent Android Chrome often lists Speaker/Earpiece; if a phone doesn't, the button shows a notice instead. Guaranteed earpiece routing would need a native wrapper.
- **Reconnects**: if a phone's network drops, it auto-rejoins the room with backoff and rebuilds the audio links. Rooms exist only in server memory, so a server restart ends all rooms.
