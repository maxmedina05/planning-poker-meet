# Deploy to Google Workspace Marketplace
## Planning Poker — Staff Engineer Assessment

**Assessment date:** March 2026
**Evaluator:** Staff-level readiness audit against live Google Workspace Marketplace documentation

---

## Overall Verdict

**NOT YET READY FOR PUBLIC LISTING — 7 specific gaps must be closed first.**

The add-on itself is technically sound and architecturally correct. The blocking gaps are
entirely in the Marketplace metadata, asset pipeline, and OAuth consent screen — none
require code changes. With 2–4 hours of work and a 3–7 business day review wait, this
app can be published to the public Marketplace.

For an **immediate private (organization-only) listing**, only 3 gaps are blocking.
For a **public listing**, all 7 gaps must be resolved.

---

## Gap Summary

| # | Gap | Blocks | Estimated effort |
|---|-----|--------|-----------------|
| G1 | OAuth consent screen is not configured or not set to "In production" | Public + Private | 10 min |
| G2 | Terms of service URL is absent | Public + Private | 30 min (write a ToS page) |
| G3 | `privacy.html` is gitignored — it is not committed and may not be deployed | Public + Private | 5 min (fix .gitignore) |
| G4 | Store listing is not created (no app name, descriptions, or category filed) | Public + Private | 30 min |
| G5 | No 128×128 icon prepared for Marketplace (logo.png is 1024×1024 — must be resized/exported) | Public | 10 min |
| G6 | No 220×140 banner image exists | Public | 20 min |
| G7 | No screenshots exist (min 1 required, 1280×800) | Public | 20 min |

**No code changes are required.** The `deployment.json` manifest schema is correct and
complete per the current REST API reference. The `privacy.html` content meets the
substantive requirements — it just needs to be deployed.

---

## Section 1 — Manifest Assessment (`deployment.json`)

### Verdict: PASSES with one note

The current `deployment.json` is:

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

Against the current `projects.deployments` REST API reference, this satisfies all required
fields:

| Field | Required | Present | Value |
|-------|----------|---------|-------|
| `addOns.common.name` | Yes | Yes | "Planning Poker" |
| `addOns.common.logoUrl` | Yes | Yes | Absolute HTTPS URL |
| `addOns.meet.web.sidePanelUrl` | Yes | Yes | Absolute HTTPS URL |
| `addOns.meet.web.addOnOrigins` | Yes | Yes | Matches hosting domain |
| `addOns.meet.web.supportsScreenSharing` | No | Yes | false (correct for side-panel-only) |

**Note on `oauthScopes`:** The REST API schema includes a top-level `oauthScopes` array on
the deployment resource. This app uses Firebase Anonymous Auth, not Google OAuth, so no
Google OAuth scopes are needed. The array is correctly omitted. However, the OAuth consent
screen must still be configured (see G1 below).

**Optional fields not used** (from the REST API schema) that you may want to consider later:

- `addOns.meet.web.supportsCollaboration` — for multi-user main stage (not applicable now)
- `addOns.meet.web.supportsPopOut` — browser picture-in-picture support
- `addOns.meet.web.darkModeLogoUrl` — dark theme logo variant
- `addOns.meet.web.openState` — initial panel state (`SIDE_PANEL_ONLY` is the default and correct)

**One important note:** `deployment.json` is currently in `.gitignore`. It is generated
locally from `deployment.example.json`. This is a sound security practice (the file
contains your live project ID) but means the manifest must be re-submitted manually after
each URL change. There is no automated manifest deployment path in the current `deploy.sh`.

### Deployment type: Correct

Meet add-ons **cannot be built in Apps Script** — they require a full web app. The
architecture doc confirms this was a deliberate, well-researched decision. HTTP
deployment via Firebase Hosting is the correct approach and is fully supported by
the current Meet Add-ons platform. The Meet SDK is loaded from the correct CDN at
version 1.1.0 (`https://www.gstatic.com/meetjs/addons/1.1.0/meet.addons.js`).

---

