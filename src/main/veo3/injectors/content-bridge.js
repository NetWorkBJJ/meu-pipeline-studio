// content-bridge.js - Main automation orchestrator for Google Flow
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Receives commands from Electron sidepanel via window.postMessage
// Reports progress back via console.log(JSON) -> Electron console-message event

(function () {
  if (window.__veo3_bridge_loaded) return;
  window.__veo3_bridge_loaded = true;

  // === CONSTANTS ===

  const BATCH_SIZE = 4;

  const MODE_KEYWORDS = {
    texto: ['text to video', 'texto', 'text'],
    elementos: ['elements', 'elementos', 'element', 'ingredients'],
    imagem: ['create image', 'imagem', 'image', 'criar imagem', 'criar imagens']
  };

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
    window.veo3Debug?.info('AUTO', 'Starting automation', { commandCount: commandQueue.length, modes: commandQueue.map(c => c.mode) });

    if (commandQueue.length === 0) {
      window.veo3Debug?.error('AUTO', 'No commands to process');
      notifySidepanel('AUTOMATION_ERROR', { message: 'No commands to process' });
      return;
    }

    const { sleep, TIMING } = window.veo3Timing;

    automationState.running = true;
    automationState.paused = false;
    automationState.currentIndex = 0;
    automationState.startedAt = Date.now();

    notifySidepanel('AUTOMATION_STARTED', { total: commandQueue.length });

    // Wait for Google Flow to fully load (prompt field must exist before any clicks)
    // Try #PINHOLE first (legacy), then Slate editor (current Google Flow UI)
    const promptField = await window.veo3Timing.waitForAnyElement([
      '#PINHOLE_TEXT_AREA_ELEMENT_ID',
      '[data-slate-editor="true"][contenteditable="true"]',
      '[contenteditable="true"]'
    ], 15000);
    if (!promptField) {
      window.veo3Debug?.error('AUTO', 'No prompt field found - page may not be loaded');
      notifySidepanel('AUTOMATION_ERROR', { message: 'Google Flow page not ready (no prompt field found)' });
      automationState.running = false;
      return;
    }
    console.log('[ContentBridge] Page ready - prompt field found:', promptField.id || promptField.tagName);

    // Apply fixed settings before starting
    await applyFixedSettings();
    await sleep(TIMING.STANDARD);

    // Pre-upload all unique character images before processing prompts
    if (automationState.running) {
      const preUploadResults = await preUploadCharacterImages(commandQueue);

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
        window.veo3Debug?.info('PRE_UPLOAD', 'Updated gallery names for ' + preUploadResults.size + ' characters');
      }
    }

    if (!automationState.running) {
      return;
    }

    // Process in batches of BATCH_SIZE
    const totalBatches = Math.ceil(commandQueue.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      if (!automationState.running) break;

      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, commandQueue.length);
      const batchCommands = commandQueue.slice(batchStart, batchEnd);

      console.log(`[ContentBridge] Batch ${batchIndex + 1}/${totalBatches} (commands ${batchStart + 1}-${batchEnd})`);

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
          notifySidepanel('PROMPT_SUBMITTED', { commandId: cmd.id, index: globalIndex });
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
          console.error(`[ContentBridge] Error processing command #${globalIndex}:`, err);
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

        console.log(`[ContentBridge] Batch ${batchIndex + 1} done. Pausing ${pauseSec}s before next batch...`);
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
    console.log('[ContentBridge] Automation stopped');
  }

  function togglePause() {
    if (!automationState.running) return;

    automationState.paused = !automationState.paused;

    if (automationState.paused) {
      notifySidepanel('AUTOMATION_PAUSED', {});
      console.log('[ContentBridge] Automation paused');
    } else {
      notifySidepanel('AUTOMATION_RESUMED', {});
      console.log('[ContentBridge] Automation resumed');
    }
  }

  // === COMMAND PROCESSING ===

  async function processCommand(cmd, globalIndex) {
    window.veo3Debug?.info('AUTO', 'Processing command #' + globalIndex, {
      mode: cmd.mode,
      prompt: cmd.prompt?.substring(0, 80),
      characters: cmd.characterImages?.length || 0
    });

    // Ensure correct mode is selected (with retry)
    await ensureModeWithRetry(cmd.mode);

    // Dispatch to appropriate handler
    if (cmd.mode === 'elementos' && cmd.characterImages && cmd.characterImages.length > 0) {
      window.veo3Debug?.debug('AUTO', 'Dispatching to elements handler', { characters: cmd.characterImages.length });
      return await window.elementsHandler.processPromptWithElements(globalIndex, cmd);
    } else if (cmd.mode === 'imagem') {
      window.veo3Debug?.debug('AUTO', 'Dispatching to image creation handler');
      await window.imageCreationHandler.processPromptWithImageCreation(globalIndex, cmd);
      return { skipped: false };
    } else {
      window.veo3Debug?.debug('AUTO', 'Dispatching to text mode');
      await processTextMode(cmd);
      return { skipped: false };
    }
  }

  async function processTextMode(cmd) {
    window.veo3Debug?.debug('AUTO', 'Text mode: filling editor', { promptLength: cmd.prompt.length });

    // Fill the Slate.js editor (shared function)
    await window.veo3Timing.fillSlateEditor(cmd.prompt);
    window.veo3Debug?.debug('AUTO', 'Prompt filled, submitting...');

    // Submit with retry chain (shared function)
    const submitted = await window.veo3Timing.submitWithRetry();
    if (!submitted) {
      window.veo3Debug?.error('SUBMIT', 'All submission strategies failed for text mode');
      throw new Error('All submission strategies failed for text mode');
    }

    window.veo3Debug?.info('AUTO', 'Text mode submission confirmed');
  }

  // === MODE SWITCHING WITH RETRY (3 attempts) ===

  function detectCurrentMode() {
    const modeText = window.veo3Selectors.getCurrentModeText();
    if (!modeText) return null;

    for (const [mode, keywords] of Object.entries(MODE_KEYWORDS)) {
      for (const kw of keywords) {
        if (modeText.includes(kw)) return mode;
      }
    }
    return null;
  }

  async function ensureModeWithRetry(targetMode, maxAttempts = 2) {
    const { sleep, TIMING } = window.veo3Timing;
    window.veo3Debug?.info('MODE', 'Ensuring mode: ' + targetMode);

    // Quick check: if current mode already matches, return immediately
    const currentMode = detectCurrentMode();
    if (currentMode === targetMode) {
      window.veo3Debug?.debug('MODE', 'Already in target mode: ' + targetMode);
      return true;
    }

    // If no combobox exists in the UI, skip mode switching entirely
    // Google Flow may not always have a mode combobox visible
    const combobox = window.veo3Selectors.getModeCombobox();
    if (!combobox) {
      console.log(`[ContentBridge] Mode combobox not found in UI, skipping mode switch to "${targetMode}" and proceeding`);
      return false;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      window.veo3Debug?.debug('MODE', 'Switch attempt ' + attempt + '/' + maxAttempts, { from: currentMode, to: targetMode });

      // Click the combobox to open dropdown
      const cb = window.veo3Selectors.getModeCombobox();
      if (!cb) {
        console.log('[ContentBridge] Mode combobox disappeared, skipping');
        return false;
      }

      if (window.veo3RobustClick) {
        await window.veo3RobustClick(cb);
      } else {
        cb.click();
      }
      await sleep(TIMING.MEDIUM);

      // Find and click the target option in the dropdown
      const targetKeywords = MODE_KEYWORDS[targetMode] || [targetMode];
      const options = window.veo3Selectors.getModeOptions
        ? window.veo3Selectors.getModeOptions()
        : document.querySelectorAll('[role="option"], [role="menuitem"], [data-value], [data-radix-collection-item]');

      let found = false;
      for (const option of options) {
        if (option.offsetParent === null) continue;
        const optionText = option.textContent.trim().toLowerCase();
        for (const kw of targetKeywords) {
          if (optionText.includes(kw)) {
            if (window.veo3RobustClick) {
              await window.veo3RobustClick(option);
            } else {
              option.click();
            }
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        // Try listbox items as fallback
        const listItems = document.querySelectorAll('[role="listbox"] [role="option"], li[role="option"]');
        for (const item of listItems) {
          if (item.offsetParent === null) continue;
          const itemText = item.textContent.trim().toLowerCase();
          for (const kw of targetKeywords) {
            if (itemText.includes(kw)) {
              if (window.veo3RobustClick) {
                await window.veo3RobustClick(item);
              } else {
                item.click();
              }
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      if (!found) {
        // Close dropdown
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        console.warn(`[ContentBridge] Could not find mode option for "${targetMode}" (attempt ${attempt})`);
      }

      await sleep(TIMING.AFTER_MODE_SWITCH);

      // Verify mode actually changed
      const verifiedMode = detectCurrentMode();
      if (verifiedMode === targetMode) {
        notifySidepanel('MODE_CHANGED', { from: currentMode, to: targetMode, attempt });
        return true;
      }
    }

    console.log(`[ContentBridge] Mode switch to "${targetMode}" not confirmed, proceeding anyway`);
    return false;
  }

  // === PRE-UPLOAD CHARACTER IMAGES ===

  async function preUploadCharacterImages(commands) {
    const { sleep, TIMING } = window.veo3Timing;
    const results = new Map(); // characterId -> galleryItemName

    // Collect unique characters that need upload
    const uniqueChars = new Map(); // characterId -> { name, dataUrl, fileName }
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

    if (uniqueChars.size === 0) {
      window.veo3Debug?.debug('PRE_UPLOAD', 'No character images to upload');
      return results;
    }

    window.veo3Debug?.info('PRE_UPLOAD', 'Uploading ' + uniqueChars.size + ' character images (individual)');
    notifySidepanel('PRE_UPLOAD_START', { count: uniqueChars.size });

    // Upload images one-by-one (batch drag & drop does not reliably trigger
    // file processing in Google Flow's React app - reference project also uses individual uploads)
    let uploadedCount = 0;
    for (const [charId, charData] of uniqueChars) {
      if (!automationState.running) break;

      const file = window.dataUrlToFile(charData.dataUrl, charData.fileName);
      if (!file) {
        window.veo3Debug?.warn('PRE_UPLOAD', 'dataUrlToFile returned null for: ' + charData.name);
        continue;
      }

      try {
        window.veo3Debug?.debug('PRE_UPLOAD', 'Uploading: ' + charData.name);

        // Drag & drop single file (simulateImageDragDrop handles targeting + feedback)
        await window.simulateImageDragDrop(file);
        await sleep(800);

        // Wait for and confirm crop dialog (15s timeout, exact selectors)
        await window.waitAndConfirmCrop(15000);

        // Wait for upload to complete (30s timeout, 6 signals)
        const uploaded = await window.waitForImageUpload(30000);
        if (uploaded) {
          uploadedCount++;
          const galleryName = charData.fileName.replace(/\.\w+$/, '');
          results.set(charId, galleryName);
          window.veo3Debug?.debug('PRE_UPLOAD', 'Uploaded: ' + charData.name);
        } else {
          window.veo3Debug?.warn('PRE_UPLOAD', 'Upload verification timed out for: ' + charData.name);
          // Still map the gallery name - it may have uploaded without visual confirmation
          const galleryName = charData.fileName.replace(/\.\w+$/, '');
          results.set(charId, galleryName);
        }
      } catch (err) {
        window.veo3Debug?.warn('PRE_UPLOAD', 'Upload failed for ' + charData.name + ': ' + err.message);
      }

      await sleep(TIMING.STANDARD);
    }

    notifySidepanel('PRE_UPLOAD_COMPLETE', {
      uploaded: uploadedCount,
      total: uniqueChars.size
    });

    window.veo3Debug?.info('PRE_UPLOAD', 'Upload complete: ' + uploadedCount + '/' + uniqueChars.size);
    return results;
  }

  // === SETTINGS ===

  async function applyFixedSettings() {
    const { sleep, TIMING } = window.veo3Timing;

    // Open settings panel
    const settingsBtn = window.veo3Selectors.settingsButton();
    if (!settingsBtn) {
      console.log('[ContentBridge] Settings button not found, skipping settings');
      return;
    }

    if (window.veo3RobustClick) {
      await window.veo3RobustClick(settingsBtn);
    } else {
      settingsBtn.click();
    }
    await sleep(TIMING.MEDIUM);

    // Click Landscape tab
    const landscapeTab = document.querySelector(window.veo3Selectors.tabLandscape);
    if (landscapeTab) {
      if (window.veo3RobustClick) {
        await window.veo3RobustClick(landscapeTab);
      } else {
        landscapeTab.click();
      }
      await sleep(TIMING.SHORT);
    }

    // Click x1 tab
    const count1Tab = document.querySelector(window.veo3Selectors.tabCount(1));
    if (count1Tab) {
      if (window.veo3RobustClick) {
        await window.veo3RobustClick(count1Tab);
      } else {
        count1Tab.click();
      }
      await sleep(TIMING.SHORT);
    }

    // Close settings
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(TIMING.MEDIUM);

    console.log('[ContentBridge] Fixed settings applied (Landscape, x1)');
  }

  async function applySettings(data) {
    console.log('[ContentBridge] Apply settings:', data);
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
        message: `Media library mapping failed: ${err.message}`
      });
    }
  }

  // === INITIALIZATION ===

  console.log('[Flow] Content bridge loaded - ready for commands');
  notifySidepanel('PAGE_READY', { url: window.location.href });
})();
