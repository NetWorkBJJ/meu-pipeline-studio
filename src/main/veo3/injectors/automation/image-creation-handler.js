// image-creation-handler.js - Handles "Create Images" mode (Nano Banana Pro)
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Uses shared fillSlateEditor + submitWithRetry from timing.js

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
      const images = this.getAllImagesForPrompt(commandData);

      console.log(`[ImageCreation] Processing prompt #${promptIndex} with ${images.length} ref images`);

      // Step 1: Add reference images (if any)
      const galleryImages = images.filter(img => img.galleryItemName);
      const uploadImages = images.filter(img => !img.galleryItemName && (img.image?.dataUrl || img.imagePath));

      for (const img of galleryImages) {
        const selected = await window.veo3GalleryMapper.selectMediaByName(img.galleryItemName);
        if (!selected && (img.image?.dataUrl || img.imagePath)) {
          await this.uploadFallback(img);
        }
        await sleep(TIMING.NETWORK);
      }

      for (const img of uploadImages) {
        await this.uploadFallback(img);
        await sleep(700);
      }

      // Step 2: Fill prompt (shared function)
      await window.veo3Timing.fillSlateEditor(commandData.prompt);
      console.log(`[ImageCreation] Prompt filled: "${commandData.prompt.substring(0, 60)}..."`);

      // Step 3: Submit with retry chain (shared function)
      const submitted = await window.veo3Timing.submitWithRetry();
      if (!submitted) {
        throw new Error('All submission strategies failed');
      }

      console.log('[ImageCreation] Submission confirmed');
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
        console.warn(`[ImageCreation] No file data for "${img.name}"`);
        return;
      }

      // simulateImageDragDrop auto-detects target if not provided
      await window.simulateImageDragDrop(file);
      await sleep(700);
      await window.waitAndConfirmCrop();
    }
  };

  window.imageCreationHandler = imageCreationHandler;

  console.log('[Flow] Image creation handler loaded');
})();
