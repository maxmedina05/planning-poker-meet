// Planning Poker — Side Panel
// Docs: https://developers.google.com/workspace/meet/add-ons/guides/overview

(async function () {
  const CARDS = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];

  const loadingEl    = document.getElementById('loading');
  const mainEl       = document.getElementById('main');
  const votingView   = document.getElementById('voting-view');
  const votedView    = document.getElementById('voted-view');
  const cardGrid     = document.getElementById('card-grid');
  const confirmBtn   = document.getElementById('confirm-btn');
  const changeBtn    = document.getElementById('change-btn');
  const votedCardEl  = document.getElementById('voted-card');

  // ── State ────────────────────────────────────────────────────────────────
  let selectedCard  = null;
  let confirmedCard = null;

  // ── SDK init ─────────────────────────────────────────────────────────────
  if (typeof window.meet === 'undefined' || !new URLSearchParams(window.location.search).has('meet_sdk')) {
    loadingEl.textContent = 'Open this page inside Google Meet to use Planning Poker.';
    return;
  }

  let sidePanelClient;
  try {
    const session = await window.meet.addon.createAddonSession({
      cloudProjectNumber: CONFIG.cloudProjectNumber,
    });
    sidePanelClient = await session.createSidePanelClient();

    const meetingInfo = await sidePanelClient.getMeetingInfo();
    console.log('[PlanningPoker] Meeting ID:', meetingInfo.meetingId);

    // Phase 3: Co-Doing client goes here
    // const coDoingClient = await session.createCoDoingClient({ ... });

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
    if (value === '☕') btn.style.fontSize = '18px';
    btn.setAttribute('aria-label', 'Vote ' + value);
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
    votedCardEl.textContent = confirmedCard;
    votingView.hidden = true;
    votedView.hidden  = false;

    // Phase 3: broadcast vote via Co-Doing API
    // broadcastVote(confirmedCard);
  }

  function changeVote() {
    votingView.hidden = false;
    votedView.hidden  = true;
    // Re-highlight the previously confirmed card
    selectCard(confirmedCard);
  }

  confirmBtn.addEventListener('click', confirmVote);
  changeBtn.addEventListener('click', changeVote);

  // ── Show UI ───────────────────────────────────────────────────────────────
  loadingEl.hidden = true;
  mainEl.hidden    = false;

}());
