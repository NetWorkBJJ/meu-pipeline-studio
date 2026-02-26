// image-automator.js - Drag & drop simulation and image upload for Google Flow
// IIFE-wrapped to prevent re-injection errors on SPA navigation

(function () {
  if (window.__veo3_imgauto_loaded) return;
  window.__veo3_imgauto_loaded = true;

  const IMAGE_CONFIG = {
    supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
    maxFileSize: 10 * 1024 * 1024
  };

  class ImageManager {
    constructor() {
      this.images = new Map(); // promptIndex -> File
    }

    setImage(promptIndex, imageFile) {
      this.images.set(promptIndex, imageFile);
    }

    getImageForCard(promptIndex) {
      return this.images.get(promptIndex) || null;
    }

    getImageCount() {
      return this.images.size;
    }

    clear() {
      this.images.clear();
    }
  }

  function dataUrlToFile(dataUrl, filename) {
    if (!dataUrl) return null;
    try {
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      return new File([u8arr], filename, { type: mime });
    } catch (e) {
      console.error('[ImageAutomator] dataUrlToFile error:', e);
      return null;
    }
  }

  async function simulateImageDragDrop(imageFile, targetElement) {
    const { sleep } = window.veo3Timing;
    if (!imageFile) {
      console.warn('[ImageAutomator] Missing image file');
      return false;
    }

    // Auto-detect drop target if not provided
    if (!targetElement) {
      const editorSel = window.veo3Selectors?.slateEditor || '[data-slate-editor="true"][contenteditable="true"]';
      const editor = document.querySelector(editorSel);
      targetElement = editor?.closest('[class]') || editor || document.body;
    }

    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(imageFile);

      const commonEventInit = {
        bubbles: true,
        cancelable: true,
        dataTransfer
      };

      // Simulate drag enter -> drag over -> drop sequence
      targetElement.dispatchEvent(new DragEvent('dragenter', commonEventInit));
      await sleep(100);

      targetElement.dispatchEvent(new DragEvent('dragover', commonEventInit));
      await sleep(100);

      targetElement.dispatchEvent(new DragEvent('drop', commonEventInit));
      await sleep(500);

      console.log('[ImageAutomator] Drag & drop simulated for:', imageFile.name);
      return true;
    } catch (e) {
      console.error('[ImageAutomator] Drag & drop failed:', e);
      return false;
    }
  }

  async function waitAndConfirmCrop(timeout = 5000) {
    const { sleep } = window.veo3Timing;
    const { findButtonByLabel, findButtonByIcon } = window.veo3Selectors;

    await sleep(500);

    // Look for confirm/done button in crop dialog
    const confirmBtn = findButtonByLabel('done') || findButtonByLabel('confirm') || findButtonByLabel('apply');
    if (confirmBtn) {
      confirmBtn.click();
      await sleep(300);
      console.log('[ImageAutomator] Crop confirmed');
      return true;
    }

    // Try finding by checkmark icon
    const checkBtn = findButtonByIcon('check') || findButtonByIcon('done');
    if (checkBtn) {
      checkBtn.click();
      await sleep(300);
      return true;
    }

    console.log('[ImageAutomator] No crop dialog found (might not be needed)');
    return false;
  }

  async function waitForImageUpload(timeout = 10000) {
    const { sleep } = window.veo3Timing;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const refCards = document.querySelectorAll(
        window.veo3Selectors?.referenceCards ||
        '.reference-image-card, [class*="reference"] img, [class*="ingredient"] img'
      );
      if (refCards.length > 0) {
        console.log('[ImageAutomator] Image uploaded successfully');
        return true;
      }
      await sleep(300);
    }

    console.warn('[ImageAutomator] Upload wait timed out');
    return false;
  }

  // Preserve existing instance if already created (avoid losing state on hypothetical re-init)
  window.imageManager = window.imageManager || new ImageManager();
  window.simulateImageDragDrop = simulateImageDragDrop;
  window.waitAndConfirmCrop = waitAndConfirmCrop;
  window.waitForImageUpload = waitForImageUpload;
  window.dataUrlToFile = dataUrlToFile;

  console.log('[Flow] Image automator loaded');
})();
