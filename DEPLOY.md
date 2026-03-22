# Deployment Guide — Planning Poker Meet Add-on

This guide covers everything from a fresh clone to a working add-on inside
Google Meet. Follow the sections in order.

---

## Prerequisites

- A Google account (personal or Workspace)
- Access to [Google Cloud Console](https://console.cloud.google.com)
- Git installed locally
- The repo cloned: `git clone https://github.com/maxmedina05/planning-poker-meet`

---

## Part 1 — Google Cloud Setup

### 1.1 Create or Select a Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it `planning-poker-meet` (or anything you'll recognize)
4. Click **Create**

### 1.2 Get Your Project Number

1. With your project selected, go to **IAM & Admin → Settings**
2. Copy the **Project number** — a 12-digit integer like `123456789012`
   > ⚠️ This is **not** the Project ID (the short string). You need the number.

### 1.3 Enable Required APIs

Go to **APIs & Services → Library** and enable these two (search by name):

1. **Google Workspace Marketplace SDK**
   > ⚠️ Do **not** enable "Google Workspace Marketplace API" — that's different.
2. **Google Workspace Add-ons API**

---

## Part 2 — Configure the Project

### 2.1 Set Your Cloud Project Number as a GitHub Secret

`config.js` is gitignored and generated automatically at deploy time.
Your project number never appears in the repo history.

1. Go to https://github.com/maxmedina05/planning-poker-meet
2. Click **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `CLOUD_PROJECT_NUMBER`
5. Value: your 12-digit project number (e.g. `123456789012`)
6. Click **Add secret**

For local development only, copy `config.example.js` to `config.js` and fill it
in manually. It is gitignored so it will never be committed.

### 2.2 Verify deployment.json

`deployment.json` is already set to the correct GitHub Pages URLs:

```json
"sidePanelUrl": "https://maxmedina05.github.io/planning-poker-meet/sidepanel/index.html"
"addOnOrigins": ["https://maxmedina05.github.io"]
```

No changes needed unless you move to a different host.

---

## Part 3 — Publish to GitHub Pages

### 3.1 Add a Logo

The manifest requires a publicly accessible logo image.

1. Add a PNG file at `assets/logo.png` (minimum 48×48px)
2. Commit and push it

### 3.2 Enable GitHub Pages via GitHub Actions

1. Go to https://github.com/maxmedina05/planning-poker-meet
2. Click **Settings → Pages**
3. Under **Source**, select **GitHub Actions** (not "Deploy from a branch")
4. Click **Save**

### 3.3 Push to Deploy

Every push to `main` now triggers the deploy workflow automatically:

```bash
git add .
git commit -m "Initial scaffold"
git push origin main
```

Watch the deploy at:
**https://github.com/maxmedina05/planning-poker-meet/actions**

Once the workflow is green, visit:
`https://maxmedina05.github.io/planning-poker-meet/sidepanel/index.html`

You should see "Open this page inside Google Meet to use Planning Poker."

---

## Part 4 — Register the Add-on

### 4.1 Open the Marketplace SDK

In Google Cloud Console:
**APIs & Services → Google Workspace Marketplace SDK**

### 4.2 Create a Deployment

1. Click the **HTTP deployments** tab
2. Click **Create new deployment**
3. Enter a deployment ID, e.g. `planning-poker-dev`
4. Click **Next**
5. Paste the full contents of `deployment.json` into the manifest field
6. Click **Submit** (or **Create**)

### 4.3 Install the Add-on for Your Account

On the HTTP deployments tab, find your deployment and click **Install** under
the Actions column.

> This installs it only for your Google account. No Marketplace listing or
> approval process required.

---

## Part 5 — Test It in Meet

1. Go to [meet.google.com](https://meet.google.com) and start a new meeting
2. Click the **Activities** panel — the puzzle-piece icon in the bottom-right
3. You should see **Planning Poker** listed under your add-ons
4. Click it — the side panel should open
5. Open your browser's developer console (F12) and confirm you see:

   ```
   [PlanningPoker] Meeting ID: <some-id>
   [PlanningPoker] Meeting code: aaa-bbbb-ccc
   ```

**Phase 1 is working.** The side panel connects to the SDK and retrieves meeting
info. Voting UI arrives in Phase 2.

---

## Updating the Add-on

Since the add-on loads its pages from GitHub Pages at runtime, **most updates
don't require re-registering the manifest**.

| Change | What to do |
|--------|-----------|
| HTML / CSS / JS changes | `git push` — live within ~1 min |
| New URL (sidePanelUrl, mainStageUrl) | Update `deployment.json`, re-submit manifest in Cloud Console |
| New origin | Add to `addOnOrigins` in `deployment.json`, re-submit |
| Config change (project number) | Update `config.js`, `git push` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Add-on not visible in Activities panel | Not installed | Complete Part 4.3 |
| "Connecting to meeting…" never changes | Wrong project number or APIs not enabled | Check `config.js` and Part 1.3 |
| Console error: `CONFIG is not defined` | `config.js` not loading | Confirm `../config.js` script tag is in the HTML |
| Logo shows as broken image | Image not pushed or wrong path | Verify the logo URL loads directly in a browser |
| Cross-origin error in console | Deployed URL doesn't match `addOnOrigins` | Check `deployment.json` origin matches your GitHub Pages URL exactly |
| Page loads but SDK does nothing | Opened outside Meet | The SDK only activates inside an actual Meet session |
| `CONFIG is not defined` on deployed site | GitHub secret not set or Actions deploy failed | Check Actions tab for errors; verify `CLOUD_PROJECT_NUMBER` secret exists |

---

## Phase Checklist

As each phase is completed, the corresponding functionality becomes available
after a `git push`.

- [x] **Phase 1** — Side panel opens, SDK initialises, meeting ID logs to console
- [ ] **Phase 2** — Card grid, card selection, confirm vote button
- [ ] **Phase 3** — Real-time vote sync, reveal mechanic, results view
- [ ] **Phase 4** — Host controls, story title, new round, reset
