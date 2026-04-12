# Google Workspace Marketplace Resubmission Checklist

Issues from rejection email for app **Planning Poker (611068490382)**.

---

## 1. Fix Manifest / Integration not showing in Marketplace SDK

- [x] Read the manifest documentation: https://developers.google.com/workspace/add-ons/concepts/workspace-manifests
- [x] Added missing top-level `oauthScopes` field to `deployment.json` (required for Meet integration to appear)
- [ ] In Google Cloud Console → Workspace Add-ons API → HTTP Deployments, resubmit the manifest
- [ ] Confirm the **Meet** host option appears when configuring the Deployment ID in the Marketplace SDK
- [ ] If still broken, file a bug at https://developers.google.com/workspace/add-ons/gsuite-support#bugs

---

## 2. Trademark attribution ✅ Done

- [x] Added ™ to "Google Meet™" in `index.html` subtitle
- [x] Added trademark footnote in footer: _"Google Meet™ is a trademark of Google LLC."_
- [ ] Check the **Marketplace listing description** (in Google Cloud Console) for any unattributed Google product names (Meet, Google Workspace, etc.) and add ™ to each

---

## 3. Icon white background ✅ Done

- [x] `logo-32x32.png` — white background applied, alpha removed
- [x] `logo-48x48.png` — white background applied, alpha removed
- [x] `logo-96x96.png` — white background applied, alpha removed
- [x] `logo-128x128.png` — white background applied, alpha removed
- [ ] Upload the updated icons to the **Store listing** in Google Cloud Console
- [ ] Make sure the same icon is consistent across: Store listing, OAuth consent screen, and the app itself

---

## 4. Screenshots

- [ ] Delete or fix `screenshot.png` (currently 2559×1299 — not a valid size)
- [ ] Take at least **5 screenshots** at **1280×800 pixels** showing the app in action
  - Suggested shots:
    1. Side panel open in Meet with voting cards visible
    2. A participant with a card selected (pre-reveal)
    3. Vote reveal screen showing all estimates
    4. Facilitator view (Reveal / New Round buttons)
    5. Waiting state ("waiting for others to vote")
- [ ] Crop out all browser chrome, address bars, OS taskbars, and window decorations
- [ ] Upload all screenshots to the Marketplace listing in Google Cloud Console

---

## 5. Resubmit

- [ ] Run `./deploy.sh` to push updated icons and HTML
- [ ] Go to Google Cloud Console → Workspace Marketplace SDK → Store listing
- [ ] Verify all changes are reflected
- [ ] Click **Publish** / **Resubmit for review**
- [ ] Email gwm-review@google.com if you have questions
