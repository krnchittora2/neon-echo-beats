/* ============================================================
   Poki SDK wrapper
   - Every call is a safe no-op if the SDK failed to load
     (e.g. ad blocker), so the game always stays playable.
   - Suppresses duplicate consecutive gameplayStart/Stop events.
   - Tracks ad state so the game can mute audio and ignore input.
   ============================================================ */
'use strict';

const Poki = (() => {
  const sdk = () => window.PokiSDK;
  let playing = false;
  let adActive = false;

  // Poki requirement: Space / arrow keys must not scroll the host page
  const NO_SCROLL = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  window.addEventListener('keydown', e => { if (NO_SCROLL.has(e.key)) e.preventDefault(); });
  window.addEventListener('wheel', e => e.preventDefault(), { passive: false });

  return {
    get adActive() { return adActive; },

    init() {
      if (!sdk()) return Promise.resolve();
      return sdk().init().catch(() => { /* initialized with issues; load the game anyway */ });
    },

    gameLoadingFinished() { sdk() && sdk().gameLoadingFinished(); },

    gameplayStart() {
      if (playing || adActive) return;
      playing = true;
      sdk() && sdk().gameplayStart();
    },

    gameplayStop() {
      if (!playing || adActive) return;
      playing = false;
      sdk() && sdk().gameplayStop();
    },

    /** Request a mid-roll ad. onPause runs when the ad starts; resolves when the game may continue. */
    commercialBreak(onPause) {
      if (!sdk() || adActive) return Promise.resolve();
      adActive = true;
      return sdk().commercialBreak(() => onPause && onPause())
        .catch(() => {})
        .then(() => { adActive = false; });
    },
  };
})();
