// elements-mode-handler.js - Handles "Elements to Video" mode
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Uses shared fillSlateEditor + submitWithRetry from timing.js

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
      const images = this.getAllImagesForPrompt(commandData);

      // Skip prompts without images in elements mode
      if (images.length === 0) {
        console.warn(`[ElementsHandler] Prompt #${promptIndex} has no images, skipping in elements mode`);
        return { skipped: true, reason: 'No character images for elements mode' };
      }

      console.log(`[ElementsHandler] Processing prompt #${promptIndex} with ${images.length} images`);

      // Separate gallery vs upload images
      const galleryImages = images.filter(img => img.galleryItemName);
      const uploadImages = images.filter(img => !img.galleryItemName && (img.image?.dataUrl || img.imagePath));

      // Step 1: Add gallery images first (faster)
      for (const img of galleryImages) {
        const selected = await window.veo3GalleryMapper.selectMediaByName(img.galleryItemName);
        if (!selected) {
          console.warn(`[ElementsHandler] Gallery select failed for "${img.galleryItemName}", trying upload`);
          if (img.image?.dataUrl || img.imagePath) {
            await this.uploadFallback(img);
          }
        }
        await sleep(TIMING.NETWORK);
      }

      // Step 2: Upload remaining images via drag & drop
      for (const img of uploadImages) {
        await this.uploadFallback(img);
        await sleep(700);
      }

      // Step 3: Fill prompt text (shared function)
      await window.veo3Timing.fillSlateEditor(commandData.prompt);
      console.log(`[ElementsHandler] Prompt filled: "${commandData.prompt.substring(0, 60)}..."`);

      // Step 4: Submit with retry chain (shared function)
      const submitted = await window.veo3Timing.submitWithRetry();
      if (!submitted) {
        throw new Error('All submission strategies failed');
      }

      console.log('[ElementsHandler] Submission confirmed');
      return { skipped: false };
    },

    getAllImagesForPrompt(commandData) {
      return commandData.characterImages || [];
    },

    async uploadFallback(img) {
      const { sleep } = window.veo3Timing;
      let file = null;

      if (img.image?.dataUrl) {
        file = window.dataUrlToFile(img.image.dataUrl, img.image.name || `${img.name}.png`);
      }

      if (!file) {
        console.warn(`[ElementsHandler] No file data for "${img.name}"`);
        return;
      }

      // simulateImageDragDrop auto-detects target if not provided
      await window.simulateImageDragDrop(file);
      await sleep(700);
      await window.waitAndConfirmCrop();
    }
  };

  window.elementsHandler = elementsHandler;

  console.log('[Flow] Elements mode handler loaded');
})();
