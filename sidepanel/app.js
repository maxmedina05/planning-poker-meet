// Planning Poker — Side Panel
// Docs: https://developers.google.com/workspace/meet/add-ons/guides/overview

(async function () {
  const VERSION = '1.0.0';
  const CARDS   = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];
  const NUMERIC = new Set(['0', '1', '2', '3', '5', '8', '13', '21']);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const loadingEl    = document.getElementById('loading');
  const mainEl       = document.getElementById('main');
  const hostBadge    = document.getElementById('host-badge');
  const storyInput   = document.getElementById('story-input');
  const storyDisplay = document.getElementById('story-display');
  const claimBtn     = document.getElementById('claim-btn');
  const votingView   = document.getElementById('voting-view');
  const votedView    = document.getElementById('voted-view');
  const revealedView = document.getElementById('revealed-view');
  const cardGrid     = document.getElementById('card-grid');
  const confirmBtn   = document.getElementById('confirm-btn');
  const changeBtn    = document.getElementById('change-btn');
  const revealBtn    = document.getElementById('reveal-btn');
  const newRoundBtn  = document.getElementById('new-round-btn');
  const votedCardEl  = document.getElementById('voted-card');
  const voteCountEl  = document.getElementById('vote-count');
  const resultsGrid  = document.getElementById('results-grid');
  const resultsStats = document.getElementById('results-stats');

  let confirmedCard = null;
  let selectedCard  = null;
  let isHost        = false;

  // ── Meet SDK init ─────────────────────────────────────────────────────────
  if (typeof window.meet === 'undefined' || !new URLSearchParams(window.location.search).has('meet_sdk')) {
    loadingEl.textContent = 'Open this page inside Google Meet to use Planning Poker.';
    return;
  }

  let meetingId;
  try {
    const session = await window.meet.addon.createAddonSession({
      cloudProjectNumber: CONFIG.cloudProjectNumber,
    });
    const sidePanelClient = await session.createSidePanelClient();
    const meetingInfo = await sidePanelClient.getMeetingInfo();
    meetingId = meetingInfo.meetingId;
    console.log('[PlanningPoker] Connected to meeting.');
  } catch (err) {
    loadingEl.textContent = err && err.errorType
      ? 'SDK error: ' + err.errorType
      : 'Failed to connect: ' + (err.message || String(err));
    console.error('[PlanningPoker] Init error:', err);
    return;
  }

  // ── Firebase init ─────────────────────────────────────────────────────────
  try {
    firebase.initializeApp(CONFIG.firebase);
    // App Check: cryptographically proves requests come from this app/domain.
    // If the key is absent (local dev without the secret), App Check is skipped.
    if (CONFIG.recaptchaSiteKey) {
      const appCheck = firebase.appCheck();
      appCheck.activate(
        new firebase.appCheck.ReCaptchaV3Provider(CONFIG.recaptchaSiteKey),
        true // auto-refresh tokens
      );
    }
  } catch (err) {
    loadingEl.textContent = 'Firebase init failed: ' + (err.message || String(err));
    console.error('[PlanningPoker] Firebase error:', err);
    return;
  }

  // ── Firebase emulator support (local dev only) ────────────────────────────
  if (location.hostname === 'localhost') {
    firebase.auth().useEmulator('http://localhost:9099');
    firebase.firestore().useEmulator('localhost', 8080);
  }

  // ── Participant identity (Anonymous Auth) ──────────────────────────────────
  let myId;
  try {
    const userCredential = await firebase.auth().signInAnonymously();
    myId = userCredential.user.uid;
    console.log('[PlanningPoker] Signed in anonymously:', myId);
  } catch (err) {
    loadingEl.textContent = 'Auth failed: ' + (err.message || String(err));
    console.error('[PlanningPoker] Auth error:', err);
    return;
  }

  // ── Firestore refs ────────────────────────────────────────────────────────
  const db      = firebase.firestore();
  const roomDoc = db.collection('rooms').doc(meetingId);

  function ttl24h() {
    return firebase.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
  }

  // ── Claim host: first writer wins (atomic transaction) ────────────────────
  async function claimHostIfEmpty() {
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(roomDoc);
        if (!snap.exists) {
          tx.set(roomDoc, {
            hostId: myId,
            storyTitle: '',
            revealed: false,
            votes: {},
            expiresAt: ttl24h(),
          });
        } else if (!snap.data().hostId) {
          tx.update(roomDoc, { hostId: myId, expiresAt: ttl24h() });
        }
        // If hostId already set, do nothing
      });
    } catch (err) {
      console.error('[PlanningPoker] Host claim failed:', err);
    }
  }

  await claimHostIfEmpty();

  // ── Render card grid ──────────────────────────────────────────────────────
  CARDS.forEach(value => {
    const btn = document.createElement('button');
    btn.className = 'card';
    btn.textContent = value;
    btn.dataset.value = value;
    btn.setAttribute('aria-label', 'Vote ' + value);
    if (value === '☕') btn.style.fontSize = '18px';
    btn.addEventListener('click', () => selectCard(value));
    cardGrid.appendChild(btn);
  });

  // ── Interactions ──────────────────────────────────────────────────────────
  function selectCard(value) {
    selectedCard = value;
    document.querySelectorAll('.card').forEach(c => {
      c.classList.toggle('card--selected', c.dataset.value === value);
    });
    confirmBtn.disabled = false;
  }

  function confirmVote() {
    if (!CARDS.includes(selectedCard)) return;
    confirmedCard = selectedCard;
    roomDoc.update({ ['votes.' + myId]: confirmedCard, expiresAt: ttl24h() });
  }

  function changeVote() {
    showVotingView();
    selectCard(confirmedCard);
  }

  function revealVotes() {
    roomDoc.update({ revealed: true, expiresAt: ttl24h() });
  }

  function newRound() {
    confirmedCard = null;
    selectedCard  = null;
    roomDoc.update({ revealed: false, votes: {}, expiresAt: ttl24h() });
    showVotingView();
  }

  function claimHost() {
    roomDoc.update({ hostId: myId, expiresAt: ttl24h() });
  }

  confirmBtn.addEventListener('click', confirmVote);
  changeBtn.addEventListener('click', changeVote);
  revealBtn.addEventListener('click', revealVotes);
  newRoundBtn.addEventListener('click', newRound);
  claimBtn.addEventListener('click', claimHost);

  // Story title: update Firestore on blur (not on every keystroke)
  storyInput.addEventListener('blur', () => {
    roomDoc.update({ storyTitle: storyInput.value.trim(), expiresAt: ttl24h() });
  });
  // Also save on Enter key
  storyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') storyInput.blur();
  });

  // ── Real-time listener ────────────────────────────────────────────────────
  roomDoc.onSnapshot(snapshot => {
    const state    = snapshot.exists ? snapshot.data() : {};
    const votes    = state.votes    || {};
    const hostId   = state.hostId   || null;
    const revealed = state.revealed || false;
    const title    = state.storyTitle || '';

    // Update host status
    isHost = (myId === hostId);
    applyHostUI(isHost, hostId);

    // Update story title
    applyStoryTitle(title);

    if (revealed) {
      showRevealedView(votes);
      return;
    }

    const myVote = votes[myId];

    // New round was started by host — reset local state
    if (!myVote && confirmedCard !== null) {
      confirmedCard = null;
      selectedCard  = null;
      showVotingView();
      return;
    }

    if (myVote) {
      confirmedCard = myVote;
      votedCardEl.textContent = myVote;
      showVotedView(votes);
    } else {
      renderVoteCount(votes);
    }
  });

  // ── Host UI ───────────────────────────────────────────────────────────────
  function applyHostUI(host, hostId) {
    hostBadge.hidden    = !host;
    storyInput.hidden   = !host;
    storyDisplay.hidden = host;
    // Show claim button only if someone else is host (hostId exists but isn't me)
    claimBtn.hidden     = host || hostId === null;
    revealBtn.hidden    = !host;
    newRoundBtn.hidden  = !host;
  }

  function applyStoryTitle(title) {
    // Don't overwrite what the host is actively typing
    if (document.activeElement !== storyInput) {
      storyInput.value = title;
    }
    storyDisplay.textContent = title;
    storyDisplay.hidden = isHost || !title;
  }

  // ── View switching ────────────────────────────────────────────────────────
  function showVotingView() {
    votingView.hidden   = false;
    votedView.hidden    = true;
    revealedView.hidden = true;
    confirmBtn.disabled = selectedCard === null;
    // Reset card highlights
    document.querySelectorAll('.card').forEach(c => c.classList.remove('card--selected'));
    selectedCard = null;
  }

  function showVotedView(votes) {
    votingView.hidden   = true;
    votedView.hidden    = false;
    revealedView.hidden = true;
    renderVoteCount(votes);
  }

  function showRevealedView(votes) {
    votingView.hidden   = true;
    votedView.hidden    = true;
    revealedView.hidden = false;
    renderResults(votes);
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderVoteCount(votes) {
    const count = Object.keys(votes).length;
    voteCountEl.textContent = count === 0 ? '' : count === 1 ? '1 vote in' : count + ' votes in';
  }

  function renderResults(votes) {
    const values = Object.values(votes);

    resultsGrid.innerHTML = '';
    values
      .slice()
      .sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return isNaN(na) ? 1 : -1;
      })
      .forEach(value => {
        const card = document.createElement('div');
        card.className = 'result-card' + (value === confirmedCard ? ' result-card--mine' : '');
        card.textContent = value;
        resultsGrid.appendChild(card);
      });

    const numeric = values.filter(v => NUMERIC.has(v)).map(Number);
    if (numeric.length > 0) {
      const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
      const min = Math.min(...numeric);
      const max = Math.max(...numeric);
      resultsStats.textContent = min === max
        ? 'Avg: ' + avg.toFixed(1) + ' · Consensus! 🎉'
        : 'Avg: ' + avg.toFixed(1) + ' · Range: ' + min + '–' + max;
    } else {
      resultsStats.textContent = '';
    }
  }

  // ── Show UI ───────────────────────────────────────────────────────────────
  document.querySelector('.panel-title').textContent = '🃏 Planning Poker v' + VERSION;
  loadingEl.hidden = true;
  mainEl.hidden    = false;

}());