## Section 2 — OAuth Consent Screen (G1 — BLOCKING)

**Gap: The OAuth consent screen must be configured and set to "In production" before
the app can pass review. If it remains "Testing" or unconfigured, the app will be
rejected.**

This is the single most common reason for Marketplace review rejection, per the
official requirements documentation.

### Why it matters even without Google OAuth

Even though this app uses Firebase Anonymous Auth and requests zero Google OAuth scopes,
the Google Workspace Marketplace requires every app to have a configured OAuth consent
screen as a project-level identity record. The consent screen provides the app name, logo,
support email, and privacy policy URL that appear in the Google Trust & Safety review.

### Steps

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Select project `YOUR_PROJECT_ID`
3. If not configured, choose **External** user type and click **Create**
4. Fill in:
   - **App name:** `Planning Poker` (must match your Marketplace listing name exactly)
   - **User support email:** your email
   - **App logo:** upload a 120×120 PNG (cropped from your existing 1024×1024 logo)
   - **Application home page:** your Firebase Hosting URL
   - **Privacy policy link:** `https://YOUR_PROJECT_ID.web.app/privacy.html`
   - **Terms of service link:** your ToS URL (see G2 below)
   - **Developer contact email:** your email
5. On the **Scopes** step: click **Save and Continue** without adding any scopes
6. On the **Test users** step: add any accounts you use for testing, then **Save and Continue**
7. Back on the summary page, click **Publish App** to move to **In production**

**Critical:** The publishing status must be **In production** before Marketplace submission.
Leaving it as **Testing** is a guaranteed rejection.

---

## Section 3 — Privacy Policy (G3 — BLOCKING)

**Gap: `privacy.html` is listed in `.gitignore` and will not be deployed unless it exists
locally. The file itself has good content, but the deployment pipeline does not guarantee
it is present.**

### Content assessment: PASSES

The `privacy.html` content covers all required elements for a Marketplace listing:

- What is collected (anonymous UID, votes, story title)
- What is NOT collected (name, email, Google account identity)
- Data storage and auto-deletion timeline (24 hours via Firestore TTL)
- No third-party data sharing
- Third-party services disclosed (Firebase, reCAPTCHA)
- Contact email for privacy questions

### Fix required

Remove `privacy.html` from `.gitignore`:

```
# In .gitignore, delete or comment out this line:
privacy.html
```

Then commit and deploy:

```bash
git add privacy.html
git commit -m "deploy: add privacy policy page"
./deploy.sh
```

After deployment, verify the page is live:
```
https://YOUR_PROJECT_ID.web.app/privacy.html
```

---

## Section 4 — Terms of Service (G2 — BLOCKING)

**Gap: The Store Listing requires a Terms of Service URL. No ToS page exists in the repo.**

A ToS for a no-cost personal-use add-on can be minimal. It must be a live URL. Create
`tos.html` at the Firebase Hosting root (same pattern as `privacy.html`) and include:

- The service is provided as-is with no warranties
- You may discontinue the service at any time
- Users are responsible for their use of the add-on
- Governing law (your jurisdiction)
- Contact email

After creating, deploy it and add the URL `https://YOUR_PROJECT_ID.web.app/tos.html`
to both the OAuth consent screen and the Marketplace Store Listing.

---

## Section 5 — Store Listing (G4 — BLOCKING)

**Gap: No Store Listing has been created. This is a required step before submission.**

### Console location

https://console.cloud.google.com/apis/googleworkspace/marketplace/appid

Navigate to: **Google Workspace Marketplace SDK > Store Listing tab**

### Required fields and constraints

| Field | Requirement | Recommended value |
|-------|-------------|-------------------|
| App name | Max 50 chars; no "Google" trademark; no version numbers | `Planning Poker` |
| Short description | Max 200 chars | `Estimate story points in real time during Google Meet calls. Vote with Fibonacci cards, reveal together, and track averages — without leaving the call.` |
| Detailed description | Under 16,000 chars; cannot be identical to short description | See template below |
| Category | Select one | `Productivity` |
| Support URL | Must be functional | Your GitHub repo URL or a support page |
| Privacy policy URL | Required, must be live | `https://YOUR_PROJECT_ID.web.app/privacy.html` |
| Terms of service URL | Required, must be live | `https://YOUR_PROJECT_ID.web.app/tos.html` |
| Pricing | Select one | `Free` |

