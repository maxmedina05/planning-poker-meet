# Publishing Plan — Planning Poker Meet Add-on to Google Workspace Marketplace

## Stack Migration Summary

| Layer | Current | Target |
|-------|---------|--------|
| Hosting | GitHub Pages | Firebase Hosting |
| Database | Firebase Realtime Database (open rules) | Cloud Firestore (auth-scoped rules + TTL) |
| Identity | `localStorage` random ID (`poker_id`) | Firebase Anonymous Auth (`auth.currentUser.uid`) |
| Bot protection | App Check + reCAPTCHA v3 (secret key leaked in client) | App Check + reCAPTCHA v3 (site key only, secret removed) |
| CI/CD | GitHub Actions → GitHub Pages | GitHub Actions → `firebase deploy` |
| Room cleanup | None (data persists forever) | Firestore TTL policy (24h auto-delete, free) |
| Marketplace | HTTP deployment (dev install only) | Published listing on Google Workspace Marketplace |

---

## 1. Pre-Migration Cleanup

### 1.1 Remove reCAPTCHA secret key exposure

1. In GitHub repo **Settings → Secrets and variables → Actions**, delete the `RECAPTCHA_SITE_KEY` secret if it contains the **secret** key (not the site key). The reCAPTCHA v3 **site key** (starts with `6L...`) is safe for client-side use. The **secret key** must never appear in client code.
2. If the current `RECAPTCHA_SITE_KEY` secret is actually the site key (public), keep it but rename it to `RECAPTCHA_V3_SITE_KEY` for clarity.
3. Verify in the Firebase Console under **App Check → reCAPTCHA v3** that only the site key is referenced in client code. The secret key lives only in the Firebase Console backend.

### 1.2 Rotate compromised credentials

1. Go to the reCAPTCHA Admin Console and rotate the secret key for your site. This invalidates the old secret key if it was ever exposed in a deployed `config.js`.
2. In Firebase Console → **Project settings → General → Web API Key**: the API key itself is designed to be public and does not need rotation. However, restrict it via **API restrictions** in Google Cloud Console → **APIs & Services → Credentials** to only the APIs you use (Firebase Auth, Firestore, App Check).

### 1.3 Plan Realtime Database decommission

> Do NOT delete the Realtime Database until the Firestore migration is fully deployed and verified.

1. After Firestore migration is live and tested, go to Firebase Console → **Realtime Database**.
2. Delete all data under `rooms/`.
3. Set rules to deny all: `{ "rules": { ".read": false, ".write": false } }`.
4. Optionally disable the Realtime Database entirely (cannot be undone per-region).

### 1.4 Remove old files

1. Delete `firebase-rules.json` (Realtime DB rules file, replaced by `firestore.rules`).
2. Update `.gitignore` to un-ignore `.firebaserc` (it will now be committed — it only contains the project ID, which is safe).

---

## 2. Firestore Data Model

### 2.1 Collection structure

**Decision: votes as a map field, not a subcollection.** Firestore `onSnapshot` on a single document returns the entire document. Using a subcollection for votes would require a separate listener and complicate the reveal/reset logic. Since rooms have at most ~20 voters, a map field is well within Firestore's 1 MB document limit.

Final document structure — single document per room:

```
rooms/{meetingId}
```

```json
{
  "hostId": "anon_uid_abc123",
  "storyTitle": "User SSO login",
  "revealed": false,
  "expiresAt": "2026-03-25T14:30:00Z",
  "votes": {
    "anon_uid_abc123": "5",
    "anon_uid_def456": "8"
  }
}
```

### 2.2 TTL policy configuration

Firestore TTL automatically deletes documents when a timestamp field passes. It is free (no Cloud Functions needed).

**Setup via Firebase CLI / gcloud:**

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=rooms \
  --enable-ttl \
  --project=YOUR_PROJECT_ID
