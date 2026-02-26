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

    // Wait for Google Flow to fully load (Slate editor must exist before any interaction)
    const promptField = await window.veo3Timing.waitForAnyElement([
      '[data-slate-editor="true"][contenteditable="true"]',
      '#PINHOLE_TEXT_AREA_ELEMENT_ID'
    ], 15000);
    if (!promptField) {
      window.veo3Debug?.error('AUTO', 'No prompt field found - page may not be loaded');
      notifySidepanel('AUTOMATION_ERROR', { message: 'Google Flow page not ready (no prompt field found)' });
      automationState.running = false;
      return;
    }
    console.log('[ContentBridge] Page ready - prompt field found:', promptField.tagName);

    // Apply fixed settings (Landscape, x1) - uses exact selector, skips if not found
    await applyFixedSettings();
    await sleep(TIMING.STANDARD);

    // Phase 1: Pre-upload all unique character images
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

    // Phase 2: Process prompts in batches of BATCH_SIZE
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

    // Ensure correct mode (Video/Image) via config menu tabs
    const modeOk = await ensureModeViaConfigMenu(cmd.mode);
    if (!modeOk) {
      window.veo3Debug?.warn('MODE', 'Mode switch to "' + cmd.mode + '" not confirmed, proceeding anyway');
    }

    // Select character references from gallery if needed
    if (cmd.characterImages && cmd.characterImages.length > 0) {
      await selectCharactersFromGallery(cmd.characterImages, globalIndex);
    }

    // Fill prompt text in Slate editor
    window.veo3Debug?.debug('AUTO', 'Filling prompt', { length: cmd.prompt.length });
    await window.veo3Timing.fillSlateEditor(cmd.prompt);

    // Submit with retry chain
    window.veo3Debug?.debug('AUTO', 'Submitting prompt...');
    const submitted = await window.veo3Timing.submitWithRetry();
    if (!submitted) {
      throw new Error('All submission strategies failed');
    }

    window.veo3Debug?.info('AUTO', 'Submission confirmed for command #' + globalIndex);
    return { skipped: false };
  }

  // === CHARACTER SELECTION FROM GALLERY ===
  // For each character in the command, click "+" to open gallery, search by name, click to select

  async function selectCharactersFromGallery(characterImages, promptIndex) {
    const { sleep, TIMING } = window.veo3Timing;

    for (const charImg of characterImages) {
      if (!automationState.running) break;

      const searchName = charImg.galleryItemName || charImg.name;
      if (!searchName) continue;

      window.veo3Debug?.debug('GALLERY', 'Selecting character: ' + searchName);

      const selected = await window.veo3GalleryMapper.selectMediaByName(searchName);
      if (selected) {
        window.veo3Debug?.info('GALLERY', 'Character selected: ' + searchName);
      } else {
        window.veo3Debug?.warn('GALLERY', 'Character not found in gallery: ' + searchName);
      }

      await sleep(TIMING.MEDIUM);
    }
  }

  // === MODE SWITCHING VIA CONFIG MENU ===
  // Opens the settings menu (button with crop_16_9 + x1) and clicks the correct tab.
  // For 'elementos': ensure Video + Ingredients
  // For 'texto': ensure Video
  // For 'imagem': ensure Image

  async function ensureModeViaConfigMenu(targetMode) {
    const { sleep, TIMING } = window.veo3Timing;
    window.veo3Debug?.info('MODE', 'Ensuring mode: ' + targetMode);

    // Determine which tabs to activate
    let mediaTab = null;  // 'VIDEO' or 'IMAGE'
    let subTab = null;    // 'VIDEO_REFERENCES' (Ingredients) or null

    if (targetMode === 'imagem') {
      mediaTab = 'IMAGE';
    } else if (targetMode === 'elementos') {
      mediaTab = 'VIDEO';
      subTab = 'VIDEO_REFERENCES'; // Ingredients
    } else {
      mediaTab = 'VIDEO';
    }

    // Quick check: are the correct tabs already active? (check without opening menu)
    const videoTabEl = document.querySelector(window.veo3Selectors.tabVideo);
    const imageTabEl = document.querySelector(window.veo3Selectors.tabImage);

    // If tabs are visible (menu already open or persisted state), check them
    if (videoTabEl && imageTabEl) {
      const videoActive = videoTabEl.getAttribute('data-state') === 'active';
      const imageActive = imageTabEl.getAttribute('data-state') === 'active';

      if (mediaTab === 'VIDEO' && videoActive && !subTab) {
        window.veo3Debug?.debug('MODE', 'Already in Video mode');
        return true;
      }
      if (mediaTab === 'IMAGE' && imageActive) {
        window.veo3Debug?.debug('MODE', 'Already in Image mode');
        return true;
      }
    }

    // Need to open config menu and switch tabs
    const settingsBtn = window.veo3Selectors.settingsButton();
    if (!settingsBtn) {
      window.veo3Debug?.warn('MODE', 'Settings button not found, cannot switch mode');
      return false;
    }

    // Open settings menu
    if (window.veo3RobustClick) {
      await window.veo3RobustClick(settingsBtn);
    } else {
      settingsBtn.click();
    }
    await sleep(TIMING.MEDIUM);

    // Verify menu opened
    const menuCheck = document.querySelector('[role="tab"][aria-controls*="-content-VIDEO"]') ||
                      document.querySelector('[role="tab"][aria-controls*="-content-IMAGE"]');
    if (!menuCheck) {
      window.veo3Debug?.warn('MODE', 'Config menu did not open');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(TIMING.SHORT);
      return false;
    }

    // Click media tab (Video or Image)
    const mediaTabSelector = mediaTab === 'IMAGE'
      ? window.veo3Selectors.tabImage
      : window.veo3Selectors.tabVideo;
    const mediaTabTarget = document.querySelector(mediaTabSelector);

    if (mediaTabTarget) {
      if (window.veo3RobustClick) {
        await window.veo3RobustClick(mediaTabTarget);
      } else {
        mediaTabTarget.click();
      }
      await sleep(TIMING.SHORT);
      window.veo3Debug?.debug('MODE', 'Clicked ' + mediaTab + ' tab');
    } else {
      window.veo3Debug?.warn('MODE', mediaTab + ' tab not found in menu');
    }

    // Click sub-tab if needed (Ingredients for elementos mode)
    if (subTab) {
      await sleep(TIMING.SHORT);
      const subTabSelector = window.veo3Selectors.tabIngredients;
      const subTabEl = document.querySelector(subTabSelector);

      if (subTabEl) {
        if (window.veo3RobustClick) {
          await window.veo3RobustClick(subTabEl);
        } else {
          subTabEl.click();
        }
        await sleep(TIMING.SHORT);
        window.veo3Debug?.debug('MODE', 'Clicked Ingredients sub-tab');
      } else {
        window.veo3Debug?.warn('MODE', 'Ingredients sub-tab not found');
      }
    }

    // Close menu
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(TIMING.MEDIUM);

    window.veo3Debug?.info('MODE', 'Mode switch to ' + targetMode + ' completed');
    return true;
  }

  // Detect current mode from config button text (for batch pause timing)
  function detectCurrentMode() {
    // Check config button text for hints
    const settingsBtn = window.veo3Selectors.settingsButton();
    if (settingsBtn) {
      const text = settingsBtn.textContent.trim().toLowerCase();
      if (text.includes('image') || text.includes('imagem')) return 'imagem';
    }
    return 'texto'; // Default to video-based mode for timing
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

    window.veo3Debug?.info('PRE_UPLOAD', 'Uploading ' + uniqueChars.size + ' character images');
    notifySidepanel('PRE_UPLOAD_START', { count: uniqueChars.size });

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

        // Upload via multi-strategy (clipboard paste -> drag on body -> etc)
        const dispatched = await window.simulateImageDragDrop(file);
        if (!dispatched) {
          window.veo3Debug?.warn('PRE_UPLOAD', 'All upload strategies failed for: ' + charData.name);
          continue;
        }

        await sleep(800);

        // Wait for and confirm crop dialog (15s timeout)
        await window.waitAndConfirmCrop(15000);

        // Wait for upload to complete (30s timeout, corrected signal detection)
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

    // Open settings panel (exact selector: must have BOTH crop icon AND count text)
    const settingsBtn = window.veo3Selectors.settingsButton();
    if (!settingsBtn) {
      console.log('[ContentBridge] Settings button not found (no button has both aspect icon + count), skipping');
      return;
    }

    if (window.veo3RobustClick) {
      await window.veo3RobustClick(settingsBtn);
    } else {
      settingsBtn.click();
    }
    await sleep(TIMING.MEDIUM);

    // Verify menu actually opened (look for tab elements)
    const menuOpened = document.querySelector('[role="tab"][aria-controls*="LANDSCAPE"]');
    if (!menuOpened) {
      console.log('[ContentBridge] Settings menu did not open, skipping settings');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(TIMING.SHORT);
      return;
    }

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
