# Pre-Deployment Checklist
## Planning Poker — Google Meet Add-on

Complete every step below **before** running `./deploy.sh` or submitting to Google Workspace Marketplace.

---

## PART 1 — Rotate Credentials (do this first)

Your `.env` and `config.js` contain real credentials. Even though they are gitignored,
rotate them now as a precaution.

### 1a. Rotate Firebase API Key
1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Select your project (`planning-poker-meet-491015`)
3. Find the **Browser key** under "API keys"
4. Click **Regenerate key**
5. Copy the new key
6. Update `FIREBASE_API_KEY` in your `.env` file

### 1b. Rotate reCAPTCHA Keys
1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Select your site
3. Under **Settings**, find the option to regenerate keys
4. Copy the new **Site Key** → update `RECAPTCHA_V3_SITE_KEY` in `.env`
5. Copy the new **Secret Key** → update `RECAPTCHA_SITE_SECRET_KEY` in `.env`

> Note: `RECAPTCHA_SITE_SECRET_KEY` is never deployed to hosting (it's not used client-side).
> It is only kept in `.env` for documentation. Do not pass it to `config.js`.

### 1c. Check git history (one-time)
If you ever ran `git add .` or `git add config.js` or `git add .env` accidentally:
```bash
git log --all --full-history -- config.js .env
```
If those files appear in history, remove them:
```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch config.js .env' \
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all
```
Then rotate all credentials (step 1a & 1b above).

---

## PART 2 — Firebase Console Setup

These settings live in the Firebase Console and cannot be configured from code.

### 2a. Enable Anonymous Authentication
1. Go to [Firebase Console](https://console.firebase.google.com) → your project
2. Left sidebar: **Build → Authentication**
3. Click **Sign-in method** tab
4. Find **Anonymous** → click it → toggle **Enable** → Save

### 2b. Enable App Check with reCAPTCHA v3
App Check prevents unauthorized apps from accessing your Firestore.

1. Firebase Console → Left sidebar: **Build → App Check**
2. Click **Get started** (or your web app if already listed)
3. Select **reCAPTCHA v3** as the provider
4. Enter your reCAPTCHA **Site Key** (from step 1b above)
5. Click **Save**
6. After saving, click **Enforce** to block unauthenticated requests

> If App Check is registered but not enforced, it logs but does not block.
> You must click **Enforce** for it to actually protect your database.

### 2c. Set TTL Policy on `expiresAt` (auto-delete old rooms)
Without this, old room documents accumulate forever and cost money.

1. Firebase Console → **Build → Firestore Database**
2. Click the **Indexes** tab (top of the page)
3. Click the **Single field** sub-tab → click **Add exemption**

   OR go directly:
   **Firestore → Indexes → TTL policies → Add TTL policy**

4. Collection: `rooms`
5. Field: `expiresAt`
6. Click **Save**

> TTL deletion happens within 72 hours of the expiry timestamp. Documents are
> not charged for reads during TTL deletion.

### 2d. Confirm Firestore is in Production Mode
1. Firebase Console → **Build → Firestore Database**
2. The rules tab should show your deployed rules (not a permissive default)
3. If you see `allow read, write: if true;` — your rules have NOT been deployed yet.
   Run `./deploy.sh` to push them.

---

## PART 3 — Google Cloud Console Setup

### 3a. Register the Workspace Add-on manifest
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project `planning-poker-meet-491015`
3. Left sidebar: **APIs & Services → Google Workspace Marketplace SDK**
   - If not listed, search for it and click **Enable**
4. Click **App Configuration** tab
5. Fill in:
   - App name: `Planning Poker`
   - App description: `Agile planning poker for your Google Meet`
   - App icon: upload your logo (128×128 PNG)
   - Privacy policy URL: `https://planning-poker-meet-491015.web.app/privacy.html`
6. Click **Store Listing** tab → fill in screenshots and description
7. Click **OAuth scopes** tab → no scopes needed (add-on uses Firebase Auth, not Google OAuth)
8. Click **HTTP Deployments** tab
   - Click **Create new deployment**
   - Deployment name: `production`
   - Paste the contents of your `deployment.json` file
   - Click **Save**
9. Under **Install settings** → set to **Private** (for personal/work use)
   - Private means only you and people you explicitly share it with can install it

### 3b. Install the add-on for your accounts
For **personal Gmail / Google account:**
1. Copy the install URL from the Marketplace SDK console
2. Open in a browser signed in to your personal account
3. Click **Install**

For **work/Google Workspace account:**
- If your org has Workspace Admin restrictions, you or your admin may need to allowlist the add-on
- Go to [admin.google.com](https://admin.google.com) → Apps → Google Workspace Marketplace apps → Add app
- Or install directly if your org allows user-installed Marketplace apps

---

## PART 4 — Set Budget Alerts (prevent surprise charges)

The app should stay well within Firebase free tier, but set an alert as a safety net.

### 4a. Firebase budget alert
1. [Firebase Console](https://console.firebase.google.com) → ⚙️ Project Settings → **Usage and billing**
2. Click **Modify plan** if not already on Spark (free) or Blaze (pay-as-you-go)
3. For Blaze plan: Go to [Google Cloud Billing](https://console.cloud.google.com/billing)
4. Select your billing account → **Budgets & alerts**
5. Click **Create budget**
   - Amount: `$5` (enough to catch any runaway writes before real cost)
   - Alert at: 50%, 90%, 100%
   - Email: your email

> Expected monthly cost at personal/work usage: **$0** (Firestore free tier is
> 50,000 reads and 20,000 writes per day; this app uses ~50–500 reads and ~10–50
> writes per meeting day).

---

## PART 5 — Final Deployment

Once all steps above are complete:

```bash
# 1. Make sure your .env has the updated (rotated) credentials
cat .env

# 2. Deploy hosting + Firestore rules
./deploy.sh

# 3. Verify the live site loads (not via direct browser — it will show the
#    "Open inside Google Meet" message, which is correct)
open https://planning-poker-meet-491015.web.app/sidepanel/index.html

# 4. Test inside a real Google Meet
#    - Start or join a meeting
#    - Click Activities (puzzle piece icon) → Planning Poker
#    - Test: vote, reveal, new round, claim facilitator
```

---

## PART 6 — Post-Deploy Monitoring (first week)

Check these once a day for the first week:

| What to check | Where |
|---------------|-------|
| Firestore read/write count | Firebase Console → Firestore → Usage tab |
| Anonymous auth sign-ins | Firebase Console → Authentication → Users |
| App Check requests | Firebase Console → App Check → Metrics |
| Any Firebase errors | Firebase Console → Functions (none expected) |

**Red flags to watch for:**
- Writes/day > 1,000 (normal usage should be < 100)
- A single UID making > 50 writes/hour (indicates abuse or a bug)
- Unexpected Firestore documents that are not in the `rooms` collection

---

## Summary

| Step | Who | Estimated time |
|------|-----|----------------|
| Rotate Firebase API key | You | 2 min |
| Rotate reCAPTCHA keys | You | 2 min |
| Enable Anonymous Auth | You | 1 min |
| Enable + Enforce App Check | You | 3 min |
| Set TTL policy on `expiresAt` | You | 2 min |
| Register add-on manifest | You | 10 min |
| Install for personal + work accounts | You | 5 min |
| Set $5 budget alert | You | 3 min |
| Run `./deploy.sh` | You | 2 min |
| Smoke test in real meeting | You | 5 min |

**Total: ~35 minutes**
