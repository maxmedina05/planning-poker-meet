# Architecture — Planning Poker Meet Add-on

## Core Decisions

### 1. Full Web App (not Apps Script)

> "Meet add-ons cannot be built entirely in Apps Script. You must, instead,
> build a full web app."
> — [Deploy a Meet add-on](https://developers.google.com/workspace/meet/add-ons/guides/deploy-add-on)

All code is static HTML/CSS/JS hosted on GitHub Pages. No server required.

---

### 2. Side Panel + Main Stage Split

The Meet add-on model provides two frames:

| Frame | Our Use |
|-------|---------|
| **Side panel** | Each participant's private voting UI. Always visible. Entry point via `sidePanelUrl`. |
| **Main stage** | Shared reveal screen. Opened by the host via `startActivity({ mainStageUrl })`. |

The side panel is loaded from `sidePanelUrl` in the manifest as soon as the
add-on is opened. The main stage is optional and only launched when the host
starts a voting round.

---

### 3. Real-time Sync: Co-Doing API

> "The Co-Doing API is used to synchronize arbitrary data between meeting
> participants."
> — [Implement the Co-Doing API](https://developers.google.com/workspace/meet/add-ons/guides/use-CoDoingAPI)

**No backend needed.** The Co-Doing API broadcasts game state to all
participants through Meet's infrastructure.

State is serialized as `Uint8Array`:

```javascript
// Encode
const bytes = new TextEncoder().encode(JSON.stringify(state));
coDoingClient.broadcastStateUpdate({ bytes });

// Decode
const state = JSON.parse(new TextDecoder().decode(coDoingState.bytes));
```

The `onCoDoingStateChanged` callback fires on every participant's client
whenever any participant broadcasts an update.

---

### 4. No Backend (Phases 1–3)

All state lives in the Co-Doing API during the meeting. There is no persistence
between meetings. A backend would only be needed for vote history / audit trails
— out of scope for this project.

---

### 5. Manifest Deployment: HTTP Deployment

The manifest (`deployment.json`) is submitted as JSON in:
**Google Cloud Console → APIs & Services → Google Workspace Marketplace SDK
→ HTTP deployments tab**

This is preferred over the Apps Script deployment path since we have no Apps
Script project.

---

## SDK Entry Points

### SDK Loading (CDN)

```html
<script src="https://www.gstatic.com/meetjs/addons/1.1.0/meet.addons.js"></script>
```

Exposes `window.meet.addon` globally.

### Session Initialization

```javascript
const session = await window.meet.addon.createAddonSession({
  cloudProjectNumber: 'YOUR_CLOUD_PROJECT_NUMBER',  // number, not project ID
});
```

**Important:** Use the **Project Number** from Cloud Console → IAM & Admin →
Settings. It is a 12-digit integer, not the project ID string.

Stored in `config.js` at the repo root (loaded before `app.js` in each HTML
file). This value is a **public identifier** — it is visible in browser source
and safe to commit. It is not an API secret.

---

## Secrets Policy

This is a static site. There is no server to hold secrets at runtime.

| Value | Where it lives | Commit? |
|-------|---------------|---------|
| `cloudProjectNumber` | `config.js` | ✅ Yes — public identifier |
| Firebase API key (future) | `config.js` | ✅ Yes — restricted by domain in Firebase console |
| Service account JSON (future) | Backend only, never in repo | ❌ No |
| OAuth client secret (future) | Backend only, never in repo | ❌ No |

`.gitignore` blocks `*.json` credential files, `.env` files, and `*.pem`/`*.key`.

### Client Objects

```javascript
// In sidepanel/app.js
const sidePanelClient = await session.createSidePanelClient();

// In mainstage/app.js
const mainStageClient = await session.createMainStageClient();
```

Using the wrong client for the wrong frame will throw an exception. Never call
`createMainStageClient()` from the side panel or vice versa.

### Meeting Info

```javascript
const info = await sidePanelClient.getMeetingInfo();
// info.meetingId   — globally unique identifier
// info.meetingCode — human-readable "aaa-bbbb-ccc" format
```

---

## Activity Lifecycle (Phases 3+)

1. Host calls `sidePanelClient.startActivity({ mainStageUrl, additionalData })`
2. All participants receive an invitation notification
3. Joining participants call `mainStageClient.getActivityStartingState()` to
   read `additionalData` and initialize their state
4. Co-Doing API syncs votes in real time
5. Host calls `sidePanelClient.endActivity()` to close the main stage for everyone

---

## Frame-to-Frame Messaging

Used for side panel ↔ main stage communication **within the same participant's
session only** (not cross-participant):

```javascript
// Side panel → main stage
await sidePanelClient.notifyMainStage(JSON.stringify(payload));

// Main stage → side panel
await mainStageClient.notifySidePanel(JSON.stringify(payload));

// Receive
client.on('frameToFrameMessage', (msg) => {
  const payload = JSON.parse(msg.payload ?? msg);
});
```

Delivery is best-effort (attempted once). The receiving frame must be open.

---

## Origin / CORS Strategy

- **Development:** Use a fixed GitHub Pages URL (`https://USERNAME.github.io/REPO`)
  pinned in `deployment.dev.json`
- **Production:** Same pattern, different repo or branch if needed

Never use broad wildcards like `*.github.io` in `addOnOrigins`. Use the exact
origin of your deployed site.

Two manifest files for the two environments:

```
deployment.json         # current active manifest
deployment.prod.json    # production (keep in sync manually)
```

---

## Manifest Reference

```json
{
  "addOns": {
    "common": {
      "name": "Planning Poker",
      "logoUrl": "HTTPS_URL_TO_48x48_PNG"
    },
    "meet": {
      "web": {
        "sidePanelUrl": "https://HOST/sidepanel/index.html",
        "supportsScreenSharing": false,
        "addOnOrigins": ["https://HOST"],
        "logoUrl": "HTTPS_URL_TO_48x48_PNG"
      }
    }
  }
}
```

`supportsScreenSharing` is `false` — voting is private per participant.
Revisit in Phase 4.
