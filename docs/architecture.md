# Architecture — Planning Poker Meet Add-on

## Core Decisions

### 1. Full Web App (not Apps Script)

> "Meet add-ons cannot be built entirely in Apps Script. You must, instead,
> build a full web app."
> — [Deploy a Meet add-on](https://developers.google.com/workspace/meet/add-ons/guides/deploy-add-on)

All code is static HTML/CSS/JS hosted on GitHub Pages. No server required.

---

### 2. Side Panel Only

The Meet add-on model provides two frames — side panel and main stage. We use
only the side panel. All voting, reveal, and results happen there.

The main stage files (`mainstage/`) are scaffolded but unused. They exist in case
a future version wants a shared full-screen results view.

---

### 3. Real-time Sync: Firebase Realtime Database

Firebase Realtime Database is used to sync game state across all participants
in real time. The `meetingId` from the Meet SDK is used as the room key so
each meeting gets its own isolated state.

**Why not the Co-Doing API?**
The Co-Doing API (`session.createCoDoingClient`) requires EAP (Early Access
Program) enrollment and is not available to new add-ons:
```
Meet Add-on SDK error: Could not connect to co channel.
The addon does not have permission to open a co.
This method might require EAP enrollment.
```

Firebase was chosen as the replacement:
- Free tier (Spark plan) is sufficient for any team size
- Client SDK loads from CDN — no build step
- State persists so late joiners receive the current round state immediately
- `meetingId` as the room key provides natural isolation between meetings

**Firebase state shape:**
```json
{
  "hostId": "abc123",
  "storyTitle": "User SSO login",
  "revealed": false,
  "votes": {
    "abc123": "5",
    "def456": "8"
  }
}
```

**Writes:**
- Each participant writes only their own vote: `rooms/{meetingId}/votes/{myId}`
- Facilitator writes `revealed`, `storyTitle`, `hostId`, and resets `votes`
- `roomRef.on('value')` fires for all participants (including the writer) on every change

---

### 4. Participant Identity

The Meet SDK does not expose participant IDs or names. Each participant
generates a random ID on first load and stores it in `localStorage`:

```javascript
let myId = localStorage.getItem('poker_id');
if (!myId) {
  myId = Math.random().toString(36).slice(2, 11);
  localStorage.setItem('poker_id', myId);
}
```

`localStorage` persists across panel close/reopen (same browser, same origin).
This ensures a participant's vote is not orphaned if they close and reopen the panel.

Edge case: clearing browser storage or using a different browser generates a
new ID. The previous vote remains in Firebase under the old ID. The participant
can still vote again — their new vote appears as an additional entry.

---

### 5. Host / Facilitator Detection

There is no "meeting host" concept in the Meet add-ons SDK. Facilitator role
is tracked in Firebase:

- First participant to open the add-on claims `hostId` via a Firebase transaction
  (atomic: only sets if currently null)
- If `myId === hostId`, the participant sees facilitator controls
- Any participant can overwrite `hostId` via the "Claim Facilitator" button
  (handles the case where the facilitator leaves mid-session)

---

### 6. Manifest Deployment: HTTP Deployment

The manifest (`deployment.json`) is submitted as JSON in:
**Google Cloud Console → APIs & Services → Google Workspace Marketplace SDK
→ HTTP deployments tab**

The manifest only needs re-submission when URLs or origins change. All
code changes are picked up automatically from GitHub Pages at runtime.

---

## SDK Entry Points

### SDK Loading (CDN)

```html
<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"></script>
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
// meetingInfo.meetingId   — used as Firebase room key
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
const db      = firebase.database();
const roomRef = db.ref('rooms/' + meetingId);
```

---

## Secrets and Config

`config.js` is gitignored and generated by GitHub Actions at deploy time.
It is never committed to the repository.

| Value | Where it lives | Commit? | Notes |
|-------|---------------|---------|-------|
| `cloudProjectNumber` | GitHub Actions secret → `config.js` | No | Public identifier, but kept out of git history for hygiene |
| Firebase config (apiKey, etc.) | GitHub Actions secret → `config.js` | No | Designed to be public; security enforced by Firebase Rules |
| Service account / backend keys | Never in this repo | No | Would require a backend, which this project doesn't have |

For local development: copy `config.example.js` → `config.js` and fill in values.

---

## Firebase Security Rules

```json
{
  "rules": {
    "rooms": {
      "$meetingId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Open read/write scoped to the `rooms` collection. Tighter per-participant
rules were attempted but blocked the facilitator's `newRound()` operation
(which resets the `votes` node directly). Full auth-based rules would require
Firebase Authentication — out of scope for this project.

The `meetingId` format (`spaces/xxxx`) is not easily guessable, providing
implicit isolation between meetings.

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

```json
{
  "addOns": {
    "common": {
      "name": "Planning Poker",
      "logoUrl": "https://maxmedina05.github.io/planning-poker-meet/assets/logo.png"
    },
    "meet": {
      "web": {
        "sidePanelUrl": "https://maxmedina05.github.io/planning-poker-meet/sidepanel/index.html",
        "supportsScreenSharing": false,
        "addOnOrigins": ["https://maxmedina05.github.io"],
        "logoUrl": "https://maxmedina05.github.io/planning-poker-meet/assets/logo.png"
      }
    }
  }
}
```

`supportsScreenSharing: false` — voting is private per participant.
