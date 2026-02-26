// content-bridge.js - Main automation orchestrator for Google Flow
// Receives commands from Electron sidepanel via window.postMessage
// Reports progress back via console.log(JSON) → Electron console-message event

// === STATE ===
const automationState = {
  running: false,
  paused: false,
  currentIndex: 0,
  startedAt: null
};

let commandQueue = [];

// === MODE MAPPING ===
const MODE_KEYWORDS = {
  texto: ['text to video', 'texto', 'text'],
  elementos: ['elements', 'elementos', 'element'],
  imagem: ['create image', 'imagem', 'image', 'criar']
};

// === COMMUNICATION ===

function notifySidepanel(action, data = {}) {
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
  if (commandQueue.length === 0) {
    notifySidepanel('AUTOMATION_ERROR', { message: 'No commands to process' });
    return;
  }

  automationState.running = true;
  automationState.paused = false;
  automationState.currentIndex = 0;
  automationState.startedAt = Date.now();

  notifySidepanel('AUTOMATION_STARTED', { total: commandQueue.length });

  // Apply fixed settings before starting
  await applyFixedSettings();

  for (let i = 0; i < commandQueue.length; i++) {
    if (!automationState.running) break;

    // Handle pause
    while (automationState.paused) {
      await window.veo3Timing.sleep(500);
      if (!automationState.running) break;
    }
    if (!automationState.running) break;

    automationState.currentIndex = i;
    const cmd = commandQueue[i];

    notifySidepanel('AUTOMATION_PROGRESS', {
      current: i,
      total: commandQueue.length,
      elapsed: Date.now() - automationState.startedAt,
      commandId: cmd.id
    });

    try {
      notifySidepanel('PROMPT_SUBMITTED', { commandId: cmd.id, index: i });
      await processCommand(cmd);
      notifySidepanel('PROMPT_COMPLETED', { commandId: cmd.id, index: i });
    } catch (err) {
      console.error(`[ContentBridge] Error processing command #${i}:`, err);
      notifySidepanel('PROMPT_FAILED', {
        commandId: cmd.id,
        index: i,
        error: err.message || String(err)
      });
    }

    // Brief delay between commands
    if (i < commandQueue.length - 1) {
      await window.veo3Timing.sleep(window.veo3Timing.TIMING.STANDARD);
    }
  }

  automationState.running = false;
  notifySidepanel('AUTOMATION_COMPLETE', {
    processed: commandQueue.length,
    elapsed: Date.now() - automationState.startedAt
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

async function processCommand(cmd) {
  // Ensure correct mode is selected
  await ensureCorrectMode(cmd.mode);

  // Dispatch to appropriate handler
  if (cmd.mode === 'elementos' && cmd.characterImages && cmd.characterImages.length > 0) {
    await window.elementsHandler.processPromptWithElements(cmd.sceneIndex, cmd);
  } else if (cmd.mode === 'imagem') {
    await window.imageCreationHandler.processPromptWithImageCreation(cmd.sceneIndex, cmd);
  } else {
    // Text-only mode (no reference images)
    await processTextMode(cmd);
  }
}

async function processTextMode(cmd) {
  const { sleep, waitForElement } = window.veo3Timing;

  // Fill the Slate.js editor
  const editor = await waitForElement(window.veo3Selectors.slateEditor);
  if (!editor) {
    throw new Error('Slate editor not found');
  }

  editor.focus();
  await sleep(100);

  // Clear existing content
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  await sleep(100);

  // Insert prompt text
  document.execCommand('insertText', false, cmd.prompt);
  await sleep(200);

  // Click submit
  const submitBtn = window.veo3Selectors.submitButton();
  if (!submitBtn) {
    throw new Error('Submit button (arrow_forward) not found');
  }

  if (window.veo3ClickFeedback) {
    await window.veo3ClickFeedback.clickWithFeedback(submitBtn);
  } else {
    submitBtn.click();
  }
  await sleep(300);

  // Wait for editor to clear (confirmation that Flow accepted the prompt)
  await waitForEditorClear();
}

async function waitForEditorClear(timeout = 15000) {
  const { sleep } = window.veo3Timing;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const editor = document.querySelector(window.veo3Selectors.slateEditor);
    if (editor) {
      const text = editor.textContent.trim();
      if (text === '' || text.length < 5) {
        return true;
      }
    }
    await sleep(500);
  }

  console.warn('[ContentBridge] Editor clear wait timed out');
  return false;
}

// === MODE SWITCHING ===

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

async function ensureCorrectMode(targetMode) {
  const { sleep } = window.veo3Timing;
  const currentMode = detectCurrentMode();

  if (currentMode === targetMode) {
    return; // Already in correct mode
  }

  console.log(`[ContentBridge] Switching mode: ${currentMode} -> ${targetMode}`);

  // Click the combobox to open dropdown
  const combobox = window.veo3Selectors.getModeCombobox();
  if (!combobox) {
    console.warn('[ContentBridge] Mode combobox not found, proceeding without mode switch');
    return;
  }

  combobox.click();
  await sleep(500);

  // Find and click the target option in the dropdown
  const targetKeywords = MODE_KEYWORDS[targetMode] || [targetMode];
  const options = document.querySelectorAll('[role="option"], [role="menuitem"], [data-value]');

  let found = false;
  for (const option of options) {
    const optionText = option.textContent.trim().toLowerCase();
    for (const kw of targetKeywords) {
      if (optionText.includes(kw)) {
        option.click();
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    // Try listbox items
    const listItems = document.querySelectorAll('[role="listbox"] [role="option"]');
    for (const item of listItems) {
      const itemText = item.textContent.trim().toLowerCase();
      for (const kw of targetKeywords) {
        if (itemText.includes(kw)) {
          item.click();
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  if (!found) {
    // Close dropdown by pressing Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    console.warn(`[ContentBridge] Could not find mode option for "${targetMode}"`);
  }

  await sleep(500);
  notifySidepanel('MODE_CHANGED', { from: currentMode, to: targetMode });
}

// === SETTINGS ===

async function applyFixedSettings() {
  const { sleep } = window.veo3Timing;

  // Open settings panel
  const settingsBtn = window.veo3Selectors.settingsButton();
  if (!settingsBtn) {
    console.log('[ContentBridge] Settings button not found, skipping settings');
    return;
  }

  settingsBtn.click();
  await sleep(500);

  // Click Landscape tab
  const landscapeTab = document.querySelector(window.veo3Selectors.tabLandscape);
  if (landscapeTab) {
    landscapeTab.click();
    await sleep(200);
  }

  // Click x1 tab
  const count1Tab = document.querySelector(window.veo3Selectors.tabCount(1));
  if (count1Tab) {
    count1Tab.click();
    await sleep(200);
  }

  // Close settings (click settings button again or press Escape)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(300);

  console.log('[ContentBridge] Fixed settings applied (Landscape, x1)');
}

async function applySettings(data) {
  // Reserved for future custom settings
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
