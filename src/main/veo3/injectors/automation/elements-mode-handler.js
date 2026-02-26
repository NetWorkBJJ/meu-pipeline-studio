// elements-mode-handler.js - Handles "Elements to Video" mode
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Character selection is now handled by content-bridge (gallery-based).
// This handler only fills the prompt and submits.

(function () {
  if (window.__veo3_elements_loaded) return;
  window.__veo3_elements_loaded = true;

  const elementsHandler = {
    async isElementsModeActive() {
      const modeText = window.veo3Selectors.getCurrentModeText();
      if (!modeText) return false;
      return modeText.includes('element') || modeText.includes('elemento');
    },

    async processPromptWithElements(promptIndex, commandData) {
      const { sleep, TIMING } = window.veo3Timing;

      console.log(`[ElementsHandler] Processing prompt #${promptIndex}`);

      // Character images are already selected from gallery by content-bridge.
      // We only need to fill the prompt and submit.

      // Step 1: Fill prompt text (shared function)
      await window.veo3Timing.fillSlateEditor(commandData.prompt);
      console.log(`[ElementsHandler] Prompt filled: "${commandData.prompt.substring(0, 60)}..."`);

      // Step 2: Submit with retry chain (shared function)
      const submitted = await window.veo3Timing.submitWithRetry();
      if (!submitted) {
        throw new Error('All submission strategies failed');
      }

      console.log('[ElementsHandler] Submission confirmed');
      return { skipped: false };
    },

    getAllImagesForPrompt(commandData) {
      return commandData.characterImages || [];
    }
  };

  window.elementsHandler = elementsHandler;

  console.log('[Flow] Elements mode handler loaded');
})();
