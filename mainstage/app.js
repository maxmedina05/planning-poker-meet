// Planning Poker — Main Stage
// Docs: https://developers.google.com/workspace/meet/add-ons/guides/overview
// Config loaded from ../config.js (CONFIG.cloudProjectNumber)

(async function () {
  const CLOUD_PROJECT_NUMBER = CONFIG.cloudProjectNumber;

  const loadingEl = document.getElementById('loading');
  const mainEl    = document.getElementById('main');

  if (typeof window.meet === 'undefined' || !new URLSearchParams(window.location.search).has('meet_sdk')) {
    loadingEl.textContent = 'Open this page inside Google Meet to use Planning Poker.';
    return;
  }

  try {
    const session = await window.meet.addon.createAddonSession({
      cloudProjectNumber: CLOUD_PROJECT_NUMBER,
    });

    // Main stage uses createMainStageClient — never createSidePanelClient
    const mainStageClient = await session.createMainStageClient();

    const meetingInfo = await mainStageClient.getMeetingInfo();
    console.log('[PlanningPoker] Main stage — Meeting ID:', meetingInfo.meetingId);

    // Phase 3: Co-Doing client for vote sync
    // const coDoingClient = await session.createCoDoingClient({
    //   activityTitle: 'Planning Poker',
    //   onCoDoingStateChanged(coDoingState) {
    //     const state = JSON.parse(new TextDecoder().decode(coDoingState.bytes));
    //     renderResults(state);
    //   },
    // });

    loadingEl.hidden = true;
    mainEl.hidden    = false;

  } catch (err) {
    const msg = err && err.errorType
      ? 'SDK error: ' + err.errorType
      : 'Failed to load: ' + (err.message || String(err));
    loadingEl.textContent = msg;
    console.error('[PlanningPoker] Main stage error:', err);
  }
}());
