// image-automator.js - Drag & drop simulation and image upload for Google Flow
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Aligned with nardoto-flow reference: targets #PINHOLE_TEXT_AREA_ELEMENT_ID,
// uses array-based createDataTransfer, exact crop button detection, 6-signal upload check

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

  // Create DataTransfer - accepts array or single file (reference uses array)
  function createDataTransfer(files) {
    const dt = new DataTransfer();
    if (Array.isArray(files)) {
      files.forEach(f => dt.items.add(f));
    } else {
      dt.items.add(files);
    }
    return dt;
  }

  // Batch drag & drop - all files at once in a single DataTransfer
  async function batchDragDrop(files, targetElement) {
    const { sleep } = window.veo3Timing;
    if (!files || files.length === 0) {
      console.warn('[ImageAutomator] batchDragDrop: no files provided');
      return false;
    }

    console.log('[ImageAutomator] Batch drag & drop: ' + files.length + ' files');

    // Wait for prompt field: #PINHOLE (legacy) or Slate editor (current)
    const target = targetElement
      || document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID')
      || await window.veo3Timing.waitForAnyElement([
          '#PINHOLE_TEXT_AREA_ELEMENT_ID',
          '[data-slate-editor="true"][contenteditable="true"]',
          '[contenteditable="true"]'
        ], 5000);

    if (!target) {
      console.error('[ImageAutomator] batchDragDrop: no prompt field found');
      return false;
    }

    if (window.veo3Highlight) await window.veo3Highlight(target);

    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);

    target.dispatchEvent(new DragEvent('dragenter', {
      bubbles: true, cancelable: true, dataTransfer: dt
    }));
    await sleep(150);

    target.dispatchEvent(new DragEvent('dragover', {
      bubbles: true, cancelable: true, dataTransfer: dt
    }));
    await sleep(150);

    target.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt
    }));
    await sleep(500);

    console.log('[ImageAutomator] Batch drop dispatched: ' + files.length + ' files');
    return true;
  }

  // Main drag & drop simulation - aligned with nardoto-flow reference.
  // Target priority: #PINHOLE_TEXT_AREA_ELEMENT_ID (legacy) > Slate editor (current Flow UI).
  // 3 strategies: (1) drag events on target, (2) file input change, (3) VEO3 drop areas
  async function simulateImageDragDrop(imageFile, targetElement) {
    const { sleep } = window.veo3Timing;
    if (!imageFile) {
      console.warn('[ImageAutomator] Missing image file');
      return false;
    }

    // Wait for prompt field: #PINHOLE (legacy) or Slate editor (current)
    const target = targetElement
      || document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID')
      || await window.veo3Timing.waitForAnyElement([
          '#PINHOLE_TEXT_AREA_ELEMENT_ID',
          '[data-slate-editor="true"][contenteditable="true"]',
          '[contenteditable="true"]'
        ], 5000);

    if (!target) {
      console.error('[ImageAutomator] No prompt field found for drag & drop');
      return false;
    }

    console.log('[ImageAutomator] Target:', target.id || target.tagName);
    if (window.veo3Highlight) await window.veo3Highlight(target);
    await sleep(500);

    // Strategy 1: Full drag sequence on #PINHOLE (reference pattern)
    try {
      const dragEvents = [
        new DragEvent('dragenter', {
          bubbles: true, cancelable: true, dataTransfer: createDataTransfer([imageFile])
        }),
        new DragEvent('dragover', {
          bubbles: true, cancelable: true, dataTransfer: createDataTransfer([imageFile])
        }),
        new DragEvent('drop', {
          bubbles: true, cancelable: true, dataTransfer: createDataTransfer([imageFile])
        })
      ];

      for (const event of dragEvents) {
        target.dispatchEvent(event);
        await sleep(50);
      }
      console.log('[ImageAutomator] Strategy 1: drag events dispatched on', target.id || target.tagName);
    } catch (e) {
      console.warn('[ImageAutomator] Strategy 1 failed:', e.message);
    }

    // Strategy 2: Simulated file input change (some React frameworks listen for this)
    try {
      const tempInput = document.createElement('input');
      tempInput.type = 'file';
      tempInput.accept = 'image/*';
      tempInput.style.display = 'none';
      document.body.appendChild(tempInput);

      const fileList = new DataTransfer();
      fileList.items.add(imageFile);
      tempInput.files = fileList.files;

      tempInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      await sleep(300);
      document.body.removeChild(tempInput);
      console.log('[ImageAutomator] Strategy 2: file input dispatched');
    } catch (e) {
      console.warn('[ImageAutomator] Strategy 2 failed:', e.message);
    }

    // Strategy 3: VEO3-specific drop areas (from reference, excluding sidebar)
    try {
      const mainArea = document.querySelector('main, [role="main"], .veo3-content, #main-content');
      const searchArea = mainArea || document.body;
      const dropAreas = Array.from(
        searchArea.querySelectorAll('[class*="drop"], [class*="upload"], [class*="file"], [data-testid*="drop"]')
      ).filter(el => {
        const inSidebar = el.closest('#veo3-automator-sidebar, .song-card, [id^="drop-zone-"]');
        return !inSidebar && el.offsetParent !== null;
      });

      for (const area of dropAreas) {
        const events = [
          new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: createDataTransfer([imageFile]) }),
          new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: createDataTransfer([imageFile]) }),
          new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: createDataTransfer([imageFile]) })
        ];
        for (const event of events) {
          area.dispatchEvent(event);
          await sleep(100);
        }
      }
      if (dropAreas.length > 0) {
        console.log('[ImageAutomator] Strategy 3: drop on ' + dropAreas.length + ' VEO3 areas');
      }
    } catch (e) {
      console.warn('[ImageAutomator] Strategy 3 failed:', e.message);
    }

    await sleep(1000);
    console.log('[ImageAutomator] Drag & drop simulation complete for:', imageFile.name);
    return true;
  }

  // Wait for and confirm crop dialog - ported from nardoto-flow reference.
  // Uses exact class selectors, crop icon check (NOT crop_16_9), 800ms post-click wait.
  // Polls every 100ms for up to 15s (reference uses 15s timeout).
  async function waitAndConfirmCrop(timeout = 15000) {
    const { sleep } = window.veo3Timing;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Strategy 1: Exact class selectors from reference
      const exactSelectors = [
        'button[class*="gdArnN"][class*="kGrksz"]',
        'button.gdArnN.kGrksz'
      ];
      for (const sel of exactSelectors) {
        try {
          const btns = document.querySelectorAll(sel);
          for (const btn of btns) {
            if (btn.offsetParent === null) continue;
            const text = btn.textContent.trim();
            if (text.includes('Cortar') || text.includes('Crop') ||
                text.includes('salvar') || text.includes('Save')) {
              if (window.veo3RobustClick) await window.veo3RobustClick(btn);
              else btn.click();
              await sleep(800);
              console.log('[ImageAutomator] Crop confirmed (exact class)');
              return true;
            }
          }
        } catch (e) { /* skip invalid selector */ }
      }

      // Strategy 2: All buttons with crop icon (NOT crop_16_9) + correct text
      const allBtns = document.querySelectorAll('button');
      for (const btn of allBtns) {
        if (btn.offsetParent === null) continue;
        const text = btn.textContent.trim();
        const icon = btn.querySelector('i.google-symbols, i.material-icons');
        const iconText = icon?.textContent.trim() || '';

        const hasCropIcon = iconText === 'crop';
        const hasWrongIcon = iconText.includes('crop_');
        const hasCorrectText = text.includes('Cortar') || text.includes('Crop') ||
                               text.includes('salvar') || text.includes('Save');

        if (hasCropIcon && !hasWrongIcon && hasCorrectText) {
          if (window.veo3RobustClick) await window.veo3RobustClick(btn);
          else btn.click();
          await sleep(800);
          console.log('[ImageAutomator] Crop confirmed (icon+text)');
          return true;
        }
      }

      // Strategy 3: Generic labels (fallback)
      const { findButtonByLabel } = window.veo3Selectors;
      const fallback = findButtonByLabel('done') || findButtonByLabel('confirm') || findButtonByLabel('apply');
      if (fallback) {
        if (window.veo3RobustClick) await window.veo3RobustClick(fallback);
        else fallback.click();
        await sleep(800);
        console.log('[ImageAutomator] Crop confirmed (label fallback)');
        return true;
      }

      await sleep(100); // Poll every 100ms (reference pattern)
    }

    console.log('[ImageAutomator] No crop dialog found (might not be needed)');
    return false;
  }

  // Wait for image upload to complete - ported from nardoto-flow reference.
  // 6 signals checked: progress_activity icon, "Fazer upload" text, data-state="closed",
  // close icon in button, "Primeiro frame" text, reference image cards.
  // 30s timeout (reference default), 800ms stabilization delay after detection.
  async function waitForImageUpload(timeout = 30000) {
    const { sleep } = window.veo3Timing;
    const startTime = Date.now();
    let foundProgress = false;

    while (Date.now() - startTime < timeout) {
      // Signal 1: progress_activity icon (upload in progress)
      const allIcons = document.querySelectorAll('i.google-symbols, i.material-icons');
      for (const icon of allIcons) {
        if (icon.textContent.trim() === 'progress_activity') {
          if (!foundProgress) {
            console.log('[ImageAutomator] Upload in progress...');
            foundProgress = true;
          }
          break;
        }
      }

      // Signal 2: "Fazer upload" text (upload in progress - PT)
      const uploadText = Array.from(document.querySelectorAll('div')).find(el =>
        el.textContent.includes('Fazer upload') && el.querySelector('i')
      );
      if (uploadText && !foundProgress) {
        console.log('[ImageAutomator] Upload text detected');
        foundProgress = true;
      }

      // Signal 3: button[data-state="closed"] (upload complete)
      const closedBtn = document.querySelector('button[data-state="closed"]');

      // Signal 4: Close icon in button (image loaded, can be removed)
      let closeIconBtn = null;
      const btnIcons = document.querySelectorAll('button i.google-symbols, button i.material-icons');
      for (const icon of btnIcons) {
        if (icon.textContent.trim() === 'close') {
          closeIconBtn = icon.closest('button');
          break;
        }
      }

      // Signal 5: "Primeiro frame" / "First frame" text appeared
      const frameText = Array.from(document.querySelectorAll('span')).find(span =>
        span.textContent.includes('Primeiro frame') || span.textContent.includes('First frame')
      );

      // Signal 6: Reference image cards (original check)
      const refCards = document.querySelectorAll(
        window.veo3Selectors?.referenceCards ||
        '.reference-image-card, [class*="reference"] img, [class*="ingredient"] img'
      );

      // Any completion signal found
      if (closedBtn || closeIconBtn || frameText || refCards.length > 0) {
        console.log('[ImageAutomator] Upload complete! Stabilizing...');
        await sleep(800); // Stabilization delay (reference uses 800ms)
        return true;
      }

      await sleep(300);
    }

    console.warn('[ImageAutomator] Upload wait timed out (' + timeout + 'ms)');
    return false;
  }

  // Preserve existing instance if already created
  window.imageManager = window.imageManager || new ImageManager();
  window.simulateImageDragDrop = simulateImageDragDrop;
  window.batchDragDrop = batchDragDrop;
  window.waitAndConfirmCrop = waitAndConfirmCrop;
  window.waitForImageUpload = waitForImageUpload;
  window.dataUrlToFile = dataUrlToFile;

  console.log('[Flow] Image automator loaded');
})();