```

Or via Firebase Console: **Firestore → Time-to-live → Create policy** → Collection group: `rooms`, Field: `expiresAt`.

> **Note:** TTL deletion is "best effort" and may take up to 72 hours after expiry. This is acceptable for cleanup purposes — rooms are keyed by `meetingId` so stale data does not interfere with new meetings.

### 2.3 `expiresAt` refresh strategy

Every write operation to the room document must update `expiresAt` to `now + 24 hours`. This keeps active rooms alive and ensures abandoned rooms are cleaned up.

```javascript
function ttl24h() {
  return firebase.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
}
```

---

## 3. Firebase Anonymous Auth Integration

### 3.1 SDK changes in `sidepanel/index.html`

Replace the Realtime Database SDK with Firestore and Auth SDKs:

```html
<!-- Firebase — replace existing script tags -->
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check-compat.js"></script>
```

Remove:
```html
<!-- DELETE THIS LINE -->
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"></script>
```

### 3.2 Initialization order in `sidepanel/app.js`

Order matters — must be:

1. `firebase.initializeApp(CONFIG.firebase)`
2. App Check activation
3. `await firebase.auth().signInAnonymously()` → sets `myId`
4. Meet SDK session creation
5. Firestore operations begin

### 3.3 Replace localStorage identity

Replace the `poker_id` localStorage block with:

```javascript
// ── Participant identity (Anonymous Auth) ──────────────────────────────
let myId;
try {
  const userCredential = await firebase.auth().signInAnonymously();
  myId = userCredential.user.uid;
  console.log('[PlanningPoker] Signed in anonymously:', myId);
} catch (err) {
  loadingEl.textContent = 'Auth failed: ' + (err.message || String(err));
  console.error('[PlanningPoker] Auth error:', err);
  return;
}
```

- Delete the `poker_id` localStorage get/set block entirely.
- Anonymous auth sessions persist across page reloads by default — same behavior as the old localStorage approach, but with a cryptographically strong UID from Firebase.

### 3.4 Enable Anonymous Auth in Firebase Console

1. Firebase Console → **Authentication → Sign-in method**.
2. Enable **Anonymous** provider.
3. No OAuth consent screen changes needed.

---

## 4. Firebase App Check (reCAPTCHA v3 — Site Key Only)

### 4.1 New `config.js` / `config.example.js` structure

```javascript
const CONFIG = {
  cloudProjectNumber: 'YOUR_CLOUD_PROJECT_NUMBER',
  recaptchaSiteKey: 'YOUR_RECAPTCHA_V3_SITE_KEY',   // Public site key — safe for client
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID',
    // databaseURL removed — no longer using Realtime Database
  },
};
```

### 4.2 App Check code (unchanged pattern)

The existing App Check block in `app.js` remains the same:

```javascript
if (CONFIG.recaptchaSiteKey) {
  const appCheck = firebase.appCheck();
  appCheck.activate(
    new firebase.appCheck.ReCaptchaV3Provider(CONFIG.recaptchaSiteKey),
    true
  );
}
```

### 4.3 Enforce App Check in Firebase Console

1. Firebase Console → **App Check → Firestore** → Click **Enforce**.
2. This rejects all Firestore requests without a valid App Check token.
3. Also enforce for **Authentication** if the option is available.

> **SECURITY NOTE:** After enforcing App Check, test immediately. If the site key is misconfigured, all users will be locked out. Verify tokens are flowing before enforcing.

---

## 5. Firestore Real-Time Operations Migration

### 5.1 Operation mapping table

| Current (Realtime DB) | New (Firestore) |
|----------------------|-----------------|
| `firebase.database()` | `firebase.firestore()` |
| `db.ref('rooms/' + meetingId)` | `db.collection('rooms').doc(meetingId)` |
| `roomRef.on('value', cb)` | `roomDoc.onSnapshot(cb)` |
| `hostRef.transaction(fn)` | `db.runTransaction(async tx => ...)` |
| `roomRef.child('votes/' + myId).set(val)` | `roomDoc.update({ ['votes.' + myId]: val, expiresAt: ttl24h() })` |
| `roomRef.child('revealed').set(true)` | `roomDoc.update({ revealed: true, expiresAt: ttl24h() })` |
| `roomRef.update({ revealed: false, votes: {} })` | `roomDoc.update({ revealed: false, votes: {}, expiresAt: ttl24h() })` |
| `hostRef.set(myId)` | `roomDoc.update({ hostId: myId, expiresAt: ttl24h() })` |
| `storyRef.set(value)` | `roomDoc.update({ storyTitle: value, expiresAt: ttl24h() })` |

### 5.2 Firestore initialization

```javascript
const db = firebase.firestore();
const roomDoc = db.collection('rooms').doc(meetingId);
```

### 5.3 Real-time listener

```javascript
roomDoc.onSnapshot(snapshot => {
  const state    = snapshot.exists ? snapshot.data() : {};
  const votes    = state.votes    || {};
  const hostId   = state.hostId   || null;
  const revealed = state.revealed || false;
  const title    = state.storyTitle || '';
  // ... rest of existing listener logic unchanged
});
```

### 5.4 Atomic host claim (transaction)

```javascript
async function claimHostIfEmpty() {
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomDoc);
      if (!snap.exists) {
        tx.set(roomDoc, {
          hostId: myId,
          storyTitle: '',
          revealed: false,
          votes: {},
          expiresAt: ttl24h(),
        });
      } else if (!snap.data().hostId) {
        tx.update(roomDoc, { hostId: myId, expiresAt: ttl24h() });
      }
      // If hostId already set, do nothing
    });
  } catch (err) {
    console.error('[PlanningPoker] Host claim failed:', err);
  }
}
```

### 5.5 Vote, reveal, reset, story title

```javascript
function confirmVote() {
  if (!CARDS.includes(selectedCard)) return;
  confirmedCard = selectedCard;
  roomDoc.update({ ['votes.' + myId]: confirmedCard, expiresAt: ttl24h() });
}

