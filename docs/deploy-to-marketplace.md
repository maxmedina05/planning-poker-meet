# Deploy to Google Workspace Marketplace
## Planning Poker — Deployment Guide

**Last updated:** March 2026

---

## Overall Status: READY — 3 manual steps remain

All code, assets, and configuration files are complete. The only remaining work
is configuration inside Google Cloud Console and Firebase Console — no code changes needed.

| What's done | What's left |
|-------------|-------------|
| ✅ `deployment.example.json` — correct Meet add-on schema | ⚠️ OAuth consent screen → set to "In production" |
| ✅ `privacy.html` — live-ready with email placeholder | ⚠️ Firebase Console setup (Auth, App Check, TTL) |
| ✅ `tos.html` — live-ready with email placeholder | ⚠️ Store Listing creation + asset upload |
| ✅ `index.html` — homepage |  |
| ✅ `assets/logo-128x128.png` — 128×128 icon |  |
| ✅ `assets/banner-220x140.png` — 220×140 banner |  |
| ✅ `assets/screenshot-1280x800.png` — 1280×800 screenshot |  |
| ✅ `deploy.sh` — injects `CONTACT_EMAIL`, restores placeholders after deploy |  |
| ✅ No credentials or personal info in any public file |  |

---

## Section 1 — Manifest (`deployment.example.json`)

The manifest schema is correct for the current Meet Add-on REST API. When you run
`./deploy.sh`, it generates `deployment.json` (gitignored) from this template with your
real project ID substituted in.

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
        "addOnOrigins": [
          "https://YOUR_PROJECT_ID.web.app"
        ],
        "logoUrl": "https://YOUR_PROJECT_ID.web.app/assets/logo.png"
      }
    }
  }
}
```

| Field | Required | Present | Value |
|-------|----------|---------|-------|
| `addOns.common.name` | Yes | ✅ | "Planning Poker" |
| `addOns.common.logoUrl` | Yes | ✅ | Absolute HTTPS URL |
| `addOns.meet.web.sidePanelUrl` | Yes | ✅ | Absolute HTTPS URL |
| `addOns.meet.web.addOnOrigins` | Yes | ✅ | Matches hosting domain exactly |
| `addOns.meet.web.supportsScreenSharing` | No | ✅ | `false` (correct for side-panel only) |

**No `oauthScopes` needed** — this app uses Firebase Anonymous Auth, not Google OAuth.
The OAuth consent screen must still be configured as a project-level identity record (see Section 2).

**Optional fields you may want later:**
- `addOns.meet.web.darkModeLogoUrl` — dark theme logo variant
- `addOns.meet.web.supportsCollaboration` — for multi-user main stage
- `addOns.meet.web.supportsPopOut` — browser picture-in-picture support

**Note on re-submission:** `deployment.json` is gitignored and generated locally. The manifest
must be re-submitted manually in the Cloud Console only when `sidePanelUrl` or the hosting
domain changes. All JS/CSS/HTML updates deploy instantly via `./deploy.sh` with no
Marketplace interaction required.

---

## Section 2 — Step 1: OAuth Consent Screen

**Required for both private and public listings.**

Even though this app uses no Google OAuth scopes, every Marketplace app needs a configured
OAuth consent screen as its project-level identity record. It provides the app name, logo,
and privacy policy URL to Google's Trust & Safety review. Leaving it as "Testing" is the
single most common reason for Marketplace rejection.

### Steps

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Select your project
3. If not yet configured, choose **External** → click **Create**
4. Fill in:
   - **App name:** `Planning Poker` (must match the Marketplace listing name exactly)
   - **User support email:** your email
   - **App logo:** `assets/logo-128x128.png` (128×128 — use this exact file)
   - **Application home page:** `https://YOUR_PROJECT_ID.web.app`
   - **Privacy policy link:** `https://YOUR_PROJECT_ID.web.app/privacy.html`
   - **Terms of service link:** `https://YOUR_PROJECT_ID.web.app/tos.html`
   - **Developer contact email:** your email
5. **Scopes** step → click **Save and Continue** without adding anything
6. **Test users** step → add your test accounts → **Save and Continue**
7. Back on the summary page → click **Publish App** → confirm

The status must show **In production** before submission.

---

## Section 3 — Step 2: Firebase Console Setup

These settings cannot be configured from code — they must be set in the Firebase Console.

### 3a. Enable Anonymous Authentication

