// content-bridge.js - Main automation orchestrator for Google Flow
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Receives commands from Electron sidepanel via window.postMessage
// Reports progress back via console.log(JSON) -> Electron console-message event

(function () {
  if (window.__veo3_bridge_loaded) return;
  window.__veo3_bridge_loaded = true;

  // === CONSTANTS ===

  const BATCH_SIZE = 4;

  // === STATE ===

  const automationState = {
    running: false,
    paused: false,
    currentIndex: 0,
    startedAt: null
  };

  let commandQueue = [];

  // === COMMUNICATION ===

  function notifySidepanel(action, data = {}) {
    window.veo3Debug?.debug('MSG_SEND', 'Notify: ' + action, data);
    console.log(JSON.stringify({
      type: 'CONTENT_TO_SIDEPANEL',
      action,
      data
    }));
  }

  // === MESSAGE LISTENER ===

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'SIDEPANEL_TO_CONTENT') return;
    const { action, data } = event.data;
    handleAction(action, data);
  });

  function handleAction(action, data) {
    window.veo3Debug?.debug('MSG_RECV', 'Action: ' + action, data);
    switch (action) {
      case 'START_AUTOMATION':
        startAutomation(data);
        break;
      case 'STOP_AUTOMATION':
        stopAutomation();
        break;
      case 'TOGGLE_PAUSE':
        togglePause();
        break;
      case 'MAP_MEDIA_LIBRARY':
        mapMediaLibrary();
        break;
      case 'APPLY_SETTINGS':
        applySettings(data);
        break;
      default:
        window.veo3Debug?.warn('BRIDGE', 'Unknown action: ' + action);
        console.log('[ContentBridge] Unknown action:', action);
    }
  }

  // === AUTOMATION CONTROL ===

  async function startAutomation(data) {
    if (automationState.running) {
      console.warn('[ContentBridge] Automation already running');
      return;
    }

    commandQueue = data.commands || [];
    const allCharacterImages = data.allCharacterImages || [];
    console.log('[INIT] START_AUTOMATION received: ' + commandQueue.length + ' commands, ' + allCharacterImages.length + ' character images');
    console.log('[INIT] Modes: ' + commandQueue.map(c => c.mode).join(', '));

    if (commandQueue.length === 0) {
      console.log('[INIT] ERROR: No commands to process');
      notifySidepanel('AUTOMATION_ERROR', { message: 'No commands to process' });
      return;
    }

    const { sleep, TIMING } = window.veo3Timing;

    automationState.running = true;
    automationState.paused = false;
    automationState.currentIndex = 0;
    automationState.startedAt = Date.now();

    notifySidepanel('AUTOMATION_STARTED', { total: commandQueue.length });

    // Wait for Google Flow to fully load (Slate editor must exist)
    console.log('[INIT] Waiting for prompt field...');
    const promptField = await window.veo3Timing.waitForAnyElement([
      '[data-slate-editor="true"][contenteditable="true"]',
      '#PINHOLE_TEXT_AREA_ELEMENT_ID'
    ], 15000);
    if (!promptField) {
      console.log('[INIT] ERROR: No prompt field found - page may not be loaded');
      notifySidepanel('AUTOMATION_ERROR', { message: 'Google Flow page not ready (no prompt field found)' });
      automationState.running = false;
      return;
    }
    console.log('[INIT] Page ready: ' + promptField.tagName + ' found');

    // Phase 1: Pre-upload ALL character images FIRST (before any settings)
    if (automationState.running) {
      const preUploadResults = await preUploadCharacterImages(allCharacterImages, commandQueue);

      // Update command queue with gallery names from pre-upload
      if (preUploadResults.size > 0) {
        for (const cmd of commandQueue) {
          if (!cmd.characterImages) continue;
          for (const img of cmd.characterImages) {
            const galleryName = preUploadResults.get(img.characterId);
            if (galleryName) {
              img.galleryItemName = galleryName;
            }
          }
        }
        console.log('[PRE_UPLOAD] Gallery names mapped for ' + preUploadResults.size + ' characters');
      }
    }

    if (!automationState.running) {
      return;
    }

    // Phase 2: Apply fixed settings (Landscape, x1) - AFTER upload
    await applyFixedSettings();
    await sleep(TIMING.STANDARD);

    // Phase 3: Process prompts in batches of BATCH_SIZE
    const totalBatches = Math.ceil(commandQueue.length / BATCH_SIZE);
    console.log('[BATCH] Starting prompt processing: ' + commandQueue.length + ' commands in ' + totalBatches + ' batches');

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      if (!automationState.running) break;

      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, commandQueue.length);
      const batchCommands = commandQueue.slice(batchStart, batchEnd);

      console.log('[BATCH ' + (batchIndex + 1) + '/' + totalBatches + '] Commands ' + (batchStart + 1) + '-' + batchEnd);

      // Process commands within this batch
      for (let i = 0; i < batchCommands.length; i++) {
        if (!automationState.running) break;

        // Handle pause
        while (automationState.paused) {
          await sleep(500);
          if (!automationState.running) break;
        }
        if (!automationState.running) break;

        const globalIndex = batchStart + i;
        automationState.currentIndex = globalIndex;
        const cmd = batchCommands[i];

        notifySidepanel('AUTOMATION_PROGRESS', {
          current: globalIndex,
          total: commandQueue.length,
          elapsed: Date.now() - automationState.startedAt,
          commandId: cmd.id,
          batch: batchIndex + 1,
          totalBatches
        });

        try {
          // Notify start of processing (not "submitted" - that's misleading)
          notifySidepanel('PROMPT_PROCESSING', { commandId: cmd.id, index: globalIndex });

          const result = await processCommand(cmd, globalIndex);

          if (result?.skipped) {
            notifySidepanel('PROMPT_SKIPPED', {
              commandId: cmd.id,
              index: globalIndex,
              reason: result.reason
            });
          } else {
            notifySidepanel('PROMPT_COMPLETED', { commandId: cmd.id, index: globalIndex });
          }
        } catch (err) {
          console.error('[FLOW ' + (globalIndex + 1) + '/' + commandQueue.length + '] ERROR: ' + err.message);
          notifySidepanel('PROMPT_FAILED', {
            commandId: cmd.id,
            index: globalIndex,
            error: err.message || String(err)
          });
        }

        // Delay between commands within the same batch
        if (i < batchCommands.length - 1) {
          await sleep(TIMING.BETWEEN_COMMANDS);
        }
      }

      // Pause between batches (rate limit protection)
      if (batchIndex < totalBatches - 1 && automationState.running) {
        const currentMode = detectCurrentMode();
        const pauseMs = (currentMode === 'imagem')
          ? TIMING.BATCH_PAUSE_IMAGE
          : TIMING.BATCH_PAUSE_VIDEO;
        const pauseSec = Math.round(pauseMs / 1000);

        console.log('[BATCH ' + (batchIndex + 1) + '/' + totalBatches + '] Done. Pausing ' + pauseSec + 's (' + currentMode + ' mode)...');
        notifySidepanel('BATCH_PAUSE', {
          batch: batchIndex + 1,
          totalBatches,
          pauseSeconds: pauseSec,
          mode: currentMode
        });

        // Countdown with pause check
        const pauseStart = Date.now();
        while (Date.now() - pauseStart < pauseMs) {
          if (!automationState.running) break;
          while (automationState.paused) {
            await sleep(500);
            if (!automationState.running) break;
          }
          await sleep(1000);

          const remaining = Math.max(0, Math.round((pauseMs - (Date.now() - pauseStart)) / 1000));
          if (remaining > 0 && remaining % 10 === 0) {
            console.log('[BATCH PAUSE] ' + remaining + 's remaining...');
            notifySidepanel('BATCH_PAUSE_UPDATE', {
              remainingSeconds: remaining,
              batch: batchIndex + 1,
              totalBatches
            });
          }
        }
      }
    }

    automationState.running = false;
    const totalElapsed = Math.round((Date.now() - automationState.startedAt) / 1000);
    console.log('[DONE] Automation complete: ' + commandQueue.length + ' commands in ' + totalElapsed + 's');
    notifySidepanel('AUTOMATION_COMPLETE', {
      processed: commandQueue.length,
      elapsed: Date.now() - automationState.startedAt,
      batches: totalBatches
    });
  }

  function stopAutomation() {
    automationState.running = false;
    automationState.paused = false;
    notifySidepanel('AUTOMATION_STOPPED', {});
    console.log('[STOP] Automation stopped');
  }

  function togglePause() {
    if (!automationState.running) return;

    automationState.paused = !automationState.paused;

    if (automationState.paused) {
      notifySidepanel('AUTOMATION_PAUSED', {});
      console.log('[PAUSE] Automation paused');
    } else {
      notifySidepanel('AUTOMATION_RESUMED', {});
      console.log('[RESUME] Automation resumed');
    }
  }

  // === COMMAND PROCESSING ===
  // Each command goes through 4 steps: mode switch → gallery select → fill prompt → submit

  async function processCommand(cmd, globalIndex) {
    const { sleep, TIMING } = window.veo3Timing;
    const total = commandQueue.length;
    const tag = '[FLOW ' + (globalIndex + 1) + '/' + total + ']';

    console.log(tag + ' === Processing: "' + (cmd.prompt?.substring(0, 60) || '') + '..." ===');
    console.log(tag + ' Mode: ' + cmd.mode + ' | Characters: ' + (cmd.characterImages?.length || 0));

    // Step 1/4: Mode switch
    console.log(tag + ' Step 1/4: Switching mode to "' + cmd.mode + '"...');
    const modeOk = await ensureModeViaConfigMenu(cmd.mode);
    if (!modeOk) {
      console.log(tag + ' Step 1/4: Mode switch not confirmed, proceeding anyway');
    } else {
      console.log(tag + ' Step 1/4: Mode OK');
    }

    // Step 2/4: Gallery selection (if command has character images)
    if (cmd.characterImages && cmd.characterImages.length > 0) {
      console.log(tag + ' Step 2/4: Selecting ' + cmd.characterImages.length + ' character(s) from gallery...');
      await selectCharactersFromGallery(cmd.characterImages, globalIndex);
    } else {
      console.log(tag + ' Step 2/4: No characters (text-only prompt)');
    }

    // Step 3/4: Fill prompt text in Slate editor
    console.log(tag + ' Step 3/4: Filling prompt (' + cmd.prompt.length + ' chars)...');
    await window.veo3Timing.fillSlateEditor(cmd.prompt);
    await sleep(TIMING.AFTER_FILL);

    // Step 4/4: Submit with retry chain
    console.log(tag + ' Step 4/4: Submitting...');
    const submitted = await window.veo3Timing.submitWithRetry();
    if (!submitted) {
      console.log(tag + ' === FAILED (all submission strategies failed) ===');
      throw new Error('All submission strategies failed');
    }

    console.log(tag + ' === DONE ===');
    return { skipped: false };
  }

  // === CHARACTER SELECTION FROM GALLERY ===
  // For each character in the command, click "+" to open gallery, search by name, click to select

  async function selectCharactersFromGallery(characterImages, promptIndex) {
    const { sleep, TIMING } = window.veo3Timing;
    const total = commandQueue.length;
    const tag = '[FLOW ' + (promptIndex + 1) + '/' + total + ']';

    for (const charImg of characterImages) {
      if (!automationState.running) break;

      // Use galleryItemName (set by pre-upload from original filename) or fall back to character name
      const searchName = charImg.galleryItemName || charImg.name || charImg.characterId;
      if (!searchName) {
        console.log(tag + '   > Gallery: no name to search, skipping');
        continue;
      }

      console.log(tag + '   > Gallery: clicking "+", searching "' + searchName + '"...');

      const selected = await window.veo3GalleryMapper.selectMediaByName(searchName);
      if (selected) {
        console.log(tag + '   > Gallery: match found and selected');
      } else {
        console.log(tag + '   > Gallery: "' + searchName + '" NOT FOUND in gallery');
      }

      await sleep(TIMING.MEDIUM);
    }
  }

  // === MODE SWITCHING VIA CONFIG MENU ===
  // IMPORTANT: The settings button is a Radix UI toggle. robustClick() does .click() + mousedown/mouseup/click
  // which effectively double-clicks, opening then immediately closing the menu.
  // We MUST use simple .click() for this button.
  //
  // Also: the tabs (Video/Image) are INSIDE the dropdown, invisible when closed.
  // So we detect the current mode from the BUTTON TEXT (e.g. "Video crop_16_9 x1" = video mode)
  // and only open the menu when we need to actually SWITCH modes.

  async function ensureModeViaConfigMenu(targetMode) {
    const { sleep, TIMING } = window.veo3Timing;

    // Determine target media type
    let targetMedia = 'VIDEO'; // 'texto' and 'elementos' both use Video
    if (targetMode === 'imagem') {
      targetMedia = 'IMAGE';
    }

    // Detect current mode from settings button TEXT (no need to open menu)
    const settingsBtn = window.veo3Selectors.settingsButton();
    if (!settingsBtn) {
      console.log('[MODE] Settings button not found, cannot detect or switch mode');
      return false;
    }

    const btnText = settingsBtn.textContent.trim().toLowerCase();
    const currentIsImage = btnText.includes('image') || btnText.includes('imagem');
    const currentIsVideo = btnText.includes('video') || btnText.includes('vídeo');

    // Check if already in correct mode (skip opening menu entirely)
    if (targetMedia === 'VIDEO' && currentIsVideo && targetMode !== 'elementos') {
      console.log('[MODE] Already in Video mode, no switch needed');
      return true;
    }
    if (targetMedia === 'IMAGE' && currentIsImage) {
      console.log('[MODE] Already in Image mode, no switch needed');
      return true;
    }

    // Need to open config menu and switch tabs
    // Use radixClick (PointerEvent) - Radix UI listens to onPointerDown, not onClick
    console.log('[MODE] Switching from ' + (currentIsImage ? 'Image' : 'Video') + ' to ' + targetMedia + '...');

    let menuOpened = false;
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Radix UI DropdownMenu trigger needs pointerdown event
      await window.veo3RadixClick(settingsBtn);
      await sleep(TIMING.STANDARD);

      const menuCheck = document.querySelector('[role="tab"][aria-controls*="-content-VIDEO"]') ||
                        document.querySelector('[role="tab"][aria-controls*="-content-IMAGE"]');
      if (menuCheck) {
        menuOpened = true;
        break;
      }

      if (attempt < MAX_RETRIES) {
        console.log('[MODE] Menu did not open (attempt ' + attempt + '/' + MAX_RETRIES + '), retrying...');
        // Escape to clear any half-state, then wait before retry
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(TIMING.MEDIUM);
      }
    }

    if (!menuOpened) {
      console.log('[MODE] Config menu did not open after ' + MAX_RETRIES + ' attempts, skipping');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(TIMING.SHORT);
      return false;
    }

    // Click media tab (Video or Image) - simple click for tabs too
    const mediaTabSelector = targetMedia === 'IMAGE'
      ? window.veo3Selectors.tabImage
      : window.veo3Selectors.tabVideo;
    const mediaTabTarget = document.querySelector(mediaTabSelector);

    if (mediaTabTarget) {
      mediaTabTarget.click();
      if (window.veo3Highlight) window.veo3Highlight(mediaTabTarget);
      await sleep(TIMING.SHORT);
    } else {
      console.log('[MODE] ' + targetMedia + ' tab not found in menu');
    }

    // Click sub-tab if needed (Ingredients for elementos mode)
    if (targetMode === 'elementos') {
      await sleep(TIMING.SHORT);
      const subTabEl = document.querySelector(window.veo3Selectors.tabIngredients);

      if (subTabEl) {
        subTabEl.click();
        if (window.veo3Highlight) window.veo3Highlight(subTabEl);
        await sleep(TIMING.SHORT);
      } else {
        console.log('[MODE] Ingredients sub-tab not found');
      }
    }

    // Close menu
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(TIMING.MEDIUM);

    console.log('[MODE] Switched to ' + targetMedia);
    return true;
  }

  // Detect current mode from config button text (for batch pause timing)
  function detectCurrentMode() {
    const settingsBtn = window.veo3Selectors.settingsButton();
    if (settingsBtn) {
      const text = settingsBtn.textContent.trim().toLowerCase();
      if (text.includes('image') || text.includes('imagem')) return 'imagem';
    }
    return 'texto';
  }

  // === PRE-UPLOAD CHARACTER IMAGES ===
  // Uploads ALL character images to Google Flow's gallery.
  // Receives the full list from the sidepanel (all characters from Stage 4 folder).
  // Falls back to extracting from commands if allCharacterImages is empty.

  async function preUploadCharacterImages(allCharacterImages, commands) {
    const { sleep, TIMING } = window.veo3Timing;
    const results = new Map(); // characterId -> galleryItemName

    // Build file entries from the full character images list
    const fileEntries = [];

    if (allCharacterImages && allCharacterImages.length > 0) {
      // Image data is pre-loaded in window.__veo3_imageCache by the sidepanel
      // (sent individually to avoid 8MB+ payload size issues with executeJavaScript)
      const imgCache = window.__veo3_imageCache || {};
      const cacheSize = Object.keys(imgCache).length;
      console.log('[PRE_UPLOAD] Image cache: ' + cacheSize + ' entries');
      console.log('[PRE_UPLOAD] Received ' + allCharacterImages.length + ' character images from project');

      // Deduplicate by fileName to avoid uploading the same image file twice
      const seenFileNames = new Set();

      for (const img of allCharacterImages) {
        // Get dataUrl from pre-loaded cache (NOT from payload - payload is metadata only)
        const cached = imgCache[img.characterId];
        const dataUrl = cached?.dataUrl || img.dataUrl;
        const fileName = cached?.fileName || img.fileName;

        if (!dataUrl || !fileName) {
          console.log('[PRE_UPLOAD] Skipping (no data): ' + (img.name || img.characterId));
          continue;
        }

        // Skip duplicate file names (same image used by multiple characters)
        if (seenFileNames.has(fileName)) {
          console.log('[PRE_UPLOAD] Skipping duplicate: ' + fileName);
          const galleryName = fileName.replace(/\.\w+$/, '');
          results.set(img.characterId, galleryName);
          continue;
        }
        seenFileNames.add(fileName);

        const file = window.dataUrlToFile(dataUrl, fileName);
        if (!file) {
          console.log('[PRE_UPLOAD] dataUrlToFile failed for: ' + (img.name || fileName));
          continue;
        }
        fileEntries.push({
          charId: img.characterId,
          file,
          charData: { name: img.name, fileName, dataUrl }
        });
      }

      // Clean up image cache after building file entries
      delete window.__veo3_imageCache;
    } else {
      // Fallback: extract unique characters from commands (old behavior)
      console.log('[PRE_UPLOAD] No allCharacterImages provided, extracting from commands...');
      const uniqueChars = new Map();
      for (const cmd of commands) {
        if (!cmd.characterImages) continue;
        for (const img of cmd.characterImages) {
          if (img.image?.dataUrl && !uniqueChars.has(img.characterId)) {
            uniqueChars.set(img.characterId, {
              name: img.name,
              dataUrl: img.image.dataUrl,
              fileName: img.image.name || (img.name + '.png')
            });
          }
        }
      }
      for (const [charId, charData] of uniqueChars) {
        const file = window.dataUrlToFile(charData.dataUrl, charData.fileName);
        if (file) {
          fileEntries.push({ charId, file, charData });
        }
      }
    }

    if (fileEntries.length === 0) {
      console.log('[PRE_UPLOAD] No character images to upload');
      return results;
    }

    console.log('[PRE_UPLOAD] ' + fileEntries.length + ' character image(s) to upload');
    for (const { charData } of fileEntries) {
      console.log('[PRE_UPLOAD] - ' + charData.fileName);
    }
    notifySidepanel('PRE_UPLOAD_START', { count: fileEntries.length });

    // Upload ALL files via batch clipboard paste.
    // Uses Object.defineProperty to force clipboardData (Chromium ignores it in constructor).
    // If batch fails, falls back to individual pastes.
    try {
      const allFiles = fileEntries.map(f => f.file);
      const fileNames = allFiles.map(f => f.name).join(', ');
      console.log('[PRE_UPLOAD] Batch paste: ' + fileNames);

      // Try batch upload (all files at once)
      const dispatched = await window.batchDragDrop(allFiles);

      if (dispatched) {
        await sleep(2000);

        // Wait for crop dialogs (one per image) and confirm each
        console.log('[PRE_UPLOAD] Waiting for crop dialogs...');
        for (let i = 0; i < fileEntries.length; i++) {
          const confirmed = await window.waitAndConfirmCrop(15000);
          if (confirmed) {
            console.log('[PRE_UPLOAD] Crop ' + (i + 1) + '/' + fileEntries.length + ' confirmed');
          } else {
            console.log('[PRE_UPLOAD] Crop ' + (i + 1) + '/' + fileEntries.length + ' not found (may not be needed)');
            break;
          }
          await sleep(500);
        }

        // Wait for all uploads to complete
        console.log('[PRE_UPLOAD] Waiting for uploads to complete...');
        const uploadTimeout = Math.max(45000, fileEntries.length * 15000);
        await window.waitForImageUpload(uploadTimeout);
      } else {
        console.log('[PRE_UPLOAD] Batch upload failed, trying individual pastes...');

        // Fallback: individual paste per file
        for (let i = 0; i < fileEntries.length; i++) {
          if (!automationState.running) break;
          const { file, charData } = fileEntries[i];
          console.log('[PRE_UPLOAD] Individual paste ' + (i + 1) + '/' + fileEntries.length + ': ' + charData.fileName);

          await window.simulateImageDragDrop(file);
          await sleep(1000);

          const confirmed = await window.waitAndConfirmCrop(15000);
          if (confirmed) {
            console.log('[PRE_UPLOAD] Crop ' + (i + 1) + '/' + fileEntries.length + ' confirmed');
          }

          if (i < fileEntries.length - 1) await sleep(1500);
        }

        await window.waitForImageUpload(Math.max(30000, fileEntries.length * 12000));
      }

      // Map gallery names for all entries (use original filename without extension)
      let uploadedCount = 0;
      for (const { charId, charData } of fileEntries) {
        const galleryName = charData.fileName.replace(/\.\w+$/, '');
        results.set(charId, galleryName);
        uploadedCount++;
      }

      console.log('[PRE_UPLOAD] Upload complete: ' + uploadedCount + '/' + fileEntries.length + ' gallery names mapped');
      notifySidepanel('PRE_UPLOAD_COMPLETE', {
        uploaded: uploadedCount,
        total: fileEntries.length
      });
    } catch (err) {
      console.log('[PRE_UPLOAD] Error during upload: ' + err.message);
      for (const { charId, charData } of fileEntries) {
        const galleryName = charData.fileName.replace(/\.\w+$/, '');
        results.set(charId, galleryName);
      }
      notifySidepanel('PRE_UPLOAD_COMPLETE', { uploaded: 0, total: fileEntries.length });
    }

    return results;
  }

  // === SETTINGS ===

  async function applyFixedSettings() {
    const { sleep, TIMING } = window.veo3Timing;

    const settingsBtn = window.veo3Selectors.settingsButton();
    if (!settingsBtn) {
      console.log('[SETTINGS] Button not found (no button has both aspect icon + count), skipping');
      return;
    }

    console.log('[SETTINGS] Applying fixed settings (Landscape, x1)...');

    // IMPORTANT: Use radixClick (PointerEvent) for Radix UI DropdownMenu trigger.
    // Radix UI listens to onPointerDown, NOT onClick or onMouseDown.
    // - .click() alone does NOT dispatch pointerdown → menu won't open
    // - robustClick() dispatches mousedown (not pointerdown) + double-clicks → toggles open/closed
    let menuOpened = false;
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log('[SETTINGS] Attempt ' + attempt + '/' + MAX_RETRIES + ': clicking settings button (pointerdown)...');

      await window.veo3RadixClick(settingsBtn);
      await sleep(TIMING.STANDARD * attempt); // 1s, 2s, 3s

      const menuCheck = document.querySelector('[role="tab"][aria-controls*="LANDSCAPE"]');
      if (menuCheck) {
        menuOpened = true;
        console.log('[SETTINGS] Menu opened');
        break;
      }

      if (attempt < MAX_RETRIES) {
        console.log('[SETTINGS] Menu did not open, retrying...');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(TIMING.MEDIUM);
      }
    }

    if (!menuOpened) {
      console.log('[SETTINGS] Menu did not open after ' + MAX_RETRIES + ' attempts, skipping settings');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(TIMING.SHORT);
      return;
    }

    // Click Landscape tab (simple click for tabs)
    const landscapeTab = document.querySelector(window.veo3Selectors.tabLandscape);
    if (landscapeTab) {
      landscapeTab.click();
      if (window.veo3Highlight) window.veo3Highlight(landscapeTab);
      await sleep(TIMING.SHORT);
      console.log('[SETTINGS] Clicked Landscape tab');
    }

    // Click x1 tab
    const count1Tab = document.querySelector(window.veo3Selectors.tabCount(1));
    if (count1Tab) {
      count1Tab.click();
      if (window.veo3Highlight) window.veo3Highlight(count1Tab);
      await sleep(TIMING.SHORT);
      console.log('[SETTINGS] Clicked x1 tab');
    }

    // Close settings
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(TIMING.MEDIUM);

    console.log('[SETTINGS] Settings applied. Closing menu.');
  }

  async function applySettings(data) {
    console.log('[SETTINGS] Apply custom settings:', data);
  }

  // === MEDIA LIBRARY MAPPING ===

  async function mapMediaLibrary() {
    try {
      const items = await window.veo3GalleryMapper.mapGallery();
      notifySidepanel('MEDIA_LIBRARY_MAPPED', {
        items: items.map(item => ({ name: item.name, index: item.index }))
      });
    } catch (err) {
      notifySidepanel('AUTOMATION_ERROR', {
        message: 'Media library mapping failed: ' + err.message
      });
    }
  }

  // === INITIALIZATION ===

  console.log('[Flow] Content bridge loaded - ready for commands');
  notifySidepanel('PAGE_READY', { url: window.location.href });
})();
