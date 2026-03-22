# Phase 1 Deploy Checklist — Scaffold

## Before You Start

You need:
- A Google account with access to [Google Cloud Console](https://console.cloud.google.com)
- Your site deployed to GitHub Pages (or any HTTPS static host)
- The public HTTPS base URL of your deployment

---

## Step 1 — Get Your Cloud Project Number

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select or create a project for this add-on
3. Go to **IAM & Admin → Settings**
4. Copy the **Project number** — it's a 12-digit integer like `123456789012`
   - ⚠️ This is NOT the Project ID (the string like `my-project-name`)
5. Paste it into `CLOUD_PROJECT_NUMBER` in:
   - `sidepanel/app.js`
   - `mainstage/app.js`

---

## Step 2 — Enable Required APIs

In Google Cloud Console → **APIs & Services → Library**, enable both:

1. **Google Workspace Marketplace SDK**
   - Search for "Google Workspace Marketplace SDK"
   - ⚠️ Do NOT enable "Google Workspace Marketplace API" — that's a different thing
2. **Google Workspace Add-ons API**

---

## Step 3 — Deploy Files to GitHub Pages

1. Push this project to https://github.com/maxmedina05/planning-poker-meet
2. Go to the repo → **Settings → Pages**
3. Set source to **Deploy from a branch → `main` → `/ (root)`**
4. Wait for deployment — your URL will be:
   `https://maxmedina05.github.io/planning-poker-meet`

---

## Step 4 — Update deployment.json

Replace `YOUR_HOST` in `deployment.json` with your actual GitHub Pages URL:

The `deployment.json` is already updated with the correct URLs:
- `sidePanelUrl`: `https://maxmedina05.github.io/planning-poker-meet/sidepanel/index.html`
- `addOnOrigins`: `["https://maxmedina05.github.io"]`
- `logoUrl`: `https://maxmedina05.github.io/planning-poker-meet/assets/logo.png`

No changes needed — just ensure `deployment.json` is pushed to the repo.

---

## Step 5 — Add a Logo

The `logoUrl` must point to a publicly accessible image:
- Minimum 48×48px, PNG recommended
- Place it at `assets/logo.png` in your repo
- After pushing, confirm the image loads directly in the browser at the URL

---

## Step 6 — Submit the Manifest

1. Go to **Google Cloud Console → APIs & Services → Google Workspace Marketplace SDK**
2. Click the **HTTP deployments** tab
3. Click **Create new deployment**
4. Enter a deployment ID, e.g. `planning-poker-dev`
5. Click **Next**
6. Paste the full contents of your updated `deployment.json`
7. Submit

---

## Step 7 — Install for Your Account

On the HTTP deployments tab, find your deployment and click **Install** under Actions.
This installs it only for your Google account (no Marketplace listing required).

---

## Step 8 — Test the Scaffold

1. Go to [meet.google.com](https://meet.google.com) and start a new meeting
2. Click the **Activities** panel (puzzle-piece icon, bottom right)
3. You should see **Planning Poker** listed under your add-ons
4. Click it — the side panel should open
5. After a moment, the loading message should change to:
   > "Side panel ready. Voting UI coming in Phase 2."
6. Open the **browser console** — confirm you see:
   ```
   [PlanningPoker] Meeting ID: <some-id>
   [PlanningPoker] Meeting code: aaa-bbbb-ccc
   ```

---

## Expected Result

Side panel opens. SDK initializes. Meeting ID logs to console.
No voting functionality yet — that's Phase 2.

---

## Troubleshooting

| Symptom | Likely Cause |
|---------|-------------|
| "Connecting to meeting…" never changes | Wrong `CLOUD_PROJECT_NUMBER`, or APIs not enabled |
| Add-on not visible in Activities panel | Manifest not submitted, or install step skipped |
| Console error: `meet is not defined` | Page loaded outside Meet (expected in browser) |
| Logo shows broken image | `logoUrl` is not publicly accessible |
| Cross-origin error | Your deployed URL doesn't match `addOnOrigins` in manifest |