function revealVotes() {
  roomDoc.update({ revealed: true, expiresAt: ttl24h() });
}

function newRound() {
  confirmedCard = null;
  selectedCard  = null;
  roomDoc.update({ revealed: false, votes: {}, expiresAt: ttl24h() });
  showVotingView();
}

function claimHost() {
  roomDoc.update({ hostId: myId, expiresAt: ttl24h() });
}

storyInput.addEventListener('blur', () => {
  roomDoc.update({ storyTitle: storyInput.value.trim(), expiresAt: ttl24h() });
});
```

---

## 6. Firebase Hosting Setup

### 6.1 Initialize Firebase Hosting

```bash
firebase init hosting
# Select existing project
# Public directory: . (root — no build step)
# Single-page app: No
# GitHub Actions automatic deploys: Yes
```

### 6.2 `firebase.json`

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "firestore.rules",
      "firestore.indexes.json",
      ".firebaserc",
      ".github/**",
      "docs/**",
      "*.md",
      "config.example.js",
      "node_modules/**",
      ".gitignore"
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "X-Frame-Options", "value": "ALLOWALL" },
          { "key": "X-Content-Type-Options", "value": "nosniff" }
        ]
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

> **CRITICAL:** `X-Frame-Options: ALLOWALL` is required. Google Meet loads the add-on in an iframe — without this header the side panel will be blank.

### 6.3 `.firebaserc`

```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

Commit this file (remove `.firebaserc` from `.gitignore` — it only contains the project ID, which is safe to commit).

### 6.4 Update `deployment.json`

```json
{
  "addOns": {
    "common": {
      "name": "Planning Poker",
      "logoUrl": "https://YOUR_PROJECT_ID.web.app/assets/logo.png"
    },
    "meet": {
      "web": {
        "sidePanelUrl": "https://YOUR_PROJECT_ID.web.app/sidepanel/index.html",
        "supportsScreenSharing": false,
        "addOnOrigins": ["https://YOUR_PROJECT_ID.web.app"],
        "logoUrl": "https://YOUR_PROJECT_ID.web.app/assets/logo.png"
      }
    }
  }
}
```

### 6.5 GitHub Actions workflow (`.github/workflows/deploy.yml`)

