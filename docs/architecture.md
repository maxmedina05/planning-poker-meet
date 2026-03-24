# Architecture — Planning Poker Meet Add-on

## Core Decisions

### 1. Full Web App (not Apps Script)

> "Meet add-ons cannot be built entirely in Apps Script. You must, instead,
> build a full web app."
> — [Deploy a Meet add-on](https://developers.google.com/workspace/meet/add-ons/guides/deploy-add-on)

All code is static HTML/CSS/JS hosted on Firebase Hosting. No server required.

---

### 2. Side Panel Only

The Meet add-on model provides two frames — side panel and main stage. We use
only the side panel. All voting, reveal, and results happen there.

The main stage files (`mainstage/`) are scaffolded but unused. They exist in case
a future version wants a shared full-screen results view.

---

### 3. Real-time Sync: Cloud Firestore

Cloud Firestore is used to sync game state across all participants in real time.
The `meetingId` from the Meet SDK is used as the document ID so each meeting
gets its own isolated state. Documents auto-delete after 24 hours of inactivity
via a Firestore TTL policy on the `expiresAt` field.

**Why not the Co-Doing API?**
The Co-Doing API (`session.createCoDoingClient`) requires EAP (Early Access
Program) enrollment and is not available to new add-ons:
```
Meet Add-on SDK error: Could not connect to co channel.
The addon does not have permission to open a co.
This method might require EAP enrollment.
```

Firestore was chosen as the backend:
- Free tier (Spark plan) is sufficient for any team size
- Client SDK loads from CDN — no build step
- State persists so late joiners receive the current round state immediately
- `meetingId` as the document key provides natural isolation between meetings
- TTL policy auto-deletes stale rooms at no cost

**Firestore document shape** — single document per room at `rooms/{meetingId}`:
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

**Writes:**
- Each participant writes only their own vote: `votes.{myId}` field
- Facilitator writes `revealed`, `storyTitle`, `hostId`, and resets `votes`
- Every write refreshes `expiresAt` to `now + 24h`
- `roomDoc.onSnapshot()` fires for all participants on every change

---

### 4. Participant Identity: Firebase Anonymous Auth

Each participant is silently signed in with Firebase Anonymous Auth on load.
The resulting UID is used as their identity throughout the session.

```javascript
const userCredential = await firebase.auth().signInAnonymously();
myId = userCredential.user.uid;
```

Anonymous auth sessions persist across page reloads by default (IndexedDB),
so a participant's vote is preserved if they close and reopen the side panel.

Edge case: clearing browser storage or using a different browser generates a
new UID. The previous vote remains in Firestore under the old UID. The
participant can vote again — their new vote appears as an additional entry.

---

### 5. Host / Facilitator Detection

There is no "meeting host" concept in the Meet add-ons SDK. Facilitator role
is tracked in Firestore:

- First participant to open the add-on claims `hostId` via a Firestore
  transaction (atomic: only sets if document doesn't exist or `hostId` is null)
- If `myId === hostId`, the participant sees facilitator controls
- Any participant can overwrite `hostId` via the "Claim Facilitator" button
  (handles the case where the facilitator leaves mid-session)

---

### 6. Security Model

**Authentication:** Firebase Anonymous Auth — all Firestore reads/writes
require a valid auth token. Unauthenticated requests are rejected by rules.

**Authorization (Firestore Security Rules):**
- Any authenticated user can read any room
- Any authenticated user can create a room (with valid schema)
- Users can only write their own vote key (`votes.{uid}` validated against `request.auth.uid`)
- Full reset (clearing `votes`) is allowed for any authenticated user
- Vote map capped at 50 entries, `storyTitle` capped at 120 chars
- `expiresAt` must be a timestamp; all required fields enforced on create

**App Check (reCAPTCHA v3):** Proves requests originate from the legitimate
app/domain. Rejects requests from unauthorized clients before rules are even evaluated.

**Host action enforcement:** Reveal, reset, story title, and host claim are
NOT server-enforced — any authenticated participant can perform them.
This is an acceptable trade-off: all participants are in the same meeting
and know each other. Adding Cloud Functions for host enforcement would add
cost and complexity disproportionate to the threat.

---

### 7. Manifest Deployment: HTTP Deployment

The manifest (`deployment.json`) is submitted as JSON in:
**Google Cloud Console → APIs & Services → Google Workspace Marketplace SDK
→ HTTP deployments tab**

The manifest only needs re-submission when URLs or origins change. All
code changes are picked up automatically from Firebase Hosting at runtime.

---

## SDK Entry Points

### SDK Loading (CDN)

```html
<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check-compat.js"></script>
<!-- Meet Add-ons -->
<script src="https://www.gstatic.com/meetjs/addons/1.1.0/meet.addons.js"></script>
```

### Meet Session Initialization

```javascript
const session = await window.meet.addon.createAddonSession({
  cloudProjectNumber: CONFIG.cloudProjectNumber,
});
const sidePanelClient = await session.createSidePanelClient();
const meetingInfo = await sidePanelClient.getMeetingInfo();
// meetingInfo.meetingId   — used as Firestore document ID
// meetingInfo.meetingCode — human-readable "aaa-bbbb-ccc"
```

**Important:** `cloudProjectNumber` is the 12-digit **Project Number** from
Cloud Console → IAM & Admin → Settings. It is not the Project ID string.

### Dev Guard

The SDK requires a `meet_sdk` URL parameter that Meet injects into the iframe.
Opening the page directly in a browser will not have this parameter:

```javascript
if (typeof window.meet === 'undefined' ||
    !new URLSearchParams(window.location.search).has('meet_sdk')) {
  loadingEl.textContent = 'Open this page inside Google Meet.';
  return;
}
```

### Firebase Initialization

```javascript
firebase.initializeApp(CONFIG.firebase);
// Anonymous auth — must complete before any Firestore operations
const userCredential = await firebase.auth().signInAnonymously();
myId = userCredential.user.uid;
// Firestore
const db      = firebase.firestore();
const roomDoc = db.collection('rooms').doc(meetingId);
```

---

## Secrets and Config

`config.js` is gitignored and generated by GitHub Actions at deploy time.
It is never committed to the repository.

| Value | Where it lives | Commit? | Notes |
|-------|---------------|---------|-------|
| `cloudProjectNumber` | GitHub Actions secret → `config.js` | No | Public identifier, kept out of git for hygiene |
| `recaptchaSiteKey` | GitHub Actions secret → `config.js` | No | reCAPTCHA v3 site key — public, but kept out of git for hygiene |
| Firebase config (apiKey, etc.) | GitHub Actions secret → `config.js` | No | Designed to be public; security enforced by Firestore Rules + Auth + App Check |
| `.firebaserc` (project ID) | Local only | No | Gitignored; copy from `.firebaserc.example` |
| Service account / backend keys | Never in this repo | No | Would require a backend, which this project doesn't have |

For local development: copy `config.example.js` → `config.js` and `.firebaserc.example` → `.firebaserc`, then fill in values.

---

## Firestore Security Rules

See `firestore.rules` for the full rules file. Summary:

- Unauthenticated access: denied
- Authenticated read: allowed on any room
- Authenticated create: allowed with valid schema (all required fields, correct types)
- Authenticated update: only own vote or full reset; schema re-validated

---

## CSS `[hidden]` Override

All views use the HTML `hidden` attribute to toggle visibility. Because views
use `display: flex` in CSS, the browser's built-in `[hidden] { display: none }`
rule is overridden. The fix is applied globally:

```css
[hidden] { display: none !important; }
```

Without this line, all views render simultaneously.

---

## Manifest Reference

See `deployment.json`. URLs point to Firebase Hosting after Phase C migration.