### Detailed description template (customize before use)

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
- Results sorted with average and min/max range
- Optional story title set by the Facilitator
- Any participant can claim the Facilitator role if the host leaves
- Start New Round resets votes while preserving the story title
- No sign-in required — participants join anonymously
- Data auto-deleted after 24 hours of inactivity

PRIVACY
No names, emails, or Google account information are collected.
Each session uses an anonymous ID that is automatically deleted after the
meeting. Full privacy policy at:
https://YOUR_PROJECT_ID.web.app/privacy.html
```

---

## Section 6 — Required Graphic Assets (G5, G6, G7 — BLOCKING FOR PUBLIC LISTING)

**Gap: The current repo has only `assets/logo.png` (1024×1024 PNG). Multiple additional
assets are required for the Marketplace listing, and existing assets must be exported at
specific dimensions.**

### Full asset checklist

| Asset | Required dimensions | Current status | Action needed |
|-------|--------------------|--------------|--------------:|
| App icon (primary) | 128×128 PNG | Missing (only 1024×1024 exists) | Export/resize from logo.png |
| App icon (small) | 32×32 PNG | Missing | Export/resize from logo.png |
| App icon (web, large) | 96×96 PNG | Missing | Export/resize from logo.png |
| App icon (web, small) | 48×48 PNG | Missing | Export/resize from logo.png |
| App Card Banner | 220×140 PNG | Missing | Create new graphic |
| Screenshots | 1280×800 PNG (min 1, max 5) | Missing | Take screenshots in Meet |
| Screenshots (alt sizes) | 640×400 or 2560×1600 | Optional | — |
| OAuth consent screen logo | 120×120 PNG | Missing | Export/resize from logo.png |

**Icon requirements from official docs:**
- Square corners
- Transparent background acceptable
- Color image (not grayscale)
- Must accurately represent functionality
- Cannot include Google trademarks (no "G", Meet, or Google logos)
- Must be legible at small sizes

**Screenshot requirements from official docs:**
- "Square corners and no padding (full bleed)"
- Must show the actual add-on UI working inside Google Meet
- High quality only — low-quality screenshots are a rejection reason
- Recommended: show the voting view and the results view

### Resizing commands using ImageMagick

```bash
# Install ImageMagick if needed: sudo apt-get install imagemagick

SOURCE="assets/logo.png"

# Icons for Marketplace
convert "$SOURCE" -resize 128x128 assets/icon-128.png
convert "$SOURCE" -resize 96x96  assets/icon-96.png
convert "$SOURCE" -resize 48x48  assets/icon-48.png
convert "$SOURCE" -resize 32x32  assets/icon-32.png

