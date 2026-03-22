// Copy this file to config.js and fill in your values.
// config.js is gitignored — never commit it directly.
// In CI, config.js is generated automatically from GitHub Actions secrets.
//
// NOTE: Firebase client config is intentionally public — security is enforced
// via Firebase Security Rules, not by hiding these values.

const CONFIG = {
  cloudProjectNumber: 'YOUR_CLOUD_PROJECT_NUMBER',
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },
};
