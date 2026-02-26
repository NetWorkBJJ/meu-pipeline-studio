// image-creation-handler.js - Handles "Create Images" mode
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Character selection is now handled by content-bridge (gallery-based).
// This handler only fills the prompt and submits.

(function () {
  if (window.__veo3_imgcreation_loaded) return;
  window.__veo3_imgcreation_loaded = true;

  const imageCreationHandler = {
    async isImageCreationModeActive() {
      const modeText = window.veo3Selectors.getCurrentModeText();
      if (!modeText) return false;
      return modeText.includes('image') || modeText.includes('imagem') || modeText.includes('criar');
    },

    async processPromptWithImageCreation(promptIndex, commandData) {
      const { sleep, TIMING } = window.veo3Timing;

      console.log(`[ImageCreation] Processing prompt #${promptIndex}`);

      // Character/reference images are already selected from gallery by content-bridge.
      // We only need to fill the prompt and submit.

      // Step 1: Fill prompt (shared function)
      await window.veo3Timing.fillSlateEditor(commandData.prompt);
      console.log(`[ImageCreation] Prompt filled: "${commandData.prompt.substring(0, 60)}..."`);

      // Step 2: Submit with retry chain (shared function)
      const submitted = await window.veo3Timing.submitWithRetry();
      if (!submitted) {
        throw new Error('All submission strategies failed');
      }

      console.log('[ImageCreation] Submission confirmed');
    },

    getAllImagesForPrompt(commandData) {
      return commandData.characterImages || [];
    }
  };

  window.imageCreationHandler = imageCreationHandler;

  console.log('[Flow] Image creation handler loaded');
})();