# OAuth consent screen logo
convert "$SOURCE" -resize 120x120 assets/icon-120.png
```

The banner (220×140) must be created as a new graphic — it is a landscape layout that
shows the app name and a brief tagline, not just a scaled logo. Create it in any design
tool and export as PNG.

---

## Section 7 — Meet Add-on Specific Requirements from Official Docs

The official Marketplace review documentation includes the following **Meet-specific
review criteria** that this app must satisfy:

| Requirement | Status | Notes |
|-------------|--------|-------|
| Must function with third-party cookies disabled | PASS | Uses Firebase Anonymous Auth with `signInAnonymously()` — no third-party cookies required |
| Responsive design required for variable side panel sizes | PASS | Side panel uses CSS flexible layout |
| No horizontal scrolling within iframes | PASS | No horizontal overflow in current CSS |
| One Tap sign-in integration required | UNKNOWN | See note below |
| Main stage: multiplayer experiences required | N/A | Side panel only, no main stage used |

**One Tap sign-in note:** The requirement for "One Tap sign-in integration" in the
official review criteria is ambiguous for anonymous-auth apps. This likely refers to
Google One Tap for apps that use Google accounts. Since this app uses Firebase Anonymous
Auth (no Google account identity), this requirement likely does not apply. However, if
a reviewer flags it, the response is: "The add-on uses Firebase Anonymous Authentication
and does not collect or process any Google account identity. One Tap sign-in is not
applicable."

**Third-party cookies:** This is the most technically significant Meet-specific
requirement. Verify it explicitly: with Chrome's third-party cookie blocking enabled
(chrome://settings/cookies → "Block third-party cookies"), open the add-on in a real
Meet session and confirm all functionality works normally.

---

## Section 8 — Publication Flow

### Option A — Private listing (domain/organization only)

A private listing is available immediately without Google review. Use this for internal
team use or while iterating before public launch.

**Private listing characteristics:**
- Only visible to your Google Workspace organization members
- Publishes immediately (no review queue)
- Accessible at `https://workspace.google.com/marketplace/` only to your org
- Domain admins can deploy it org-wide from the Admin Console
- **WARNING:** The public/private choice cannot be changed after publication

**Steps for private listing:**

1. Complete G1 (OAuth consent screen) — required even for private listings
2. Complete G3 (deploy `privacy.html`) — required even for private listings
3. Complete G4 (create Store Listing) — required even for private listings
4. In the Marketplace SDK console, under **App Visibility**, select **Private**
5. Under **Installation settings**, choose who can install:
   - Individual users install themselves, OR
   - Administrator installs for the whole domain
6. Click **Publish** — the listing is immediately available to your org

### Option B — Public listing (all Google users worldwide)

Public listing requires completing all 7 gaps and passing Google review.

**Steps for public listing:**

1. Complete all gaps G1 through G7 (see Section 9 for the ordered checklist)
2. In the Marketplace SDK console, under **App Visibility**, select **Public**
3. Under **Installation settings**, select **Individual + Admin install**
4. Confirm the **OAuth consent screen** is set to **In production**
5. Fill in all Store Listing fields and upload all graphic assets
6. Click **Publish** — this enters the review queue