1. Firebase Console → **Build → Authentication → Sign-in method**
2. Click **Anonymous** → toggle **Enable** → **Save**

### 3b. Enable and Enforce App Check

App Check blocks unauthorized clients from accessing Firestore.

1. Firebase Console → **Build → App Check**
2. Click your web app → select **reCAPTCHA v3** as provider
3. Enter your reCAPTCHA **Site Key** (from `.env`)
4. Click **Save**
5. Click **Enforce** — without this, App Check logs but does not block

### 3c. Set TTL Policy on `expiresAt`

Auto-deletes room documents after 24 hours so old data never accumulates.

1. Firebase Console → **Build → Firestore Database → Indexes tab**
2. Click **TTL policies → Add TTL policy**
3. Collection: `rooms` · Field: `expiresAt`
4. Click **Save**

---

## Section 4 — Step 3: Store Listing

### 4a. Run `./deploy.sh` first

The privacy policy and ToS pages must be live before you can submit URLs in the Store Listing form.

```bash
./deploy.sh

# Verify pages are live before continuing
curl -I https://YOUR_PROJECT_ID.web.app/privacy.html   # expect HTTP 200
curl -I https://YOUR_PROJECT_ID.web.app/tos.html       # expect HTTP 200
```

### 4b. Create the listing

1. Go to: https://console.cloud.google.com/apis/googleworkspace/marketplace
2. Navigate to: **Google Workspace Marketplace SDK → Store Listing tab**

### 4c. Required fields

| Field | Requirement | Value to use |
|-------|-------------|--------------|
| App name | Max 50 chars, no "Google" trademark | `Planning Poker` |
| Short description | Max 200 chars | See template below |
| Detailed description | Under 16,000 chars | See template below |
| Category | Select one | `Productivity` |
| Support URL | Must be functional | Your GitHub repo URL |
| Privacy policy URL | Must be live | `https://YOUR_PROJECT_ID.web.app/privacy.html` |
| Terms of service URL | Must be live | `https://YOUR_PROJECT_ID.web.app/tos.html` |
| Pricing | Select one | `Free` |

### 4d. Description templates

**Short description (≤ 200 chars):**
```
Estimate story points in real time during Google Meet calls. Vote with Fibonacci
cards, reveal together, and track averages — without leaving the call.
```

**Detailed description:**
```
Planning Poker is a lightweight agile estimation tool built directly into
Google Meet. Run story point estimation sessions without context-switching
to a separate tab or tool.

HOW IT WORKS
1. Open the add-on from the Activities panel (puzzle-piece icon) during any
   Google Meet call.
2. The first person to open the panel becomes the Facilitator.
3. All participants pick from 10 standard Fibonacci cards:
   0, 1, 2, 3, 5, 8, 13, 21, ?, ☕
4. Votes are hidden until the Facilitator clicks "Reveal Votes".
5. Results appear with the average and vote range.
6. Start a new round and repeat.

FEATURES
- 10-card Fibonacci deck including ? (unsure) and ☕ (needs a break)
- Live vote count updates as participants submit
- Results sorted with average, min, and max range
- Optional story title set by the Facilitator
- Any participant can claim the Facilitator role if the host leaves
- Start New Round resets votes while preserving the story title
- No sign-in required — participants join anonymously
- Data auto-deleted after 24 hours of inactivity

PRIVACY
No names, emails, or Google account information are collected. Each session
uses an anonymous ID that is automatically deleted after the meeting.
Full privacy policy at: https://YOUR_PROJECT_ID.web.app/privacy.html
```

### 4e. Upload graphic assets

All assets are in `assets/` — use the resized versions:

| Asset | File | Dimensions |
|-------|------|------------|
| App icon | `assets/logo-128x128.png` | 128×128 |
| App card banner | `assets/banner-220x140.png` | 220×140 |
| Screenshot | `assets/screenshot-1280x800.png` | 1280×800 |

### 4f. Register the HTTP deployment

1. In the Marketplace SDK console → **HTTP Deployments tab**
2. Click **Create new deployment**
3. Paste the contents of your local `deployment.json` (the generated file with real URLs)
4. Click **Save**

---

## Section 5 — Publication Options

### Option A — Private listing (immediate, no review)

Best for personal + work use. Available only to your Google Workspace organization.

1. Complete Sections 2, 3, and 4
2. In Marketplace SDK → **App Visibility** → select **Private**
3. Under **Installation settings**, choose individual or admin install
4. Click **Publish** — live immediately, no review queue

