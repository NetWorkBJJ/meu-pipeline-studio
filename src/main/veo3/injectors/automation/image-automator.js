// image-automator.js - Image upload for Google Flow via clipboard paste / drag & drop
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Strategies: (1) Clipboard paste, (2) Drag on document.body, (3) Drag on Slate editor

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

  // Create DataTransfer - accepts array or single file
  function createDataTransfer(files) {
    const dt = new DataTransfer();
    if (Array.isArray(files)) {
      files.forEach(f => dt.items.add(f));
    } else {
      dt.items.add(files);
    }
    return dt;
  }

  // === UPLOAD STRATEGIES ===

  // Strategy 1: Clipboard paste (most reliable in Electron webviews)
  // Focuses the Slate editor, writes file to clipboard, dispatches paste event
  async function tryClipboardPaste(imageFile) {
    const { sleep } = window.veo3Timing;

    try {
      // Find the Slate editor (primary paste target)
      const editor = document.querySelector('[data-slate-editor="true"][contenteditable="true"]');
      if (!editor) {
        console.log('[ImageAutomator] Clipboard: no Slate editor found');
        return false;
      }

      editor.focus();
      await sleep(200);

      // Try native clipboard API first
      try {
        const clipboardItem = new ClipboardItem({
          [imageFile.type]: imageFile
        });
        await navigator.clipboard.write([clipboardItem]);
        await sleep(100);
      } catch (clipErr) {
        console.log('[ImageAutomator] Clipboard API write failed:', clipErr.message);
        // Continue anyway - we'll dispatch the paste event manually
      }

      // Dispatch paste event with the file in clipboardData
      const dt = createDataTransfer(imageFile);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      });

      editor.dispatchEvent(pasteEvent);
      await sleep(500);
      console.log('[ImageAutomator] Strategy 1 (clipboard paste): dispatched on Slate editor');
      return true;
    } catch (e) {
      console.log('[ImageAutomator] Strategy 1 (clipboard paste) failed:', e.message);
      return false;
    }
  }

  // Strategy 2: Drag & drop on document.body (wide target area)
  // User reports that dropping anywhere on the page works manually
  async function tryDragOnBody(imageFile) {
    const { sleep } = window.veo3Timing;

    try {
      const target = document.body;

      const dt = createDataTransfer([imageFile]);

      target.dispatchEvent(new DragEvent('dragenter', {
        bubbles: true, cancelable: true, dataTransfer: dt
      }));
      await sleep(100);

      target.dispatchEvent(new DragEvent('dragover', {
        bubbles: true, cancelable: true, dataTransfer: dt
      }));
      await sleep(100);

      target.dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer: dt
      }));
      await sleep(500);

      console.log('[ImageAutomator] Strategy 2 (drag on body): dispatched');
      return true;
    } catch (e) {
      console.log('[ImageAutomator] Strategy 2 (drag on body) failed:', e.message);
      return false;
    }
  }

  // Strategy 3: Drag & drop on Slate editor
  async function tryDragOnEditor(imageFile) {
    const { sleep } = window.veo3Timing;

    try {
      const editor = document.querySelector('[data-slate-editor="true"][contenteditable="true"]');
      if (!editor) {
        console.log('[ImageAutomator] Strategy 3: no Slate editor found');
        return false;
      }

      if (window.veo3Highlight) await window.veo3Highlight(editor);

      const events = [
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

      for (const event of events) {
        editor.dispatchEvent(event);
        await sleep(50);
      }

      console.log('[ImageAutomator] Strategy 3 (drag on Slate editor): dispatched');
      return true;
    } catch (e) {
      console.log('[ImageAutomator] Strategy 3 (drag on Slate editor) failed:', e.message);
      return false;
    }
  }

  // Strategy 4: Hidden file input (some React apps listen for this)
  async function tryFileInput(imageFile) {
    const { sleep } = window.veo3Timing;

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
      console.log('[ImageAutomator] Strategy 4 (file input): dispatched');
      return true;
    } catch (e) {
      console.log('[ImageAutomator] Strategy 4 (file input) failed:', e.message);
      return false;
    }
  }

  // Strategy 5: Drag on VEO3-specific drop areas (excluding sidebar)
  async function tryDropAreas(imageFile) {
    const { sleep } = window.veo3Timing;

    try {
      const mainArea = document.querySelector('main, [role="main"], .veo3-content, #main-content');
      const searchArea = mainArea || document.body;
      const dropAreas = Array.from(
        searchArea.querySelectorAll('[class*="drop"], [class*="upload"], [class*="file"], [data-testid*="drop"]')
      ).filter(el => {
        const inSidebar = el.closest('#veo3-automator-sidebar, .song-card, [id^="drop-zone-"]');
        return !inSidebar && el.offsetParent !== null;
      });

      if (dropAreas.length === 0) return false;

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

      console.log('[ImageAutomator] Strategy 5 (drop areas): dispatched on ' + dropAreas.length + ' areas');
      return true;
    } catch (e) {
      console.log('[ImageAutomator] Strategy 5 (drop areas) failed:', e.message);
      return false;
    }
  }

  // === MAIN UPLOAD FUNCTION ===
  // Tries all strategies in sequence with retry.
  // Returns true if any strategy dispatched events (actual upload confirmed by waitForImageUpload).

  async function simulateImageDragDrop(imageFile, _targetElement) {
    const { sleep } = window.veo3Timing;
    if (!imageFile) {
      console.warn('[ImageAutomator] Missing image file');
      return false;
    }

    console.log('[ImageAutomator] Uploading:', imageFile.name, '(' + Math.round(imageFile.size / 1024) + 'KB)');

    const MAX_ATTEMPTS = 2;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        console.log('[ImageAutomator] Retry attempt ' + attempt + '/' + MAX_ATTEMPTS);
        await sleep(2000);
      }

      // Try all strategies in order of reliability
      const strategies = [
        tryClipboardPaste,
        tryDragOnBody,
        tryDragOnEditor,
        tryFileInput,
        tryDropAreas
      ];

      for (const strategy of strategies) {
        const dispatched = await strategy(imageFile);
        if (dispatched) {
          await sleep(500);
          console.log('[ImageAutomator] Upload events dispatched for:', imageFile.name);
          return true;
        }
      }
    }

    console.error('[ImageAutomator] All upload strategies failed after ' + MAX_ATTEMPTS + ' attempts for:', imageFile.name);
    return false;
  }

  // Batch drag & drop - all files at once in a single DataTransfer on document.body
  async function batchDragDrop(files, _targetElement) {
    const { sleep } = window.veo3Timing;
    if (!files || files.length === 0) {
      console.warn('[ImageAutomator] batchDragDrop: no files provided');
      return false;
    }

    console.log('[ImageAutomator] Batch upload: ' + files.length + ' files');

    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);

    document.body.dispatchEvent(new DragEvent('dragenter', {
      bubbles: true, cancelable: true, dataTransfer: dt
    }));
    await sleep(150);

    document.body.dispatchEvent(new DragEvent('dragover', {
      bubbles: true, cancelable: true, dataTransfer: dt
    }));
    await sleep(150);

    document.body.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt
    }));
    await sleep(500);

    console.log('[ImageAutomator] Batch drop dispatched: ' + files.length + ' files');
    return true;
  }

  // === CROP DIALOG CONFIRMATION ===

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
      if (window.veo3Selectors) {
        const { findButtonByLabel } = window.veo3Selectors;
        const fallback = findButtonByLabel('done') || findButtonByLabel('confirm') || findButtonByLabel('apply');
        if (fallback) {
          if (window.veo3RobustClick) await window.veo3RobustClick(fallback);
          else fallback.click();
          await sleep(800);
          console.log('[ImageAutomator] Crop confirmed (label fallback)');
          return true;
        }
      }

      await sleep(100);
    }

    console.log('[ImageAutomator] No crop dialog found (might not be needed)');
    return false;
  }

  // === UPLOAD COMPLETION DETECTION ===
  // Checks signals for upload completion with FIXED false-positive protection.
  // Signal 3 now EXCLUDES the "+" gallery button (which always has data-state="closed")
  // and the settings button (which also has data-state="closed").
  // Requires either a STRONG signal or progress-then-completion pattern.

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

      // Signal 3: button[data-state="closed"] that is NOT the "+" or settings button
      const closedBtns = document.querySelectorAll('button[data-state="closed"]');
      let validClosedBtn = null;
      for (const btn of closedBtns) {
        if (btn.getAttribute('aria-haspopup') === 'dialog') continue; // Skip "+" button
        if (btn.getAttribute('aria-haspopup') === 'menu') continue;   // Skip settings button
        if (btn.offsetParent === null) continue;
        validClosedBtn = btn;
        break;
      }

      // Signal 4: Close icon in button (image loaded, can be removed)
      let closeIconBtn = null;
      const btnIcons = document.querySelectorAll('button i.google-symbols, button i.material-icons');
      for (const icon of btnIcons) {
        if (icon.textContent.trim() === 'close') {
          const parentBtn = icon.closest('button');
          if (parentBtn && parentBtn.offsetParent !== null) {
            closeIconBtn = parentBtn;
            break;
          }
        }
      }

      // Signal 5: "Primeiro frame" / "First frame" text appeared
      const frameText = Array.from(document.querySelectorAll('span')).find(span =>
        span.textContent.includes('Primeiro frame') || span.textContent.includes('First frame')
      );

      // Signal 6: Reference image cards
      const refCards = document.querySelectorAll(
        window.veo3Selectors?.referenceCards ||
        '.reference-image-card, [class*="reference"] img, [class*="ingredient"] img'
      );

      // Only accept completion if we saw progress first OR a strong signal exists
      // This prevents false positives from pre-existing UI elements
      const hasStrongSignal = frameText || refCards.length > 0;
      const hasProgressThenClosed = foundProgress && (validClosedBtn || closeIconBtn);

      if (hasStrongSignal || hasProgressThenClosed) {
        console.log('[ImageAutomator] Upload complete! Stabilizing...');
        await sleep(800);
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
