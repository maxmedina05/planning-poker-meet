#!/usr/bin/env bash
# Planning Poker — local deploy script
# Usage: ./deploy.sh
#
# Reads .env, generates config.js and .firebaserc, then deploys to Firebase.
# Requires: firebase-tools installed globally (npm install -g firebase-tools)

set -euo pipefail

# ── Load .env ─────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill in your values."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

# ── Validate required variables ───────────────────────────────────────────────
REQUIRED=(
  CLOUD_PROJECT_NUMBER
  FIREBASE_PROJECT_ID
  RECAPTCHA_V3_SITE_KEY
  FIREBASE_API_KEY
  FIREBASE_AUTH_DOMAIN
  FIREBASE_STORAGE_BUCKET
  FIREBASE_MESSAGING_SENDER_ID
  FIREBASE_APP_ID
  CONTACT_EMAIL
)

for var in "${REQUIRED[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in .env"
    exit 1
  fi
done

# ── Generate config.js ────────────────────────────────────────────────────────
cat > config.js << EOF
const CONFIG = {
  cloudProjectNumber: '${CLOUD_PROJECT_NUMBER}',
  recaptchaSiteKey: '${RECAPTCHA_V3_SITE_KEY}',
  firebase: {
    apiKey: '${FIREBASE_API_KEY}',
    authDomain: '${FIREBASE_AUTH_DOMAIN}',
    projectId: '${FIREBASE_PROJECT_ID}',
    storageBucket: '${FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${FIREBASE_APP_ID}',
  },
};
EOF
echo "✓ config.js generated"

# ── Generate .firebaserc ──────────────────────────────────────────────────────
cat > .firebaserc << EOF
{
  "projects": {
    "default": "${FIREBASE_PROJECT_ID}"
  }
}
EOF
echo "✓ .firebaserc generated"

# ── Inject contact email into HTML templates ──────────────────────────────────
# Replaces {{CONTACT_EMAIL}} placeholder in public HTML files before deploy,
# then restores the placeholders so the repo files stay clean.
HTML_FILES=(privacy.html tos.html)
trap 'git restore "${HTML_FILES[@]}" 2>/dev/null || true' EXIT

for f in "${HTML_FILES[@]}"; do
  sed -i "s/{{CONTACT_EMAIL}}/${CONTACT_EMAIL}/g" "$f"
done
echo "✓ Contact email injected into HTML"

# ── Deploy ────────────────────────────────────────────────────────────────────
echo "Deploying to Firebase project: ${FIREBASE_PROJECT_ID}"
firebase deploy --only hosting,firestore:rules

echo ""
echo "✓ Deploy complete."
echo "  Hosting: https://${FIREBASE_PROJECT_ID}.web.app"