Replace the existing file with:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Generate config.js from secrets
        env:
          CLOUD_PROJECT_NUMBER: ${{ secrets.CLOUD_PROJECT_NUMBER }}
          FIREBASE_CONFIG: ${{ secrets.FIREBASE_CONFIG }}
          RECAPTCHA_V3_SITE_KEY: ${{ secrets.RECAPTCHA_V3_SITE_KEY }}
        run: |
          cat > config.js << JSEOF
          const CONFIG = {
            cloudProjectNumber: '${CLOUD_PROJECT_NUMBER}',
            recaptchaSiteKey: '${RECAPTCHA_V3_SITE_KEY}',
            firebase: ${FIREBASE_CONFIG}
          };
          JSEOF
          echo "config.js generated — $(wc -c < config.js) bytes"

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
```

### 6.6 GitHub Secrets — final state

| Secret | Action | Notes |
|--------|--------|-------|
| `CLOUD_PROJECT_NUMBER` | Keep | Unchanged |
| `FIREBASE_CONFIG` | Update | Remove `databaseURL` from the JSON value |
| `RECAPTCHA_SITE_KEY` | Delete | Replace with renamed version below |
| `RECAPTCHA_V3_SITE_KEY` | Add | reCAPTCHA v3 **site key** (public key only) |
| `FIREBASE_SERVICE_ACCOUNT` | Add | Service account JSON — generate via Firebase Console → Project settings → Service accounts → Generate new private key |
| `FIREBASE_PROJECT_ID` | Add | Firebase project ID string |

### 6.7 Disable GitHub Pages

After Firebase Hosting is confirmed working:
1. GitHub repo → **Settings → Pages** → Set source to **None**.

---

## 7. Firestore Security Rules

### 7.1 `firestore.rules`

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Deny everything by default
    match /{document=**} {
      allow read, write: if false;
    }

    match /rooms/{meetingId} {

      // Any authenticated user can read a room
      allow read: if request.auth != null;

      // Room creation: any authenticated user can create with valid schema
      allow create: if request.auth != null
        && isValidRoom(request.resource.data);

      // Room update: authenticated user, with field-level validation
      allow update: if request.auth != null
        && isValidRoom(request.resource.data)
        && isValidUpdate(resource.data, request.resource.data);
    }
  }

  // Validate the complete room document shape
  function isValidRoom(data) {
    return data.keys().hasAll(['hostId', 'storyTitle', 'revealed', 'votes', 'expiresAt'])
      && data.hostId is string
      && data.hostId.size() > 0
      && data.hostId.size() <= 128
      && data.storyTitle is string
      && data.storyTitle.size() <= 120
      && data.revealed is bool
      && data.votes is map
      && data.votes.size() <= 50
      && data.expiresAt is timestamp;
  }

  // Validate what changed in an update
  function isValidUpdate(before, after) {
    let voteDiff    = after.votes.diff(before.votes);
    let addedKeys   = voteDiff.addedKeys();
    let changedKeys = voteDiff.changedKeys();
    let removedKeys = voteDiff.removedKeys();

    // Case 1: User is writing only their own vote
    let isOwnVoteOnly =
      addedKeys.union(changedKeys).hasOnly([request.auth.uid])
      && removedKeys.size() == 0;

    // Case 2: Full reset — votes map is cleared entirely
    let isReset = after.votes.size() == 0;

    return isOwnVoteOnly || isReset;
  }
}
```

### 7.2 `firestore.indexes.json`

No custom indexes needed. Create an empty file:

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

### 7.3 Honest security assessment

> **Host action enforcement is NOT fully possible without a backend.**
>
> The following are intended to be facilitator-only actions but **cannot** be server-enforced client-side only:
> - Reveal votes (`revealed: true`)
> - New round (reset `votes` + `revealed`)
> - Update story title
> - Claim facilitator (`hostId`)
>
> **Why this is acceptable:** All participants are in the same Google Meet call and know each other. The worst-case abuse is someone prematurely reveals votes or resets a round — no meaningful payoff. Adding Cloud Functions for host enforcement would add cost and complexity disproportionate to the threat.
>
> **What IS enforced server-side:**
> - Only Firebase Anonymous Auth users can read/write (no unauthenticated access).
> - Users can only write their own vote key (`votes.{uid}` validated against `request.auth.uid`).
> - Vote map size capped at 50, storyTitle capped at 120 chars.
> - Data types validated (no unexpected fields).
> - App Check prevents requests from unauthorized apps/origins.

---

## 8. Google Workspace Marketplace Publishing

### 8.1 Prerequisites in Google Cloud Console

1. **OAuth consent screen** (required even without user OAuth):
   - **APIs & Services → OAuth consent screen**
   - User type: **External**
   - Fill in: App name, support email, developer contact
   - Scopes: none needed
   - Publishing status: start in **Testing**, move to **In production** before submission

2. **Google Workspace Marketplace SDK** — already enabled; configure the listing here.

3. **Google Workspace Add-ons API** — already enabled.

### 8.2 Marketplace SDK Configuration tab

