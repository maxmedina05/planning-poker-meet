// Planning Poker — Side Panel
// Docs: https://developers.google.com/workspace/meet/add-ons/guides/overview
// Config loaded from ../config.js (CONFIG.cloudProjectNumber)

(async function () {
  const CLOUD_PROJECT_NUMBER = CONFIG.cloudProjectNumber;

  const loadingEl = document.getElementById('loading');
  const mainEl    = document.getElementById('main');

  // Dev guard: SDK requires a meet_sdk URL param injected by Meet's iframe loader.
  // Opening this page directly in a browser will always fail at createAddonSession.
  if (typeof window.meet === 'undefined' || !new URLSearchParams(window.location.search).has('meet_sdk')) {
    loadingEl.textContent = 'Open this page inside Google Meet to use Planning Poker.';
    return;
  }

  try {
    // 1. Create session — required before any SDK interaction
    const session = await window.meet.addon.createAddonSession({
      cloudProjectNumber: CLOUD_PROJECT_NUMBER,
    });

    // 2. Side panel client
    const sidePanelClient = await session.createSidePanelClient();

    // 3. Meeting info
    const meetingInfo = await sidePanelClient.getMeetingInfo();
    console.log('[PlanningPoker] Meeting ID:', meetingInfo.meetingId);
    console.log('[PlanningPoker] Meeting code:', meetingInfo.meetingCode);

    // Phase 3: Co-Doing client (real-time vote sync)
    // const coDoingClient = await session.createCoDoingClient({
    //   activityTitle: 'Planning Poker',
    //   onCoDoingStateChanged(coDoingState) {
    //     const state = JSON.parse(new TextDecoder().decode(coDoingState.bytes));
    //     applyState(state);
    //   },
    // });

    // Show UI
    loadingEl.hidden = true;
    mainEl.hidden    = false;

  } catch (err) {
    const msg = err && err.errorType
      ? 'SDK error: ' + err.errorType
      : 'Failed to connect: ' + (err.message || String(err));
    loadingEl.textContent = msg;
    console.error('[PlanningPoker] Init error:', err);
  }
}());
