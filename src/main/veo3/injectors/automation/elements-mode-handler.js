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

      // Step 1: Drag & drop (simulateImageDragDrop handles #PINHOLE targeting + feedback)
      await window.simulateImageDragDrop(file);
      await sleep(800);

      // Step 2: Wait for and confirm crop dialog
      try {
        await window.waitAndConfirmCrop(15000);
      } catch (cropError) {
        console.warn('[ElementsHandler] Crop error, continuing:', cropError.message);
      }

      // Step 3: Wait for upload to complete (30s timeout, 6 signals)
      try {
        await window.waitForImageUpload(30000);
      } catch (uploadError) {
        console.warn('[ElementsHandler] Upload timeout, checking state...');
      }

      // Step 4: Check and correct video mode after upload (reference pattern)
      await checkAndSetVideoMode();
    }
  };

  // Verify and fix creation mode after image upload (ported from nardoto-flow reference).
  // After uploading an image, Google Flow may switch back to "Text to Video" mode.
  // This function detects that and switches to "Frame to Video" / "Elements" mode.
  async function checkAndSetVideoMode() {
    const { sleep } = window.veo3Timing;
    await sleep(1000);

    const modeBtn = document.querySelector('button[role="combobox"][aria-controls*="radix"]');
    if (!modeBtn) {
      console.log('[ElementsHandler] Mode combobox not found, skipping mode check');
      return;
    }

    const text = modeBtn.textContent || '';
    console.log('[ElementsHandler] Current mode after upload:', text.trim());

    // Already in correct mode
    if (text.includes('Frame') || text.includes('Elemento') || text.includes('Element') ||
        text.includes('Ingredients')) {
      console.log('[ElementsHandler] Already in correct mode');
      return;
    }

    // Need to switch from text mode to frames/elements
    if (text.includes('Texto') || text.includes('Text')) {
      console.log('[ElementsHandler] Switching from text mode to frames/elements...');

      if (window.veo3RobustClick) await window.veo3RobustClick(modeBtn);
      else modeBtn.click();
      await sleep(500);

      const options = document.querySelectorAll('[role="option"], [data-radix-collection-item]');
      for (const opt of options) {
        const optText = opt.textContent || '';
        if (optText.includes('Frame') || optText.includes('Elemento') ||
            optText.includes('Element') || optText.includes('Ingredients')) {
          if (window.veo3RobustClick) await window.veo3RobustClick(opt);
          else opt.click();
          await sleep(800);
          console.log('[ElementsHandler] Mode switched to:', optText.trim());
          return;
        }
      }

      // Close dropdown if target option not found
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      console.warn('[ElementsHandler] Target mode option not found in dropdown');
    }
  }

  window.elementsHandler = elementsHandler;

  console.log('[Flow] Elements mode handler loaded');
})();