- **App visibility:** Public
- **Installation settings:** Individual + Admin install
- **App integration:** Meet Add-on (HTTP deployment)
- **OAuth scopes:** Leave empty

### 8.3 Store Listing content

| Field | Value |
|-------|-------|
| App name | Planning Poker |
| Short description | Estimate story points during Google Meet calls with live voting |
| Detailed description | A lightweight Planning Poker add-on for Google Meet. Participants vote on story points using Fibonacci cards directly from the side panel — without leaving the call. Features: 10 standard cards (0,1,2,3,5,8,13,21,?,☕), live vote count, facilitator controls, results with average and range, multi-round support. |
| Category | Productivity |
| Support URL | GitHub repo URL |
| Privacy policy URL | **Required** — see section 8.5 below |

### 8.4 Required assets

| Asset | Spec |
|-------|------|
| App icon | 128×128 PNG |
| Banner (small) | 220×140 PNG |
| Banner (large) | 440×280 PNG |
| Screenshots | 1280×800 PNG, 1–5 images (show voting view, results view) |
| Manifest logo | 96×96 PNG minimum — current `assets/logo.png` is 48×48, **must create larger version** |

### 8.5 Privacy policy page (required)

Create `privacy.html` at the root of the project, served via Firebase Hosting at `https://YOUR_PROJECT_ID.web.app/privacy.html`.

Minimum content to cover:
- What is collected: anonymous Firebase UID (randomly generated, no personal data), votes cast during sessions.
- How it is stored: Google Cloud Firestore, auto-deleted after 24 hours of inactivity.
- What is NOT collected: name, email, Google account identity.
- No data sharing with third parties.
- Contact email for privacy questions.

### 8.6 Review process

- Submit via the Store Listing tab → **Publish**.
- Review typically takes **3–7 business days** for a personal account.
- Common rejection reasons: missing privacy policy, broken URLs, unclear description.
- You will receive an email on approval or rejection.

### 8.7 Installation after approval

- **Personal Google account:** Find in Marketplace and click Install, or use the direct install link.
- **Google Workspace (work) account:** Domain admin may need to allow third-party add-ons. If allowed, install from Marketplace as an individual. Domain-wide install available to admins via Admin Console.

---

## 9. Config and Secrets Cleanup

### 9.1 Updated `config.example.js`

```javascript
// Copy this file to config.js and fill in your values.
// config.js is gitignored — never commit it directly.
// In CI, config.js is generated automatically from GitHub Actions secrets.
//
// NOTE: Firebase client config is intentionally public — security is enforced
// via Firestore Security Rules + Anonymous Auth + App Check.

const CONFIG = {
  cloudProjectNumber: 'YOUR_CLOUD_PROJECT_NUMBER',
  recaptchaSiteKey: 'YOUR_RECAPTCHA_V3_SITE_KEY',  // Public site key only
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },
};
```

---

## 10. Testing Checklist Before Publish

### 10.1 Firebase emulators (local dev)

```bash
npm install -g firebase-tools
firebase emulators:start --only auth,firestore
```

Add to `app.js` for local dev (guarded by hostname check):

```javascript
if (location.hostname === 'localhost') {
  firebase.auth().useEmulator('http://localhost:9099');
  firebase.firestore().useEmulator('localhost', 8080);
}
```

### 10.2 Firestore rules tests

- [ ] Unauthenticated user cannot read any room
- [ ] Authenticated user can read any room
- [ ] Authenticated user can create a room with valid schema
- [ ] User can write their own vote (`votes.{theirUID}`)
- [ ] User CANNOT write another user's vote (`votes.{otherUID}`)
- [ ] `storyTitle` longer than 120 chars is rejected
- [ ] `expiresAt` must be a timestamp
- [ ] Document missing required fields is rejected on create
- [ ] Votes map with >50 entries is rejected

### 10.3 Anonymous Auth

- [ ] First load: user signed in anonymously (`firebase.auth().currentUser` has UID)
- [ ] UID persists across page reloads
- [ ] Clearing browser data generates a new UID (acceptable)
- [ ] UID is used as vote key in Firestore

### 10.4 App Check

- [ ] Deploy to Firebase Hosting
- [ ] Verify App Check tokens are issued in browser console
- [ ] Enable enforcement and confirm the app still works
- [ ] Raw Firestore REST call without App Check token returns 403

### 10.5 End-to-end in Google Meet

