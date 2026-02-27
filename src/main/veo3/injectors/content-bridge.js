// content-bridge.js - Main automation orchestrator for Google Flow
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Receives commands from Electron sidepanel via window.postMessage
// Reports progress back via console.log(JSON) -> Electron console-message event

(function () {
  if (window.__veo3_bridge_loaded) return;
  window.__veo3_bridge_loaded = true;

  // === CONSTANTS ===

  const BATCH_SIZE = 10;
  const MAX_SKIP_RETRIES = 2;   // 3 total attempts (1 original + 2 retries)
  const SKIP_RETRY_DELAY = 3000; // 3s delay before retrying a skipped command

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

  // === CDP REQUEST/RESPONSE PROTOCOL ===
  // content-bridge cannot call IPC directly (runs inside webview context).
  // For CDP operations (fill prompt, click submit), it sends a request via console.log
  // -> Electron catches it in Stage5Veo3.tsx -> routes to cdp-core.ts via IPC
  // -> response comes back via postMessage.

  let cdpRequestCounter = 0;
  const pendingCdpRequests = new Map(); // requestId -> { resolve, reject, timer }

  function cdpRequest(operation, data, timeoutMs) {
    if (timeoutMs === undefined) timeoutMs = 15000;
    return new Promise(function (resolve, reject) {
      var requestId = 'cdp_' + (++cdpRequestCounter) + '_' + Date.now();

      var timer = setTimeout(function () {
        pendingCdpRequests.delete(requestId);
        reject(new Error('CDP request timeout (' + timeoutMs + 'ms): ' + operation));
      }, timeoutMs);

      pendingCdpRequests.set(requestId, { resolve: resolve, reject: reject, timer: timer });

      // Send request to renderer via console.log (caught by Veo3Browser console-message handler)
      console.log(JSON.stringify({
        type: 'CONTENT_TO_SIDEPANEL',
        action: 'CDP_REQUEST',
        data: Object.assign({ operation: operation, requestId: requestId }, data || {})
      }));
    });
  }

  function handleCdpResponse(data) {
    var requestId = data.requestId;
    var pending = pendingCdpRequests.get(requestId);
    if (!pending) {
      window.veo3Debug?.warn('BRIDGE', 'CDP response for unknown requestId: ' + requestId);
      return;
    }

    clearTimeout(pending.timer);
    pendingCdpRequests.delete(requestId);

    if (data.success) {
      pending.resolve({ success: true });
    } else {
      pending.reject(new Error(data.error || 'CDP operation failed'));
    }
  }

  // === CDP-BASED PROMPT FILL AND SUBMIT ===

  async function cdpFillPrompt(text) {
    console.log('[CDP_FILL] Requesting CDP fillPrompt (' + text.length + ' chars)...');
    try {
      await cdpRequest('fillPrompt', { text: text }, 20000);
      console.log('[CDP_FILL] CDP fillPrompt succeeded');
      return true;
    } catch (err) {
      console.log('[CDP_FILL] CDP fillPrompt FAILED: ' + err.message);
      return false;
    }
  }

  async function cdpClickSubmit() {
    console.log('[CDP_SUBMIT] Requesting CDP clickSubmit...');
    try {
      await cdpRequest('clickSubmit', {}, 15000);
      console.log('[CDP_SUBMIT] CDP clickSubmit succeeded');
      return true;
    } catch (err) {
      console.log('[CDP_SUBMIT] CDP clickSubmit FAILED: ' + err.message);
      return false;
    }
  }

  // === CDP-BASED GENERIC CLICK AND KEY PRESS ===
  // Generic helpers that use the same CDP_REQUEST/CDP_RESPONSE protocol
  // as cdpFillPrompt and cdpClickSubmit. These enable CDP for ALL interactions
  // (mode switching, gallery selection, Escape dismissals).

  async function cdpClickAt(x, y) {
    try {
      await cdpRequest('clickAt', { x: x, y: y }, 10000);
      return true;
    } catch (err) {
      console.log('[CDP_CLICK] FAILED at (' + x + ',' + y + '): ' + err.message);
      return false;
    }
  }

  async function cdpPressKey(key) {
    try {
      await cdpRequest('press', { key: key }, 10000);
      return true;
    } catch (err) {
      console.log('[CDP_PRESS] FAILED (' + key + '): ' + err.message);
      return false;
    }
  }

  // Click an element via CDP using its bounding rect.
  // The element is already found via DOM (querySelector/selectors.js),
  // so we just need its coordinates -- no CSS selector construction needed.
  async function cdpClickElementByRect(element) {
    if (!element) return false;
    var rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var cx = Math.round(rect.x + rect.width / 2);
    var cy = Math.round(rect.y + rect.height / 2);
    return await cdpClickAt(cx, cy);
  }

  // Dismiss overlays via CDP Escape (isTrusted: true)
  async function cdpDismiss() {
    return await cdpPressKey('Escape');
  }

  // Check if any dialog, menu, or overlay is currently open in the Google Flow UI.
  // Used to avoid unnecessary Escape presses that can cause unintended UI side-effects.
  function isOverlayOpen() {
    if (document.querySelector('[role="dialog"][id^="radix-"]')) return true;
    if (document.querySelector('[role="menu"][data-state="open"]')) return true;
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
    if (document.querySelector('[data-radix-popper-content-wrapper]')) return true;
    return false;
  }

  // Expose for other injectors (gallery-mapper.js uses Escape)
  window.__veo3_cdpPress = cdpPressKey;
  window.__veo3_cdpClickElement = cdpClickElementByRect;

  // === CDP CLICK OVERRIDES ===
  // Override the synthetic click functions with CDP-powered versions.
  // Gallery-mapper.js and other injectors call window.veo3RobustClick/veo3RadixClick
  // which are originally defined in click-feedback.js. By overriding them HERE
  // (content-bridge.js is injected LAST), all callers automatically get CDP clicks.
  // Fallback: if CDP click fails, call the original synthetic version.

  var _origRobustClick = window.veo3RobustClick;
  var _origRadixClick = window.veo3RadixClick;

  window.veo3RobustClick = async function cdpRobustClick(element, options) {
    if (!element) return false;
    if (window.veo3Highlight) window.veo3Highlight(element);

    var cdpOk = await cdpClickElementByRect(element);
    if (cdpOk) {
      if (options && options.sendEnter) {
        await window.veo3Timing.sleep(50);
        await cdpPressKey('Enter');
      }
      return true;
    }

    // Fallback to original synthetic click
    console.log('[CDP_OVERRIDE] robustClick CDP failed, falling back to synthetic');
    if (_origRobustClick) return await _origRobustClick(element, options);
    element.click();
    return true;
  };

  window.veo3RadixClick = async function cdpRadixClick(element) {
    if (!element) return false;
    if (window.veo3Highlight) window.veo3Highlight(element);

    var cdpOk = await cdpClickElementByRect(element);
    if (cdpOk) return true;

    // Fallback to original synthetic PointerEvent dispatch
    console.log('[CDP_OVERRIDE] radixClick CDP failed, falling back to synthetic');
    if (_origRadixClick) return await _origRadixClick(element);
    element.click();
    return true;
  };

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
      case 'CDP_RESPONSE':
        handleCdpResponse(data);
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

    window.__veo3_phase = 'INIT';
    window.veo3ClickLogger?.resetClickLog();

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
    window.__veo3_phase = 'PRE_UPLOAD';
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

    // Phase 1.5: Wait for uploads to be 100% done, then clear prompt area
    window.__veo3_phase = 'CLEAR_PROMPT';
    console.log('[INIT] Ensuring all uploads are 100% complete...');
    const uploadCheckTimeout = 15000; // 15s max (uploads are usually already done)
    const uploadCheckStart = Date.now();
    while (Date.now() - uploadCheckStart < uploadCheckTimeout) {
      const progressIcons = document.querySelectorAll('i.google-symbols, i.material-icons');
      let stillUploading = false;
      for (const icon of progressIcons) {
        if (icon.textContent.trim() === 'progress_activity') {
          stillUploading = true;
          break;
        }
      }
      if (!stillUploading) break;
      console.log('[INIT] Upload still in progress, waiting...');
      await sleep(TIMING.POLL_NORMAL); // 500ms instead of 2s
    }
    console.log('[INIT] All uploads complete (' + (Date.now() - uploadCheckStart) + 'ms), clearing prompt area...');

    // Click "Apagar comando" (close) button to clear residual state from upload
    // Google Flow is React - simple .click() may not trigger the handler, use robustClick
    const clearBtn = window.veo3Selectors.clearButton();
    if (clearBtn) {
      console.log('[INIT] Found clear button: "' + clearBtn.textContent.trim().substring(0, 40) + '"');
      await window.veo3RobustClick(clearBtn);
      await sleep(TIMING.SHORT);
      console.log('[INIT] Prompt area cleared');
    } else {
      console.log('[INIT] No clear button found (prompt may already be empty)');
    }

    // Phase 2: Settings (Landscape, x1, mode) are now applied per-command inside
    // ensureCreationMode() when the dropdown is already open for mode verification.
    // No separate init step needed - saves an extra dropdown open/close cycle.

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

          var result = await processCommand(cmd, globalIndex);
          var skipRetryCount = 0;

          // Retry loop: if command was skipped (gallery selection failure), retry the entire command
          // Gallery failures can be transient (overlay stuck, Virtuoso not rendered, browser state unstable)
          while (result?.skipped && skipRetryCount < MAX_SKIP_RETRIES && automationState.running) {
            skipRetryCount++;
            console.log('[RETRY_SKIP ' + (globalIndex + 1) + '/' + commandQueue.length + '] ' +
              'Attempt ' + (skipRetryCount + 1) + '/' + (MAX_SKIP_RETRIES + 1) +
              ' - Reason: ' + result.reason);

            // Notify sidepanel that we are retrying (UI shows orange "retrying" badge)
            notifySidepanel('PROMPT_RETRY', {
              commandId: cmd.id,
              index: globalIndex,
              attempt: skipRetryCount + 1,
              maxAttempts: MAX_SKIP_RETRIES + 1,
              reason: result.reason
            });

            // Pre-retry cleanup: dismiss overlays and clear prompt area
            if (isOverlayOpen()) {
              await cdpDismiss();
              await sleep(TIMING.SHORT);
            }
            var retryClearBtn = window.veo3Selectors.clearButton();
            if (retryClearBtn) {
              await window.veo3RobustClick(retryClearBtn);
              await sleep(TIMING.SHORT);
            }

            // Wait for browser/gallery state to stabilize
            await sleep(SKIP_RETRY_DELAY);

            // Respect pause/stop controls during retry wait
            while (automationState.paused) {
              await sleep(500);
              if (!automationState.running) break;
            }
            if (!automationState.running) break;

            // Re-attempt the full command (mode switch + gallery + fill + submit)
            result = await processCommand(cmd, globalIndex);
          }

          if (result?.skipped) {
            notifySidepanel('PROMPT_SKIPPED', {
              commandId: cmd.id,
              index: globalIndex,
              reason: result.reason,
              attempts: skipRetryCount + 1
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
        // Scan for failed tiles and auto-retry before starting countdown
        await scanAndRetryFailedTiles();

        const pauseMs = TIMING.BATCH_PAUSE;
        const pauseSec = Math.round(pauseMs / 1000);

        console.log('[BATCH ' + (batchIndex + 1) + '/' + totalBatches + '] Done. Pausing ' + pauseSec + 's...');
        notifySidepanel('BATCH_PAUSE', {
          batch: batchIndex + 1,
          totalBatches,
          pauseSeconds: pauseSec
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

    // Final scan: check for failed tiles after last batch (before marking complete)
    if (automationState.running) {
      console.log('[RETRY] Final scan after all batches...');
      await scanAndRetryFailedTiles();
    }

    automationState.running = false;
    window.__veo3_phase = 'DONE';
    window.veo3ClickLogger?.printClickSummary();
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

    // Defensive: dismiss any stale dialogs from previous commands (only if one is open)
    if (isOverlayOpen()) {
      await cdpDismiss();
      await sleep(TIMING.MICRO);
    }

    // Step 1/4: Mode switch via settings dropdown tabs
    window.__veo3_phase = 'MODE_SWITCH';
    console.log(tag + ' Step 1/4: Switching mode to "' + cmd.mode + '"...');
    const modeOk = await ensureCreationMode(cmd.mode);
    if (!modeOk) {
      // Fail-fast: do not proceed in wrong mode (causes cascading chaos)
      await cdpDismiss();
      await sleep(TIMING.MICRO);
      throw new Error('Mode switch to "' + cmd.mode + '" failed');
    } else {
      console.log(tag + ' Step 1/4: Mode OK');
    }

    // Step 2/4: Gallery selection (if command has character images)
    window.__veo3_phase = 'GALLERY_SELECT';
    if (cmd.characterImages && cmd.characterImages.length > 0) {
      console.log(tag + ' Step 2/4: Selecting ' + cmd.characterImages.length + ' character(s) from gallery...');
      var galleryResult = await selectCharactersFromGallery(cmd.characterImages, globalIndex, cmd.mode);

      if (galleryResult.failCount > 0) {
        // Do NOT submit prompts with missing/wrong characters - skip this command
        console.log(tag + ' Step 2/4: SKIPPING - ' + galleryResult.failCount +
          ' character(s) not found: ' + galleryResult.failedNames.join(', '));
        await cdpDismiss();
        await sleep(TIMING.SHORT);
        return {
          skipped: true,
          reason: 'Character not found: ' + galleryResult.failedNames.join(', ')
        };
      }
    } else {
      console.log(tag + ' Step 2/4: No characters (text-only prompt)');
    }

    // Step 3/4: Fill prompt text via CDP (trusted events) with DOM fallback
    window.__veo3_phase = 'FILL_PROMPT';
    console.log(tag + ' Step 3/4: Filling prompt via CDP (' + cmd.prompt.length + ' chars)...');

    var fillSuccess = await cdpFillPrompt(cmd.prompt);

    if (!fillSuccess) {
      // Fallback: try the old DOM-based method
      console.log(tag + ' Step 3/4: CDP fill failed, falling back to DOM fillSlateEditor...');
      try {
        await window.veo3Timing.fillSlateEditor(cmd.prompt);
        fillSuccess = true;
      } catch (fillErr) {
        console.log(tag + ' Step 3/4: DOM fallback also failed: ' + fillErr.message);
        throw new Error('Prompt fill failed (CDP + DOM fallback): ' + fillErr.message);
      }
    }

    // Step 4/4: Submit via CDP (trusted click) with DOM fallback
    window.__veo3_phase = 'SUBMIT';
    console.log(tag + ' Step 4/4: Submitting via CDP...');

    var submitSuccess = await cdpClickSubmit();

    if (!submitSuccess) {
      // Fallback: try the old DOM-based submission chain
      console.log(tag + ' Step 4/4: CDP submit failed, falling back to DOM submitWithRetry...');
      submitSuccess = await window.veo3Timing.submitWithRetry();
    }

    if (!submitSuccess) {
      console.log(tag + ' === FAILED (CDP + DOM fallback both failed) ===');
      throw new Error('All submission strategies failed (CDP + DOM)');
    }

    console.log(tag + ' === DONE ===');
    return { skipped: false };
  }

  // === CHARACTER SELECTION FROM GALLERY ===
  // For each character in the command, search by name and click to select.
  // Returns { successCount, failCount, failedNames } to allow skip-on-failure.

  async function selectCharactersFromGallery(characterImages, promptIndex, mode) {
    const { sleep, TIMING } = window.veo3Timing;
    const total = commandQueue.length;
    const tag = '[FLOW ' + (promptIndex + 1) + '/' + total + ']';

    var successCount = 0;
    var failCount = 0;
    var failedNames = [];

    for (const charImg of characterImages) {
      if (!automationState.running) break;

      // Use galleryItemName (set by pre-upload from original filename) or fall back to character name
      const searchName = charImg.galleryItemName || charImg.name || charImg.characterId;
      if (!searchName) {
        console.log(tag + '   > Gallery: no name to search, skipping');
        failCount++;
        failedNames.push('(no name)');
        continue;
      }

      console.log(tag + '   > Gallery: searching "' + searchName + '"...');

      var selected = await window.veo3GalleryMapper.selectMediaByName(
        searchName, { mode: mode || 'elementos' }
      );

      // Retry once on failure: dismiss stale dialogs, wait, try again
      if (!selected) {
        console.log(tag + '   > Gallery: retry for "' + searchName + '"...');
        await cdpDismiss();
        await sleep(TIMING.STANDARD);
        selected = await window.veo3GalleryMapper.selectMediaByName(
          searchName, { mode: mode || 'elementos' }
        );
      }

      if (selected) {
        console.log(tag + '   > Gallery: match found and selected');
        successCount++;
      } else {
        console.log(tag + '   > Gallery: "' + searchName + '" NOT FOUND after retry');
        failCount++;
        failedNames.push(searchName);
      }

      await sleep(TIMING.MEDIUM);
    }

    return { successCount: successCount, failCount: failCount, failedNames: failedNames };
  }

  // === MODE SWITCHING + SETTINGS VIA SETTINGS DROPDOWN ===
  // Google Flow (Feb 2026): mode is a TAB inside the settings dropdown menu.
  // The settings dropdown contains: Image/Video tabs, Landscape/Portrait tabs, x1-x4 tabs, model selector.
  // Mode mapping: imagem -> IMAGE tab (Nano Banana 2), texto/elementos -> VIDEO tab (Veo 3.1-Fast)
  // The settings button text reveals the active model, allowing mode detection without opening dropdown.
  //
  // Settings (Landscape, x1) are applied INSIDE the same dropdown interaction on the first call,
  // saving an extra open/close cycle. After first application, they persist and are not re-applied.

  let settingsApplied = false; // Landscape + x1 applied at least once this session

  async function ensureCreationMode(targetMode) {
    const { sleep, TIMING } = window.veo3Timing;

    // Step 1: Detect current mode from settings button text (no dropdown needed)
    const currentMode = window.veo3Selectors.detectCurrentMode();
    const targetIsImage = (targetMode === 'imagem');
    const currentIsImage = (currentMode === 'imagem');
    const needsModeSwitch = currentMode === null || targetIsImage !== currentIsImage;

    console.log('[MODE] Current: ' + (currentMode || 'unknown') + ', Target: ' + targetMode +
      (settingsApplied ? '' : ' (first run, will apply Landscape+x1)'));

    // If mode is already correct AND settings were already applied, skip entirely
    if (!needsModeSwitch && settingsApplied) {
      console.log('[MODE] Already in correct mode (' + currentMode + '), no action needed');
      return true;
    }

    // Outer retry: the full open-click-close-verify sequence can be retried
    const MAX_SWITCH_ATTEMPTS = 2;
    for (let switchAttempt = 1; switchAttempt <= MAX_SWITCH_ATTEMPTS; switchAttempt++) {
      if (switchAttempt > 1) {
        console.log('[MODE] Retry attempt ' + switchAttempt + '/' + MAX_SWITCH_ATTEMPTS + '...');
        await sleep(TIMING.STANDARD);
      }

      // Step 2: Open settings dropdown
      const settingsBtn = window.veo3Selectors.settingsButton();
      if (!settingsBtn) {
        console.log('[MODE] Settings button not found, cannot switch mode');
        return false;
      }

      let menuOpened = false;
      const MAX_OPEN_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_OPEN_RETRIES; attempt++) {
        console.log('[MODE] Opening settings dropdown (attempt ' + attempt + '/' + MAX_OPEN_RETRIES + ')...');
        await window.veo3RadixClick(settingsBtn);
        await sleep(TIMING.STANDARD);

        // Verify dropdown opened by checking for any tab
        const anyTab = document.querySelector('[role="tab"][aria-controls*="-content-LANDSCAPE"]') ||
                       window.veo3Selectors.getModeTab(targetMode);
        if (anyTab) {
          menuOpened = true;
          console.log('[MODE] Settings dropdown opened');
          break;
        }

        if (attempt < MAX_OPEN_RETRIES) {
          console.log('[MODE] Dropdown did not open, retrying...');
          await cdpDismiss();
          await sleep(TIMING.MEDIUM);
        }
      }

      if (!menuOpened) {
        console.log('[MODE] Settings dropdown did not open after ' + MAX_OPEN_RETRIES + ' attempts');
        await cdpDismiss();
        await sleep(TIMING.SHORT);
        continue;
      }

      // Step 2b: Apply Landscape + x1 + Nano Banana 2 on first run (dropdown is already open)
      if (!settingsApplied) {
        const landscapeTab = document.querySelector(window.veo3Selectors.tabLandscape);
        if (landscapeTab && landscapeTab.getAttribute('data-state') !== 'active') {
          window.veo3ClickLogger?.logNativeClick(landscapeTab, 'SETTINGS', 'Landscape tab');
          await cdpClickElementByRect(landscapeTab);
          await sleep(TIMING.SHORT);
          console.log('[MODE] Applied Landscape setting');
        }

        const count1Tab = document.querySelector(window.veo3Selectors.tabCount(1));
        if (count1Tab && count1Tab.getAttribute('data-state') !== 'active') {
          window.veo3ClickLogger?.logNativeClick(count1Tab, 'SETTINGS', 'x1 tab');
          await cdpClickElementByRect(count1Tab);
          await sleep(TIMING.SHORT);
          console.log('[MODE] Applied x1 setting');
        }

        // Ensure Nano Banana 2 is selected for IMAGE mode
        // The model selector may be a tab, option, radio, or button inside the dropdown
        if (targetIsImage) {
          var currentModel = window.veo3Selectors.getActiveModelName();
          if (currentModel && !currentModel.toLowerCase().includes('nano banana 2')) {
            console.log('[MODE] Model is "' + currentModel + '", switching to Nano Banana 2...');
            var modelFound = false;
            // Search for any clickable element containing "Nano Banana 2"
            var candidates = document.querySelectorAll('[role="tab"], [role="option"], [role="menuitemradio"], [role="radio"], button, [role="menuitem"]');
            for (var m = 0; m < candidates.length; m++) {
              if (candidates[m].offsetParent === null || candidates[m].disabled) continue;
              var cText = candidates[m].textContent.trim().toLowerCase();
              if (cText.includes('nano banana 2') && !cText.includes('nano banana 2 pro')) {
                window.veo3ClickLogger?.logNativeClick(candidates[m], 'SETTINGS', 'Nano Banana 2 model');
                await cdpClickElementByRect(candidates[m]);
                await sleep(TIMING.SHORT);
                console.log('[MODE] Switched to Nano Banana 2');
                modelFound = true;
                break;
              }
            }
            if (!modelFound) {
              console.log('[MODE] Nano Banana 2 selector not found in dropdown (model may need manual selection)');
            }
          } else {
            console.log('[MODE] Model already correct: ' + (currentModel || 'unknown'));
          }
        }

        settingsApplied = true;
      }

      // Step 3: Switch mode tab if needed (IMAGE or VIDEO)
      if (needsModeSwitch) {
        const modeTab = window.veo3Selectors.getModeTab(targetMode);
        if (!modeTab) {
          console.log('[MODE] Mode tab not found for "' + targetMode + '"');
          await cdpDismiss();
          await sleep(TIMING.SHORT);
          continue;
        }

        if (modeTab.getAttribute('data-state') !== 'active') {
          const tabLabel = modeTab.textContent.trim();
          window.veo3ClickLogger?.logNativeClick(modeTab, 'MODE_SWITCH', targetMode + ' tab: "' + tabLabel + '"');
          await window.veo3RadixClick(modeTab);

          // Step 3b: Verify tab activation INSIDE the dropdown (before closing)
          let tabActivated = false;
          for (let check = 0; check < 15; check++) { // 15 * 200ms = 3s max
            await sleep(200);
            const freshTab = window.veo3Selectors.getModeTab(targetMode);
            if (freshTab && freshTab.getAttribute('data-state') === 'active') {
              tabActivated = true;
              break;
            }
          }

          if (tabActivated) {
            console.log('[MODE] Tab activated (data-state=active) for ' + (targetIsImage ? 'IMAGE' : 'VIDEO'));
          } else {
            console.log('[MODE] Tab click did not activate after 3s, will retry');
            await cdpDismiss();
            await sleep(TIMING.SHORT);
            continue;
          }
        } else {
          console.log('[MODE] Mode tab already active, no click needed');
        }
      }

      // Step 4: Close settings dropdown
      const closeBtnRef = window.veo3Selectors.settingsButton();
      if (closeBtnRef) {
        await window.veo3RadixClick(closeBtnRef);
      }
      await sleep(TIMING.STANDARD);

      // Step 5: Verify mode (only if we switched)
      if (needsModeSwitch) {
        let newMode = null;
        let success = false;
        const verifyStart = Date.now();
        const verifyTimeout = TIMING.MODE_VERIFY_TIMEOUT || 5000;
        while (Date.now() - verifyStart < verifyTimeout) {
          newMode = window.veo3Selectors.detectCurrentMode();
          success = (targetIsImage && newMode === 'imagem') || (!targetIsImage && newMode !== 'imagem');
          if (success) break;
          await sleep(TIMING.POLL_NORMAL);
        }

        if (success) {
          console.log('[MODE] Mode switched to "' + targetMode + '" (tab: ' + (newMode === 'imagem' ? 'IMAGE' : 'VIDEO') + ', took ' + (Date.now() - verifyStart) + 'ms)');
          return true;
        }

        console.log('[MODE] Mode verification failed after ' + verifyTimeout + 'ms. Current: ' + (newMode || 'unknown') + ', Target: ' + targetMode);
        continue;
      }

      // No mode switch needed, just applied settings
      console.log('[MODE] Settings applied, mode already correct (' + currentMode + ')');
      return true;
    }

    console.log('[MODE] Mode switch FAILED after ' + MAX_SWITCH_ATTEMPTS + ' attempts');
    return false;
  }

  // Detect current mode from settings button text (for batch pause timing)
  function detectCurrentMode() {
    const mode = window.veo3Selectors.detectCurrentMode();
    if (mode === 'imagem') return 'imagem';
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
        let cropsFound = 0;
        for (let i = 0; i < fileEntries.length; i++) {
          const confirmed = await window.waitAndConfirmCrop(15000);
          if (confirmed) {
            cropsFound++;
            console.log('[PRE_UPLOAD] Crop ' + (i + 1) + '/' + fileEntries.length + ' confirmed');
          } else {
            console.log('[PRE_UPLOAD] Crop ' + (i + 1) + '/' + fileEntries.length + ' not found (may not be needed)');
            break;
          }
          await sleep(500);
        }

        // Wait for uploads to complete - but only if crop dialogs were found
        // If no crop dialogs appeared, images went directly into the prompt (no server upload needed)
        if (cropsFound > 0) {
          console.log('[PRE_UPLOAD] Waiting for uploads to complete...');
          const uploadTimeout = Math.max(45000, fileEntries.length * 15000);
          await window.waitForImageUpload(uploadTimeout);
        } else {
          // No crop dialogs = images pasted directly into prompt, short wait is enough
          console.log('[PRE_UPLOAD] No crop dialogs found, images loaded directly into prompt');
          await sleep(3000);
        }
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

  // === GENERATION FAILURE SCAN & AUTO-RETRY ===
  // Scans all visible tiles for policy violation failures and clicks "Tentar novamente".
  // Called during batch pause (between batches) and after the final batch.
  // Max 3 retry attempts per tile, 13s wait between retries.

  const RETRY_MAX_ATTEMPTS = 3;
  const RETRY_WAIT_MS = 13000; // 13s to wait after clicking retry before re-checking

  async function scanAndRetryFailedTiles() {
    const { sleep } = window.veo3Timing;

    const failedTiles = window.veo3Selectors.failedTiles();
    if (failedTiles.length === 0) {
      console.log('[RETRY] No failed tiles found');
      return { retried: 0, recovered: 0, exhausted: 0 };
    }

    console.log('[RETRY] Found ' + failedTiles.length + ' failed tile(s), starting retry sub-batch...');
    notifySidepanel('RETRY_SCAN', { failedCount: failedTiles.length });

    var totalRetried = 0;
    var totalRecovered = 0;
    var totalExhausted = 0;

    for (var t = 0; t < failedTiles.length; t++) {
      if (!automationState.running) break;
      var tile = failedTiles[t];
      var tileId = tile.getAttribute('data-tile-id') || ('tile_' + t);

      for (var attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
        // Handle pause during retry
        while (automationState.paused) {
          await sleep(500);
          if (!automationState.running) break;
        }
        if (!automationState.running) break;

        var retryBtn = window.veo3Selectors.retryButton(tile);
        if (!retryBtn) {
          console.log('[RETRY] No retry button found in tile ' + tileId);
          break;
        }

        console.log('[RETRY] Tile ' + tileId.substring(tileId.length - 8) + ' attempt ' + attempt + '/' + RETRY_MAX_ATTEMPTS);
        notifySidepanel('GENERATION_RETRY', {
          tileId: tileId,
          attempt: attempt,
          maxAttempts: RETRY_MAX_ATTEMPTS
        });
        totalRetried++;

        // Click retry button
        await window.veo3RobustClick(retryBtn);
        console.log('[RETRY] Clicked retry, waiting ' + (RETRY_WAIT_MS / 1000) + 's...');
        await sleep(RETRY_WAIT_MS);

        // Re-check if this tile is still failed
        var stillFailed = window.veo3Selectors.detectTileFailure(tile);
        if (!stillFailed) {
          console.log('[RETRY] Tile ' + tileId.substring(tileId.length - 8) + ' RECOVERED after attempt ' + attempt);
          notifySidepanel('RETRY_SUCCESS', { tileId: tileId, attempt: attempt });
          totalRecovered++;
          break;
        }

        if (attempt === RETRY_MAX_ATTEMPTS) {
          console.log('[RETRY] Tile ' + tileId.substring(tileId.length - 8) + ' still FAILED after ' + RETRY_MAX_ATTEMPTS + ' attempts');
          notifySidepanel('RETRY_EXHAUSTED', { tileId: tileId, attempts: RETRY_MAX_ATTEMPTS });
          totalExhausted++;
        }
      }
    }

    console.log('[RETRY] Sub-batch complete: ' + totalRetried + ' retries, ' +
        totalRecovered + ' recovered, ' + totalExhausted + ' exhausted');

    return { retried: totalRetried, recovered: totalRecovered, exhausted: totalExhausted };
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
        await cdpDismiss();
        await sleep(TIMING.MEDIUM);
      }
    }

    if (!menuOpened) {
      console.log('[SETTINGS] Menu did not open after ' + MAX_RETRIES + ' attempts, skipping settings');
      await cdpDismiss();
      await sleep(TIMING.SHORT);
      return;
    }

    // Click Landscape tab via CDP
    const landscapeTab = document.querySelector(window.veo3Selectors.tabLandscape);
    if (landscapeTab) {
      window.veo3ClickLogger?.logNativeClick(landscapeTab, 'SETTINGS', 'Landscape tab');
      await cdpClickElementByRect(landscapeTab);
      if (window.veo3Highlight) window.veo3Highlight(landscapeTab);
      await sleep(TIMING.SHORT);
      console.log('[SETTINGS] Clicked Landscape tab');
    }

    // Click x1 tab via CDP
    const count1Tab = document.querySelector(window.veo3Selectors.tabCount(1));
    if (count1Tab) {
      window.veo3ClickLogger?.logNativeClick(count1Tab, 'SETTINGS', 'x1 tab');
      await cdpClickElementByRect(count1Tab);
      if (window.veo3Highlight) window.veo3Highlight(count1Tab);
      await sleep(TIMING.SHORT);
      console.log('[SETTINGS] Clicked x1 tab');
    }

    // Close settings
    await cdpDismiss();
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