**Note:** Public/private cannot be changed after publication.

### Option B — Public listing (worldwide, requires review)

1. Complete Sections 2, 3, and 4
2. Confirm OAuth consent screen status is **In production**
3. In Marketplace SDK → **App Visibility** → select **Public**
4. Click **Publish** → enters the review queue
5. Review typically takes 3–7 business days

---

## Section 6 — Submitting the Deployment via CLI (optional)

If you prefer the command line over the Cloud Console UI:

```bash
# Authenticate and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Create or replace the HTTP deployment (uses your generated deployment.json)
gcloud workspace-add-ons deployments replace-deployment \
  --deployment-id=planning-poker-production \
  --body=deployment.json

# Install for your own account (for testing)
gcloud workspace-add-ons deployments install planning-poker-production

# Check status
gcloud workspace-add-ons deployments get planning-poker-production
```

If `gcloud workspace-add-ons` is not found:
```bash
gcloud components install alpha
```

---

## Section 7 — Meet-Specific Review Criteria

| Requirement | Status |
|-------------|--------|
| Works with third-party cookies disabled | ✅ Firebase Anonymous Auth — no third-party cookies |
| Responsive side panel layout | ✅ CSS flex layout, no fixed widths |
| No horizontal scrolling in iframe | ✅ No horizontal overflow |
| Loading state shown while connecting | ✅ "Connecting to meeting…" shown on init |
| No Google trademark use in name/logo | ✅ "Planning Poker", no Google branding |
| No duplicate of built-in Google functionality | ✅ Planning poker is not a Google product |
| App fully implemented (not beta) | ✅ All listed features work |

**One Tap sign-in:** If a reviewer flags this, the correct response is: *"The add-on uses
Firebase Anonymous Authentication and does not collect or process any Google account
identity. One Tap sign-in is not applicable."*

---

## Section 8 — Post-Publication Update Policy

| Change type | Requires re-review | How to deploy |
|-------------|-------------------|---------------|
| Bug fixes, JS/CSS/HTML changes | No | `./deploy.sh` — live immediately |
| New features at same URLs | No | `./deploy.sh` — live immediately |
| Change `sidePanelUrl` or hosting domain | Yes | Update `deployment.json`, resubmit in Cloud Console |
| Change app name or short description | Yes | Update Store Listing, resubmit |
| Update logo or screenshots | Yes | Update Store Listing assets, resubmit |
| Add Google OAuth scopes | Yes | Full re-review |
| Update privacy policy content | No | `./deploy.sh` — live immediately |

---

## Section 9 — Console Quick Reference

| Purpose | URL |
|---------|-----|
| Google Cloud Console | https://console.cloud.google.com/home/dashboard?project=YOUR_PROJECT_ID |
| OAuth consent screen | https://console.cloud.google.com/apis/credentials/consent?project=YOUR_PROJECT_ID |
| Marketplace SDK — App Configuration | https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com/googleapps?project=YOUR_PROJECT_ID |
| Marketplace SDK — Store Listing | https://console.cloud.google.com/apis/googleworkspace/marketplace?project=YOUR_PROJECT_ID |
| Marketplace SDK — HTTP Deployments | https://console.cloud.google.com/apis/googleworkspace/marketplace/deployments?project=YOUR_PROJECT_ID |
| Firebase Console | https://console.firebase.google.com/project/YOUR_PROJECT_ID |
| Firebase App Check | https://console.firebase.google.com/project/YOUR_PROJECT_ID/appcheck |
| Firebase Authentication | https://console.firebase.google.com/project/YOUR_PROJECT_ID/authentication |
| Firestore Database | https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore |
| reCAPTCHA Admin | https://www.google.com/recaptcha/admin |

---

## Section 10 — Official Documentation

| Topic | URL |
|-------|-----|
| Workspace Add-ons overview | https://developers.google.com/workspace/add-ons/overview |
| Add-ons alternate runtimes (HTTP) | https://developers.google.com/workspace/add-ons/guides/alternate-runtimes |
| Deployment REST API schema | https://developers.google.com/workspace/add-ons/reference/rest/v1/projects.deployments |
| How to publish (Marketplace) | https://developers.google.com/workspace/marketplace/how-to-publish |
| Marketplace requirements | https://developers.google.com/workspace/marketplace/requirements |
| Create a listing | https://developers.google.com/workspace/marketplace/create-listing |
| Marketplace overview | https://developers.google.com/workspace/marketplace |
