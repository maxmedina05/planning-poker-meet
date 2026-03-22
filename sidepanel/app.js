// Planning Poker — Side Panel
// Docs: https://developers.google.com/workspace/meet/add-ons/guides/overview

(async function () {
  const CARDS   = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];
  const NUMERIC = new Set(['0', '1', '2', '3', '5', '8', '13', '21']);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const loadingEl    = document.getElementById('loading');
  const mainEl       = document.getElementById('main');
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

  // ── Participant identity ──────────────────────────────────────────────────
  // localStorage persists across panel close/reopen for the same origin.
  let myId = localStorage.getItem('poker_id');
  if (!myId) {
    myId = Math.random().toString(36).slice(2, 11);
    localStorage.setItem('poker_id', myId);
  }

  let confirmedCard = null;
  let selectedCard  = null;

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
    console.log('[PlanningPoker] Meeting ID:', meetingId);
  } catch (err) {
    const msg = err && err.errorType
      ? 'SDK error: ' + err.errorType
      : 'Failed to connect: ' + (err.message || String(err));
    loadingEl.textContent = msg;
    console.error('[PlanningPoker] Init error:', err);
    return;
  }

  // ── Firebase init ─────────────────────────────────────────────────────────
  try {
    firebase.initializeApp(CONFIG.firebase);
  } catch (err) {
    loadingEl.textContent = 'Firebase init failed: ' + (err.message || String(err));
    console.error('[PlanningPoker] Firebase error:', err);
    return;
  }
  const db      = firebase.database();
  const roomRef = db.ref('rooms/' + meetingId);

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
    confirmedCard = selectedCard;
    // Write only our own vote — Firebase merges, no overwrite risk
    roomRef.child('votes/' + myId).set(confirmedCard);
  }

  function changeVote() {
    showVotingView();
    selectCard(confirmedCard);
  }

  function revealVotes() {
    roomRef.child('revealed').set(true);
  }

  function newRound() {
    confirmedCard = null;
    selectedCard  = null;
    roomRef.set({ revealed: false, votes: {} });
    // Switch view immediately for the initiator — the Firebase listener
    // won't catch this because confirmedCard is already null by the time it fires
    showVotingView();
  }

  confirmBtn.addEventListener('click', confirmVote);
  changeBtn.addEventListener('click', changeVote);
  revealBtn.addEventListener('click', revealVotes);
  newRoundBtn.addEventListener('click', newRound);

  // ── Real-time listener ────────────────────────────────────────────────────
  // Fires for all participants (including ourselves) on every state change.
  roomRef.on('value', snapshot => {
    const state = snapshot.val() || { revealed: false, votes: {} };
    const votes = state.votes || {};

    if (state.revealed) {
      showRevealedView(votes);
      return;
    }

    const myVote = votes[myId];

    // Another participant started a new round — reset our local state
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

  // ── View switching ────────────────────────────────────────────────────────
  function showVotingView() {
    votingView.hidden   = false;
    votedView.hidden    = true;
    revealedView.hidden = true;
    confirmBtn.disabled = selectedCard === null;
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
      resultsStats.innerHTML = min === max
        ? 'Avg: <strong>' + avg.toFixed(1) + '</strong> &nbsp;·&nbsp; Consensus! 🎉'
        : 'Avg: <strong>' + avg.toFixed(1) + '</strong> &nbsp;·&nbsp; Range: <strong>' + min + '–' + max + '</strong>';
    } else {
      resultsStats.textContent = '';
    }
  }

  // ── Show UI ───────────────────────────────────────────────────────────────
  loadingEl.hidden = true;
  mainEl.hidden    = false;

}());