**Review timeline:** Several business days (Google's documentation says "typically
several days" — in practice 3–7 business days for a new submission).

**After review:**
- Approval: App appears in public Marketplace search results
- Rejection: You receive an email with specific reasons; fix and resubmit

### Option C — Unlisted (URL install only)

Not explicitly a Marketplace listing type, but you can keep the HTTP deployment installed
via the Cloud Console's "HTTP Deployments" tab without any Marketplace listing. Users must
be sent the direct install link. This is how the current dev deployment works.

---

## Section 9 — Complete Pre-Submission Checklist (Ordered)

Complete in this exact order:

### Phase 1 — Deploy prerequisites (30 minutes)

- [ ] **Remove `privacy.html` from `.gitignore`**
  ```bash
  # Edit .gitignore: delete the line that reads: privacy.html
  git add .gitignore privacy.html
  git commit -m "fix: track privacy.html in git"
  ```

- [ ] **Create `tos.html`** (Terms of Service page)
  Pattern it after `privacy.html`. Deploy alongside it.
  ```bash
  # After creating tos.html:
  git add tos.html
  git commit -m "feat: add terms of service page"
  ./deploy.sh
  ```

- [ ] **Verify both pages are live**
  ```bash
  curl -I https://YOUR_PROJECT_ID.web.app/privacy.html
  curl -I https://YOUR_PROJECT_ID.web.app/tos.html
  # Both should return HTTP 200
  ```

### Phase 2 — OAuth consent screen (10 minutes)

- [ ] Go to https://console.cloud.google.com/apis/credentials/consent
- [ ] Select project `YOUR_PROJECT_ID`
- [ ] Configure External app with all required fields (see Section 2)
- [ ] Set status to **In production**

### Phase 3 — Create image assets (30–60 minutes)

- [ ] Export icons from `assets/logo.png` (1024×1024 source):
  - `assets/icon-128.png` — 128×128
  - `assets/icon-96.png` — 96×96
  - `assets/icon-48.png` — 48×48
  - `assets/icon-32.png` — 32×32
  - `assets/icon-120.png` — 120×120 (for OAuth consent screen)
- [ ] Create `assets/banner-220x140.png` — 220×140 landscape banner
- [ ] Take 1–5 screenshots at 1280×800 inside a real Google Meet session
  - Screenshot 1: voting view (card grid visible, pick a card)
  - Screenshot 2: results view (votes revealed, average and range shown)

### Phase 4 — Store Listing (30 minutes)

- [ ] Go to: https://console.cloud.google.com/apis/googleworkspace/marketplace/appid
- [ ] Navigate to the **Store Listing** tab
- [ ] Fill in all required fields (see Section 5)
- [ ] Upload all icon assets and at least 1 screenshot
- [ ] Upload the 220×140 banner

### Phase 5 — Submit

For **private listing:**
- [ ] Set visibility to **Private** and click **Publish**
- Done — available to your org immediately

For **public listing:**
- [ ] Set visibility to **Public**
- [ ] Confirm OAuth consent screen status is **In production**
- [ ] Click **Publish**
- [ ] Wait 3–7 business days for review

---

## Section 10 — gcloud CLI Commands

All the steps above can be completed in the Cloud Console UI, but here are the equivalent
CLI commands for the deployment lifecycle:

```bash
# Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Create or replace the HTTP deployment
gcloud workspace-add-ons deployments replace-deployment \
  --deployment-id=planning-poker-production \
  --body=deployment.json

# Check deployment status
gcloud workspace-add-ons deployments get planning-poker-production

# Install the deployment for your account (for testing)
gcloud workspace-add-ons deployments install planning-poker-production

# List all deployments
gcloud workspace-add-ons deployments list
```

**Note:** The `gcloud workspace-add-ons` commands require the Google Cloud SDK with the
`gcloud alpha` or `gcloud beta` component. If the command group is not found:
```bash
gcloud components install alpha
# or
gcloud components install beta
```

The REST API endpoint for programmatic deployment management is:
`POST https://gsuiteaddons.googleapis.com/v1/projects/{projectNumber}/deployments`
with IAM permission `gsuiteaddons.deployments.create` and OAuth scope
`https://www.googleapis.com/auth/cloud-platform`.

---

## Section 11 — Common Rejection Reasons and How This App Compares

Based on the official Marketplace review requirements documentation:

| Rejection reason | This app's status |
|-----------------|-------------------|
| OAuth consent screen set to "Testing" | RISK — must be set to "In production" before submission (G1) |
| Non-functional URLs in listing | RISK — ToS URL does not exist yet (G2); privacy URL may not be deployed (G3) |
| Inappropriate use of Google trademarks in name/logo | PASS — name is "Planning Poker", no Google branding used |
| App name over 50 characters | PASS — "Planning Poker" is 14 characters |
| Short and detailed descriptions are identical | PASS if you use different text (template in Section 5 provides both) |
| Low-quality or missing screenshots | RISK — no screenshots exist yet (G7) |
| Obvious bugs or broken functionality | PASS — core features are complete and tested |
| App in beta/testing status | PASS — all features listed in README are fully implemented |
| Authorization required multiple times | PASS — Firebase Anonymous Auth persists across reloads |
| Third-party cookies dependency | INVESTIGATE — verify explicitly with cookie blocking enabled |
| Horizontal scrolling in iframe | PASS — no horizontal overflow in side panel |
| Missing privacy policy | RISK — `privacy.html` is gitignored (G3) |
| Missing Terms of Service | FAIL — does not exist yet (G2) |
| Missing loading indicators | PASS — loading state shows "Connecting to meeting..." |
| Broken image links | PASS if logo is deployed; verify after `./deploy.sh` |
| Duplicate functionality of Google products | PASS — planning poker is not a Google product |
| No new functionality beyond built-in Workspace features | PASS — real-time collaborative voting is a novel capability |

---

## Section 12 — Console and Admin Pages Quick Reference

| Purpose | URL |
|---------|-----|
| Google Cloud Console — project home | https://console.cloud.google.com/home/dashboard?project=YOUR_PROJECT_ID |
| OAuth consent screen | https://console.cloud.google.com/apis/credentials/consent?project=YOUR_PROJECT_ID |
| Marketplace SDK — App Configuration | https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com/googleapps?project=YOUR_PROJECT_ID |
| Marketplace SDK — Store Listing | https://console.cloud.google.com/apis/googleworkspace/marketplace?project=YOUR_PROJECT_ID |
| Marketplace SDK — HTTP Deployments | https://console.cloud.google.com/apis/googleworkspace/marketplace/deployments?project=YOUR_PROJECT_ID |
| Firebase Console — project | https://console.firebase.google.com/project/YOUR_PROJECT_ID |
| Firebase App Check | https://console.firebase.google.com/project/YOUR_PROJECT_ID/appcheck |
| Firebase Authentication | https://console.firebase.google.com/project/YOUR_PROJECT_ID/authentication |
| Firestore Database | https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore |
| reCAPTCHA Admin | https://www.google.com/recaptcha/admin |
| Google Workspace Admin (domain install) | https://admin.google.com |

---

## Section 13 — Official Documentation Links

The following URLs were tested during this assessment. Pages that returned 404 are marked.

| Topic | URL | Status |
|-------|-----|--------|
| Meet Add-ons overview | https://developers.google.com/workspace/add-ons/meet/overview | 404 — URL has changed |
| Meet Add-ons deploy guide | https://developers.google.com/workspace/add-ons/meet/deploy | 404 — URL has changed |
| Workspace Add-ons alternate runtimes (HTTP) | https://developers.google.com/workspace/add-ons/guides/alternate-runtimes | AVAILABLE |
| Deployment REST API schema | https://developers.google.com/workspace/add-ons/reference/rest/v1/projects.deployments | AVAILABLE |
| Deployment CREATE endpoint | https://developers.google.com/workspace/add-ons/reference/rest/v1/projects.deployments/create | AVAILABLE |
| How to publish (Marketplace) | https://developers.google.com/workspace/marketplace/how-to-publish | AVAILABLE |
| Marketplace requirements | https://developers.google.com/workspace/marketplace/requirements | AVAILABLE |
| Create a listing | https://developers.google.com/workspace/marketplace/create-listing | AVAILABLE |
| Submit for review | https://developers.google.com/workspace/marketplace/submit-for-review | 404 — URL has changed |
| Privacy policy guidance | https://developers.google.com/workspace/marketplace/about-listing-privacy | 404 — URL has changed |

**Recommended alternative entry points for current documentation:**
- https://developers.google.com/workspace/add-ons/overview
- https://developers.google.com/workspace/marketplace

---

## Section 14 — Post-Publication Update Policy

Once published, understanding what triggers re-review is critical:

| Change type | Requires re-review? | Action |
|-------------|--------------------|-|
| Bug fixes, JS/CSS changes with same URLs | No | `./deploy.sh` — live immediately |
| New features at same URLs | No | `./deploy.sh` — live immediately |
| Version bump (`VERSION` in `app.js`) | No | `./deploy.sh` — live immediately |
| Change `sidePanelUrl` or hosting domain | Yes | Update `deployment.json`, resubmit manifest in Cloud Console |
| Change app name or short description | Yes | Update Store Listing, resubmit |
| Update logo or screenshots | Yes | Update Store Listing assets, resubmit |
| Add Google OAuth scopes | Yes | Update OAuth consent screen + Store Listing, full re-review |
| Change privacy policy content | No | Deploy updated `privacy.html` directly |

**Key architectural advantage:** Because all logic is in static files on Firebase Hosting
and the manifest only points to a URL (not a code snapshot), all non-manifest changes are
live immediately after `./deploy.sh` with zero Marketplace interaction.
