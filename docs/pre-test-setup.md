# Pre-Test Setup Guide

Everything you need to do in Firebase Console + locally before running the app.
No CLI required for these steps — they're all done in the browser or your editor.

---

## 1. Create a Firebase project (skip if you already have one)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Name it (e.g. `planning-poker-meet`), disable Google Analytics if you don't need it
4. Click **Create project**

Note your **Project ID** (shown under the project name) — you'll use it throughout.

---

## 2. Enable Firestore

1. In the left sidebar, click **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (our `firestore.rules` file handles access)
4. Select a region closest to your users (e.g. `europe-west1` or `us-central`)
5. Click **Enable**

> The database is now live but locked down — no reads or writes until rules are deployed.

---

## 3. Enable Anonymous Authentication

1. In the sidebar, click **Build → Authentication**
2. Click **Get started**
3. Under the **Sign-in method** tab, find **Anonymous** and click it
4. Toggle **Enable**, then click **Save**

> This lets the app silently sign in each participant with a unique UID — no login screen.

---

## 4. Set up the TTL (auto-delete old rooms)

This tells Firestore to automatically delete room documents 24 hours after the meeting ends.

1. In the sidebar, click **Build → Firestore Database**
2. Click the **Indexes** tab at the top
3. Click the **Single field** sub-tab
4. Click **Add exemption** (or **Add single field index**)
5. Fill in:
   - **Collection group**: `rooms`
   - **Field path**: `expiresAt`
   - Under **TTL policy**: toggle **Enable TTL**
6. Click **Save**

> TTL deletion is eventually consistent — documents may linger a few hours past their expiry. That's fine.

---

## 5. Deploy Firestore Security Rules

The rules file at `firestore.rules` needs to be pushed to Firebase.
You need the Firebase CLI for this (one-time install).

```bash
# Install Firebase CLI globally (if not already installed)
npm install -g firebase-tools

# Log in
firebase login

# From the project root, deploy only the rules
firebase deploy --only firestore:rules
```

Verify in the console: **Firestore → Rules** — you should see the contents of `firestore.rules`.

---

## 6. Create `.firebaserc`

`.firebaserc` is gitignored (it contains your project ID). Copy the example and fill it in:

```bash
cp .firebaserc.example .firebaserc
```

Then open `.firebaserc` and replace the placeholder with your real project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

---

## 7. Create `config.js`

Copy the example and fill in real values:

```bash
cp config.example.js sidepanel/config.js
```

Then open `sidepanel/config.js` and fill in each field:

| Field | Where to find it |
|---|---|
| `cloudProjectNumber` | [Google Cloud Console](https://console.cloud.google.com) → select project → top of dashboard shows **Project number** |
| `recaptchaSiteKey` | Step 8 below |
| `apiKey` | Firebase Console → Project settings → Your apps → SDK snippet |
| `authDomain` | Same SDK snippet |
| `projectId` | Same SDK snippet |
| `storageBucket` | Same SDK snippet |
| `messagingSenderId` | Same SDK snippet |
| `appId` | Same SDK snippet |

**To get the Firebase SDK snippet:**
1. Firebase Console → gear icon → **Project settings**
2. Scroll to **Your apps** → click the web app (or create one: click `</>`)
3. Copy the `firebaseConfig` object

---

## 8. Set up reCAPTCHA v3 (App Check)

App Check prevents unauthorized clients from hitting your Firestore.

1. Go to [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin)
2. Click **+** (Create) in the top bar
3. Fill in:
   - **Label**: `Planning Poker`
   - **reCAPTCHA type**: **Score based (v3)**
   - **Domains**: add `localhost` and your production domain (e.g. `your-project-id.web.app`)
4. Click **Submit**
5. Copy the **Site key** (public) into `config.js` → `recaptchaSiteKey`
   - Keep the **Secret key** private — you don't need it in this app

**Register the site key with Firebase App Check:**
1. Firebase Console → **Build → App Check**
2. Click **Get started**
3. Under your web app, click **Register**
4. Choose **reCAPTCHA v3**, paste the **Site key**, click **Save**

---

## 9. Verify everything locally (optional but recommended)

The Firestore emulator requires Java. On WSL2, install the headless JDK first:

```bash
sudo apt install openjdk-21-jdk-headless
```

Then start the emulators:

```bash
# From the project root
npm install -g firebase-tools   # if not already done
firebase emulators:start --only auth,firestore
```

The emulators start at:
- Auth: `http://localhost:9099`
- Firestore: `http://localhost:8080`
- Emulator UI: `http://localhost:4000`

`app.js` already detects `localhost` and routes to the emulators automatically.

**Skip emulators entirely?** That's fine — you can test directly against your real
Firebase project using the dev deployment in Google Meet. The Firestore rules and
Anonymous Auth will behave identically.

---

## Checklist

- [ ] Firebase project created
- [ ] Firestore enabled (production mode)
- [ ] Anonymous Auth enabled
- [ ] TTL policy set on `rooms.expiresAt`
- [ ] `firestore.rules` deployed (`firebase deploy --only firestore:rules`)
- [ ] `.firebaserc` updated with real project ID
- [ ] `sidepanel/config.js` created from `config.example.js` and filled in
- [ ] reCAPTCHA v3 site key registered (Firebase App Check + `config.js`)

Once all boxes are checked, load the extension in Google Meet and open the side panel.
