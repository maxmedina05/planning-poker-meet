// Planning Poker — Side Panel
// Docs: https://developers.google.com/workspace/meet/add-ons/guides/overview

(async function () {
  const CARDS = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];
  const NUMERIC = new Set(['0','1','2','3','5','8','13','21']);

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

  // ── State ─────────────────────────────────────────────────────────────────
  const myId = getOrCreateId();
  let selectedCard   = null;
  let confirmedCard  = null;
  let gameState      = { revealed: false, votes: {} };
  let coDoingClient;

  function getOrCreateId() {
    // localStorage persists across panel close/reopen (same origin, same browser).
    // This ensures a participant's vote isn't orphaned if they close and reopen the panel.
    let id = localStorage.getItem('poker_id');
    if (!id) {
      id = Math.random().toString(36).slice(2, 11);
      localStorage.setItem('poker_id', id);
    }
    return id;
  }

  // ── SDK init ──────────────────────────────────────────────────────────────
  if (typeof window.meet === 'undefined' || !new URLSearchParams(window.location.search).has('meet_sdk')) {
    loadingEl.textContent = 'Open this page inside Google Meet to use Planning Poker.';
    return;
  }

  try {
    const session = await window.meet.addon.createAddonSession({
      cloudProjectNumber: CONFIG.cloudProjectNumber,
    });

    const sidePanelClient = await session.createSidePanelClient();
    const meetingInfo = await sidePanelClient.getMeetingInfo();
    console.log('[PlanningPoker] Meeting ID:', meetingInfo.meetingId);

    // Co-Doing: real-time vote sync across all participants
    coDoingClient = await session.createCoDoingClient({
      activityTitle: 'Planning Poker',
      onCoDoingStateChanged(coDoingState) {
        const incoming = JSON.parse(new TextDecoder().decode(coDoingState.bytes));
        applyState(incoming);
      },
    });

  } catch (err) {
    const msg = err && err.errorType
      ? 'SDK error: ' + err.errorType
      : 'Failed to connect: ' + (err.message || String(err));
    loadingEl.textContent = msg;
    console.error('[PlanningPoker] Init error:', err);
    return;
  }

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
    const newState = {
      ...gameState,
      votes: { ...gameState.votes, [myId]: confirmedCard },
    };
    broadcast(newState);
    showVotedView();
  }

  function changeVote() {
    showVotingView();
    selectCard(confirmedCard);
  }

  function revealVotes() {
    broadcast({ ...gameState, revealed: true });
  }

  function newRound() {
    selectedCard  = null;
    confirmedCard = null;
    broadcast({ revealed: false, votes: {} });
    showVotingView();
  }

  confirmBtn.addEventListener('click', confirmVote);
  changeBtn.addEventListener('click', changeVote);
  revealBtn.addEventListener('click', revealVotes);
  newRoundBtn.addEventListener('click', newRound);

  // ── State sync ────────────────────────────────────────────────────────────
  function broadcast(state) {
    gameState = state;
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    coDoingClient.broadcastStateUpdate({ bytes });
    // Apply locally too — broadcastStateUpdate only sends to others
    renderVoteCount(state);
    if (state.revealed) showRevealedView(state);
  }

  function applyState(state) {
    gameState = state;

    // If a new round was started and we had voted, reset local vote state
    if (!state.votes[myId]) {
      if (confirmedCard !== null) {
        selectedCard  = null;
        confirmedCard = null;
        showVotingView();
      }
      renderVoteCount(state);
      return;
    }

    if (state.revealed) {
      showRevealedView(state);
      return;
    }

    // Our vote is in — show voted view with updated count
    votedCardEl.textContent = state.votes[myId];
    renderVoteCount(state);
    if (!votedView.hidden === false) showVotedView();
  }

  // ── View switching ────────────────────────────────────────────────────────
  function showVotingView() {
    votingView.hidden   = false;
    votedView.hidden    = true;
    revealedView.hidden = true;
  }

  function showVotedView() {
    votedCardEl.textContent = confirmedCard;
    votingView.hidden   = true;
    votedView.hidden    = false;
    revealedView.hidden = true;
    renderVoteCount(gameState);
  }

  function showRevealedView(state) {
    votingView.hidden   = true;
    votedView.hidden    = true;
    revealedView.hidden = false;
    renderResults(state);
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderVoteCount(state) {
    const count = Object.keys(state.votes).length;
    voteCountEl.textContent = count === 0
      ? ''
      : count === 1 ? '1 vote in' : count + ' votes in';
  }

  function renderResults(state) {
    const values = Object.values(state.votes);

    // Card display
    resultsGrid.innerHTML = '';
    values
      .slice()
      .sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        if (!isNaN(na)) return -1;
        if (!isNaN(nb)) return 1;
        return 0;
      })
      .forEach(value => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.textContent = value;
        // Highlight if it matches our vote
        if (value === confirmedCard) card.classList.add('result-card--mine');
        resultsGrid.appendChild(card);
      });

    // Stats: average of numeric votes only
    const numeric = values.filter(v => NUMERIC.has(v)).map(Number);
    if (numeric.length > 0) {
      const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
      const min = Math.min(...numeric);
      const max = Math.max(...numeric);
      resultsStats.innerHTML =
        '<span>Avg: <strong>' + avg.toFixed(1) + '</strong></span>' +
        (min !== max ? ' &nbsp;·&nbsp; <span>Range: <strong>' + min + '–' + max + '</strong></span>' : ' &nbsp;·&nbsp; <span>Consensus! 🎉</span>');
    } else {
      resultsStats.textContent = '';
    }
  }

  // ── Show UI ───────────────────────────────────────────────────────────────
  loadingEl.hidden = true;
  mainEl.hidden    = false;

}());
