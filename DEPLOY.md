# Deployment Guide — Planning Poker Meet Add-on

Complete setup from a fresh clone to a working add-on inside Google Meet.
Follow the sections in order.

---

## Prerequisites

- A Google account (personal or Workspace)
- Access to [Google Cloud Console](https://console.cloud.google.com)
- Access to [Firebase Console](https://console.firebase.google.com)
- Node.js installed (for `firebase-tools`)
- Firebase CLI: `npm install -g firebase-tools`
- Git installed locally

---

## Part 1 — Google Cloud Setup

### 1.1 Create or select a project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown → **New Project**
3. Name it (e.g. `planning-poker-meet`) and click **Create**

### 1.2 Get your project number

1. With your project selected, go to **IAM & Admin → Settings**
2. Copy the **Project number** — a 12-digit integer like `123456789012`

> This is **not** the Project ID (the short string like `my-project-12345`). You need the number.

### 1.3 Enable required APIs

Go to **APIs & Services → Library** and enable:

1. **Google Workspace Marketplace SDK**
2. **Google Workspace Add-ons API**

---

## Part 2 — Firebase Setup

See [`docs/pre-test-setup.md`](docs/pre-test-setup.md) for the detailed walkthrough.
Summary of required steps:

1. Add Firebase to your Google Cloud project
2. Enable **Firestore** (production mode)
3. Enable **Anonymous Authentication**
4. Set up **TTL policy** on `rooms.expiresAt` (auto-deletes rooms after 24h)
5. Set up **reCAPTCHA v3** and register it with **Firebase App Check**

---

## Part 3 — Local Config

All secrets live in `.env` (gitignored). Copy the template and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and fill in each field:

| Variable | Where to find it |
|----------|-----------------|
| `CLOUD_PROJECT_NUMBER` | Cloud Console → IAM & Admin → Settings → Project number |
| `FIREBASE_PROJECT_ID` | Firebase Console → Project settings → General → Project ID |
| `RECAPTCHA_V3_SITE_KEY` | [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin) → your site → Site key |
| `FIREBASE_API_KEY` | Firebase Console → Project settings → Your apps → SDK snippet |
| `FIREBASE_AUTH_DOMAIN` | Same SDK snippet |
| `FIREBASE_STORAGE_BUCKET` | Same SDK snippet |
| `FIREBASE_MESSAGING_SENDER_ID` | Same SDK snippet |
| `FIREBASE_APP_ID` | Same SDK snippet |

---

## Part 4 — Deploy to Firebase Hosting

### 4.1 Log in to Firebase

```bash
firebase login
```

This opens a browser to authenticate. One-time setup.

### 4.2 Run the deploy script

```bash
./deploy.sh
```

This script:
1. Reads `.env`
2. Generates `config.js` (Firebase config for the browser)
3. Generates `.firebaserc` (tells Firebase CLI which project to use)
4. Runs `firebase deploy --only hosting,firestore:rules`

Once complete, your app is live at:
`https://YOUR_PROJECT_ID.web.app/sidepanel/index.html`

You should see: "Open this page inside Google Meet to use Planning Poker."

---

## Part 5 — Register the Add-on

### 5.1 Prepare the manifest

Copy the manifest template and fill in your project ID:

```bash
cp deployment.example.json deployment.json
```

Replace all four `YOUR_PROJECT_ID` placeholders in `deployment.json` with your
Firebase project ID. `deployment.json` is gitignored — it stays local.

### 5.2 Submit the manifest

In Google Cloud Console:
**APIs & Services → Google Workspace Marketplace SDK → HTTP deployments tab**

1. Click **Create new deployment**
2. Enter a deployment ID, e.g. `planning-poker-dev`
3. Click **Next**
4. Paste the full contents of `deployment.json` into the manifest field
5. Click **Submit**

### 5.3 Install the add-on for your account

On the HTTP deployments tab, find your deployment and click **Install**.

> This installs it only for your Google account — no Marketplace listing or
> review process required for dev use.

---

## Part 6 — Test It in Meet

1. Go to [meet.google.com](https://meet.google.com) and start a new meeting
2. Click the **Activities** panel (puzzle-piece icon, bottom right)
3. You should see **Planning Poker** listed
4. Click it — the side panel opens
5. The first person to open the add-on becomes the **Facilitator**
6. Open a second browser window with another Google account and join the same meeting
7. Test the full voting flow:
   - Both participants pick a card and confirm
   - Vote count updates live in both panels
   - Facilitator clicks **Reveal Votes** — both panels show results
   - Facilitator clicks **Start New Round** — both panels reset

---

## Updating the Add-on

| Change | What to do |
|--------|-----------|
| HTML / CSS / JS changes | `./deploy.sh` → live immediately |
| Version bump | Increment `VERSION` in `sidepanel/app.js`, then `./deploy.sh` |
| Firestore rules change | `./deploy.sh` (rules are always included) |
| New hosting URL | Update `deployment.json`, re-submit manifest in Cloud Console |
| Firebase config change | Update `.env`, re-run `./deploy.sh` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Add-on not visible in Activities panel | Not installed | Complete Part 5.3 |
| "Connecting to meeting…" never changes | `config.js` not loaded or parse error | Check browser console; verify `.env` is complete and `./deploy.sh` succeeded |
| "Auth failed" in loading screen | Anonymous Auth not enabled | Firebase Console → Authentication → Sign-in method → enable Anonymous |
| Firestore permission denied in console | Rules not deployed or App Check misconfigured | Re-run `./deploy.sh`; check App Check registration |
| Old version still showing in Meet | Browser cache | Hard refresh: `Ctrl+Shift+R` / `Cmd+Shift+R` |
| Logo shows as broken image | Image not deployed or wrong path | Verify `assets/logo.png` loads at your Firebase Hosting URL |
| Cross-origin error in console | Deployed URL doesn't match `addOnOrigins` | Check `deployment.json` origin matches your Firebase Hosting URL exactly |
| Page loads but SDK does nothing | Opened outside Meet | The SDK only activates inside an actual Meet session |
| `CONFIG is not defined` | `config.js` missing | Run `./deploy.sh` to regenerate it |
| Blank side panel in Meet | `X-Frame-Options` header missing | Verify `firebase.json` headers are deployed correctly |