- [ ] Two accounts open the add-on in the same meeting
- [ ] First opener becomes facilitator (host badge)
- [ ] Both pick and confirm a card — vote count updates for both
- [ ] Facilitator reveals votes — both see results (average, range, cards)
- [ ] Facilitator starts new round — both reset to voting view
- [ ] Facilitator updates story title — other participant sees it
- [ ] Second participant claims facilitator — controls transfer
- [ ] Close and reopen side panel — state preserved (same UID via auth persistence)

---

## 11. Post-Publish Maintenance

### 11.1 Firebase free tier limits

| Resource | Spark Free Limit | Expected Usage |
|----------|-----------------|----------------|
| Firestore reads | 50,000/day | ~100 per session |
| Firestore writes | 20,000/day | ~50 per session |
| Firestore storage | 1 GiB | Negligible (TTL cleans up) |
| Anonymous Auth users | 10,000/month | Low for personal use |
| Hosting storage | 10 GiB | <1 MB for this app |
| Hosting transfer | 360 MB/day | <1 MB per user load |

**Set up a $0 budget alert:** Firebase Console → Usage and billing → Budget alerts, so you are notified before any charges occur.

### 11.2 Firestore TTL monitoring

- Monitor Firestore document count via Firebase Console → Firestore → Usage tab.
- If document count grows unexpectedly, verify `expiresAt` is being set correctly on every write.
- TTL deletions may take up to 72 hours after expiry — this is normal.

### 11.3 When to resubmit vs just redeploy

| Change | Action |
|--------|--------|
| Bug fixes, JS/CSS changes | `git push` → auto-deploys. No Marketplace action. |
| New features (same URLs) | `git push` → auto-deploys. No Marketplace action. |
| Change hosting URL | Update `deployment.json`, resubmit manifest in Cloud Console. |
| Change app name or description | Update Store Listing, resubmit for review. |
| Change logo or screenshots | Update Store Listing, resubmit for review. |
| Add new API scopes | Update OAuth consent screen + Store Listing, resubmit. |

> **Key insight:** The Marketplace listing only points to your URL. As long as the URL and manifest don't change, all code updates are live immediately on deploy with no review required.

---

## 12. Implementation Sequence

Execute phases in this order to minimize downtime and risk:

### Phase A — Firebase Setup *(no user-facing changes)*
1. Enable Firestore in Firebase Console
2. Enable Anonymous Auth
3. Configure TTL policy on `rooms` collection (`expiresAt` field)
4. Write `firestore.rules` and `firestore.indexes.json`
5. Create `firebase.json` and `.firebaserc`
6. Test rules locally with Firebase emulators

### Phase B — Code Migration
1. Update `sidepanel/index.html` — swap SDK script tags (remove Realtime DB, add Auth + Firestore)
2. Rewrite `sidepanel/app.js` — Anonymous Auth init + all Firestore operations
3. Update `config.example.js` — remove `databaseURL`
4. Test locally with emulators
5. Test in Google Meet with dev deployment

### Phase C — Hosting Migration
1. Run `firebase init hosting`
2. Update GitHub Actions workflow (`.github/workflows/deploy.yml`)
3. Add new GitHub secrets (`FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`)
4. Push to `main` → verify Firebase Hosting deploy succeeds
5. Update `deployment.json` with `web.app` URLs
6. Resubmit manifest in Google Cloud Console
7. Verify add-on works in Meet from new URL
8. Disable GitHub Pages

### Phase D — Security Hardening
1. Enforce App Check on Firestore in Firebase Console
2. Rotate reCAPTCHA secret key
3. Remove/update old GitHub secrets (`RECAPTCHA_SITE_KEY` → `RECAPTCHA_V3_SITE_KEY`)
4. Restrict Firebase API key in Cloud Console
5. Lock down Realtime Database rules, then delete its data

### Phase E — Marketplace Publishing
1. Create `privacy.html` and deploy
2. Create required image assets (icons, screenshots, banners)
3. Set OAuth consent screen to **In production**
4. Fill in Marketplace Store Listing
5. Submit for review
6. Wait for approval (3–7 business days)

### Phase F — Cleanup
1. Delete `firebase-rules.json` (old Realtime DB rules file)
2. Update `docs/architecture.md` to reflect new stack
3. Final end-to-end test after Marketplace approval
