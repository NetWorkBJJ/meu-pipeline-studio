// image-automator.js - Image upload for Google Flow via drag & drop / clipboard paste
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Primary strategy: drag & drop on document.body (clipboard fails in Electron webview)

(function () {
  if (window.__veo3_imgauto_loaded) return;
  window.__veo3_imgauto_loaded = true;

  const IMAGE_CONFIG = {
    supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
    maxFileSize: 10 * 1024 * 1024
  };

  class ImageManager {
    constructor() {
      this.images = new Map();
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
  // Order: clipboard paste (primary) → drag body → drag editor → file input → drop areas
  //
  // CRITICAL: In Chromium, ClipboardEvent's clipboardData is READ-ONLY.
  // new ClipboardEvent('paste', { clipboardData: dt }) IGNORES the dt parameter.
  // We MUST use Object.defineProperty to override clipboardData on the event.
  // Without this, Google Flow receives a paste event with EMPTY clipboardData.

  // Strategy 1 (PRIMARY): Clipboard paste with Object.defineProperty workaround
  async function tryClipboardPaste(files) {
    const { sleep } = window.veo3Timing;

    try {
      const fileArr = Array.isArray(files) ? files : [files];
      const dt = createDataTransfer(fileArr);

      // Create paste event and FORCE clipboardData via defineProperty
      // (Chromium ignores clipboardData in ClipboardEvent constructor)
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true
      });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: dt,
        writable: false,
        configurable: true
      });

      // Try dispatching on multiple targets (Google Flow may listen on any of these)
      // Target 1: Slate editor (most likely for content paste)
      const editor = document.querySelector('[data-slate-editor="true"][contenteditable="true"]');
      if (editor) {
        editor.focus();
        await sleep(200);
        const handled = editor.dispatchEvent(pasteEvent);
        await sleep(500);

        // Check if something happened (crop dialog, progress indicator)
        const hasProgress = checkForUploadProgress();
        if (hasProgress) {
          console.log('[ImageAutomator] Strategy 1 (clipboard paste on editor): upload detected! (' + fileArr.length + ' file(s))');
          return true;
        }
        console.log('[ImageAutomator] Strategy 1a (paste on editor): dispatched, handled=' + !handled + ' (' + fileArr.length + ' file(s))');
      }

      // Target 2: document (many apps listen at document level)
      const pasteEvent2 = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent2, 'clipboardData', {
        value: createDataTransfer(fileArr),
        writable: false,
        configurable: true
      });
      document.dispatchEvent(pasteEvent2);
      await sleep(500);

      const hasProgress2 = checkForUploadProgress();
      if (hasProgress2) {
        console.log('[ImageAutomator] Strategy 1b (paste on document): upload detected! (' + fileArr.length + ' file(s))');
        return true;
      }
      console.log('[ImageAutomator] Strategy 1b (paste on document): dispatched (' + fileArr.length + ' file(s))');

      // Return true optimistically - progress detection may be delayed
      return true;
    } catch (e) {
      console.log('[ImageAutomator] Strategy 1 (clipboard paste) failed:', e.message);
      return false;
    }
  }

  // Strategy 2: Drag & drop on document.body
  async function tryDragOnBody(imageFile) {
    const { sleep } = window.veo3Timing;

    try {
      const target = document.body;
      const dt = createDataTransfer([imageFile]);

      // Center of viewport for realistic coordinates
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const eventBase = {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientX: cx,
        clientY: cy,
        screenX: cx,
        screenY: cy
      };

      target.dispatchEvent(new DragEvent('dragenter', eventBase));
      await sleep(200);

      target.dispatchEvent(new DragEvent('dragover', eventBase));
      await sleep(200);

      target.dispatchEvent(new DragEvent('drop', eventBase));
      await sleep(500);

      console.log('[ImageAutomator] Strategy 2 (drag on body): dispatched at center of viewport');
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

      const rect = editor.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const events = [
        new DragEvent('dragenter', {
          bubbles: true, cancelable: true, dataTransfer: createDataTransfer([imageFile]),
          clientX: cx, clientY: cy
        }),
        new DragEvent('dragover', {
          bubbles: true, cancelable: true, dataTransfer: createDataTransfer([imageFile]),
          clientX: cx, clientY: cy
        }),
        new DragEvent('drop', {
          bubbles: true, cancelable: true, dataTransfer: createDataTransfer([imageFile]),
          clientX: cx, clientY: cy
        })
      ];

      for (const event of events) {
        editor.dispatchEvent(event);
        await sleep(100);
      }

      console.log('[ImageAutomator] Strategy 3 (drag on Slate editor): dispatched');
      return true;
    } catch (e) {
      console.log('[ImageAutomator] Strategy 3 (drag on Slate editor) failed:', e.message);
      return false;
    }
  }

  // Strategy 4: Hidden file input
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

  // Strategy 5: Drag on VEO3-specific drop areas
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

  // === MAIN UPLOAD FUNCTION (single file) ===
  // Tries all strategies in sequence with retry.

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

      // Strategies in order: clipboard paste (proven to work) → drag → fallbacks
      const strategies = [
        (f) => tryClipboardPaste(f),  // Primary: paste event on Slate editor (works in webview)
        tryDragOnBody,                // Drag on body
        tryDragOnEditor,              // Drag on Slate editor
        tryFileInput,                 // Hidden input simulation
        tryDropAreas                  // App-specific drop zones
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

  // === BATCH UPLOAD (all files at once) ===
  // Primary: clipboard paste with all files in a single DataTransfer on Slate editor
  // Fallback 1: batch drag on body
  // Fallback 2: individual clipboard paste per file

  async function batchDragDrop(files, _targetElement) {
    const { sleep } = window.veo3Timing;
    if (!files || files.length === 0) {
      console.warn('[ImageAutomator] batchDragDrop: no files provided');
      return false;
    }

    const fileNames = files.map(f => f.name).join(', ');
    console.log('[PRE_UPLOAD] Batch upload: ' + fileNames);
    console.log('[PRE_UPLOAD] Total files: ' + files.length + ', total size: ' + Math.round(files.reduce((s, f) => s + f.size, 0) / 1024) + 'KB');

    // Strategy 1: Clipboard paste with ALL files at once (Object.defineProperty for clipboardData)
    // This is the primary and proven strategy - do NOT fall through to other strategies
    // as that causes the same files to be uploaded multiple times.
    console.log('[PRE_UPLOAD] Batch clipboard paste (' + files.length + ' files)...');
    const batchPasteOk = await tryClipboardPaste(files);
    if (batchPasteOk) {
      console.log('[PRE_UPLOAD] Batch paste dispatched successfully');
      return true;
    }

    // Fallback: Batch drag & drop on document.body (only if clipboard paste failed entirely)
    console.log('[PRE_UPLOAD] Clipboard paste failed, trying batch drag on document.body...');
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const eventBase = {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: cx, clientY: cy, screenX: cx, screenY: cy
    };

    document.body.dispatchEvent(new DragEvent('dragenter', eventBase));
    await sleep(200);
    document.body.dispatchEvent(new DragEvent('dragover', eventBase));
    await sleep(200);
    document.body.dispatchEvent(new DragEvent('drop', eventBase));
    await sleep(1000);

    console.log('[PRE_UPLOAD] Batch drag dispatched');
    return true;
  }

  // Helper: check for any upload progress indicators
  function checkForUploadProgress() {
    const icons = document.querySelectorAll('i.google-symbols, i.material-icons');
    for (const icon of icons) {
      const text = icon.textContent.trim();
      if (text === 'progress_activity' || text === 'crop') return true;
    }
    return false;
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
              console.log('[PRE_UPLOAD] Crop confirmed (exact class)');
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
          console.log('[PRE_UPLOAD] Crop confirmed (icon+text)');
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
          console.log('[PRE_UPLOAD] Crop confirmed (label fallback)');
          return true;
        }
      }

      await sleep(100);
    }

    console.log('[PRE_UPLOAD] No crop dialog found (might not be needed)');
    return false;
  }

  // === UPLOAD COMPLETION DETECTION ===
  // Checks signals for upload completion with false-positive protection.
  // Excludes "+" gallery button and settings button from signal 3.
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
            console.log('[PRE_UPLOAD] Upload in progress (progress_activity icon)...');
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
        console.log('[PRE_UPLOAD] Upload text detected');
        foundProgress = true;
      }

      // Signal 3: button[data-state="closed"] that is NOT the "+" or settings button
      const closedBtns = document.querySelectorAll('button[data-state="closed"]');
      let validClosedBtn = null;
      for (const btn of closedBtns) {
        if (btn.getAttribute('aria-haspopup') === 'dialog') continue;
        if (btn.getAttribute('aria-haspopup') === 'menu') continue;
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
      const hasStrongSignal = frameText || refCards.length > 0;
      const hasProgressThenClosed = foundProgress && (validClosedBtn || closeIconBtn);

      if (hasStrongSignal || hasProgressThenClosed) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log('[PRE_UPLOAD] Upload complete! (' + elapsed + 's)');
        await sleep(800);
        return true;
      }

      await sleep(300);
    }

    const elapsed = Math.round(timeout / 1000);
    console.warn('[PRE_UPLOAD] Upload wait timed out (' + elapsed + 's)');
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
