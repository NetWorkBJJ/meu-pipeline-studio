// selectors.js - DOM selectors for Google Flow (Slate.js + Radix UI + Virtuoso)
// IIFE-wrapped to prevent re-injection errors on SPA navigation

(function () {
  if (window.__veo3_selectors_loaded) return;
  window.__veo3_selectors_loaded = true;

  // === UTILITY FUNCTIONS ===

  function findElement(selectors, parent = document) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const sel of selectors) {
      try {
        const el = parent.querySelector(sel);
        if (el) return el;
      } catch (e) { /* invalid selector, skip */ }
    }
    return null;
  }

  // Accumulative: gathers results from ALL matching selectors (Set-based dedup)
  function findAllElements(selectors, parent = document) {
    if (typeof selectors === 'string') selectors = [selectors];
    const results = new Set();
    for (const sel of selectors) {
      try {
        const els = parent.querySelectorAll(sel);
        els.forEach(el => results.add(el));
      } catch (e) { /* skip */ }
    }
    return Array.from(results);
  }

  // Icon-based button search (google-symbols, material-icons)
  // Uses .includes() for partial match, checks visibility + disabled state
  function findButtonByIcon(iconText, parent = document) {
    const buttons = parent.querySelectorAll('button');

    // Priority 1: Google icon element (i.google-symbols is the primary class in Flow)
    for (const btn of buttons) {
      if (btn.offsetParent === null || btn.disabled) continue;
      const icon = btn.querySelector('i.google-symbols, i.material-icons, span.google-symbols');
      if (icon && icon.textContent.trim().includes(iconText)) {
        return btn;
      }
    }

    // Priority 2: aria-label fallback
    for (const btn of buttons) {
      if (btn.offsetParent === null || btn.disabled) continue;
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes(iconText.toLowerCase())) return btn;
    }

    return null;
  }

  // Label-based button search - uses .includes() for substring match
  function findButtonByLabel(labelText, parent = document) {
    const buttons = parent.querySelectorAll('button');
    const labelLower = labelText.toLowerCase();
    for (const btn of buttons) {
      if (btn.offsetParent === null || btn.disabled) continue;
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes(labelLower)) return btn;
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes(labelLower)) return btn;
    }
    return null;
  }

  // 3-tier submit button with visibility checks (from nardoto-flow)
  function findSubmitButton() {
    // PRIORITY 1: arrow_forward icon (primary VEO3 submit)
    const arrowBtn = findButtonByIcon('arrow_forward');
    if (arrowBtn) {
      window.veo3Debug?.debug('DOM', 'Submit button found: arrow_forward icon');
      return arrowBtn;
    }

    // PRIORITY 2: send icon
    const sendBtn = findButtonByIcon('send');
    if (sendBtn) {
      window.veo3Debug?.debug('DOM', 'Submit button found: send icon');
      return sendBtn;
    }

    // PRIORITY 3: By semantic attributes (excluding dialog-opening '+' button)
    const attrBtns = document.querySelectorAll(
      'button[type="submit"], button[aria-label*="send"], button[aria-label*="Send"], ' +
      'button[aria-label*="Criar"], button[aria-label*="Create"], ' +
      'button[aria-label*="Enviar"], button[aria-label*="Gerar"], button[aria-label*="Generate"]'
    );
    for (const btn of attrBtns) {
      if (btn.offsetParent === null || btn.disabled) continue;
      if (btn.getAttribute('aria-haspopup') === 'dialog') continue; // Skip '+' button
      window.veo3Debug?.debug('DOM', 'Submit button found: semantic attribute');
      return btn;
    }

    // PRIORITY 4: By text content (excluding dialog-opening '+' button)
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
      if (btn.offsetParent === null || btn.disabled) continue;
      if (btn.getAttribute('aria-haspopup') === 'dialog') continue; // Skip '+' button
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes('criar') || text.includes('create') ||
          text.includes('enviar') || text.includes('send') ||
          text.includes('gerar') || text.includes('generate')) {
        window.veo3Debug?.debug('DOM', 'Submit button found: text content "' + text + '"');
        return btn;
      }
    }

    window.veo3Debug?.warn('DOM', 'Submit button NOT found');
    return null;
  }

  // === SELECTOR DEFINITIONS ===

  window.veo3Selectors = {
    // --- Prompt area ---
    slateEditor: '[data-slate-editor="true"][contenteditable="true"]',
    textAreaFallback: '#PINHOLE_TEXT_AREA_ELEMENT_ID',
    submitButton: findSubmitButton,
    clearButton: () => {
      // Find the "Apagar comando" / "Delete command" button specifically
      // It has a visually-hidden span with that text + a google-symbols "close" icon
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.offsetParent === null || btn.disabled) continue;
        const hiddenSpan = btn.querySelector('span');
        if (hiddenSpan) {
          const spanText = hiddenSpan.textContent.trim().toLowerCase();
          if (spanText.includes('apagar comando') || spanText.includes('delete command') || spanText.includes('clear command')) {
            return btn;
          }
        }
      }
      // Fallback: any visible button with close icon
      return findButtonByIcon('close');
    },

    // --- Settings button (aspect ratio + count: "Video crop_16_9 x1") ---
    // MUST contain BOTH an aspect ratio icon (crop_16_9 or crop_9_16) AND count text (x1..x4).
    // This uniquely identifies the config button and NEVER matches the model selector ("Veo 3.1").
    settingsButton: () => {
      const menuBtns = document.querySelectorAll('button[aria-haspopup="menu"]');
      for (const btn of menuBtns) {
        if (btn.offsetParent === null || btn.disabled) continue;
        const text = btn.textContent.trim();
        const hasAspectIcon = text.includes('crop_16_9') || text.includes('crop_9_16');
        const hasCountText = /x[1-4]/.test(text);
        if (hasAspectIcon && hasCountText) {
          window.veo3Debug?.debug('DOM', 'Settings button found: aspect+count match', { text });
          return btn;
        }
      }
      window.veo3Debug?.warn('DOM', 'Settings button NOT found (no button has both aspect icon + count text)');
      return null;
    },

    // --- Model name extraction (from settings button text) ---
    // Text format: "Nano Banana Procrop_16_9x1" or "Veo 3.1-Fastcrop_16_9x1"
    // Returns everything before "crop_" (the model name)
    getActiveModelName: () => {
      const btn = window.veo3Selectors.settingsButton();
      if (!btn) return null;
      const text = btn.textContent.trim();
      const cropIndex = text.indexOf('crop_');
      if (cropIndex > 0) return text.substring(0, cropIndex).trim();
      return text;
    },

    // --- Mode detection (via settings button text) ---
    // Google Flow (Feb 2026): mode (Image/Video) is a TAB inside the settings dropdown,
    // NOT a standalone combobox. The settings button text reveals the active model:
    //   "Nano Banana 2" = IMAGE mode, "Veo 3.1" = VIDEO mode

    detectCurrentMode: () => {
      const btn = window.veo3Selectors.settingsButton();
      if (!btn) return null;
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes('nano banana') || text.includes('imagen')) return 'imagem';
      if (text.includes('veo')) return 'video';
      if (text.includes('image') || text.includes('imagem')) return 'imagem';
      if (text.includes('video') || text.includes('vídeo')) return 'video';
      window.veo3Debug?.warn('DOM', 'Cannot detect mode from settings button text: "' + text + '"');
      return null;
    },

    // Find mode tab inside the OPEN settings dropdown.
    // Must be called AFTER opening the settings dropdown via settingsButton.
    // Mode mapping: imagem -> IMAGE tab, texto/elementos -> VIDEO tab
    getModeTab: (mode) => {
      if (mode === 'imagem') {
        return document.querySelector('[role="tab"][aria-controls*="-content-IMAGE"]');
      }
      // texto and elementos both use VIDEO mode
      return document.querySelector('[role="tab"][aria-controls*="-content-VIDEO"]');
    },

    // --- Settings tabs (Radix UI with semantic aria-controls) ---
    // These appear inside the dropdown menu opened by the settings button
    tabVideo: '[role="tab"][aria-controls*="-content-VIDEO"]',
    tabImage: '[role="tab"][aria-controls*="-content-IMAGE"]',
    tabIngredients: '[role="tab"][aria-controls*="-content-VIDEO_REFERENCES"]',
    tabFrames: '[role="tab"][aria-controls*="-content-VIDEO_FRAMES"]',
    tabLandscape: '[role="tab"][aria-controls*="-content-LANDSCAPE"]',
    tabPortrait: '[role="tab"][aria-controls*="-content-PORTRAIT"]',
    tabCount: (n) => `[role="tab"][aria-controls*="-content-${n}"]`,

    // --- Media library (Virtuoso virtual scroll) ---
    addMediaButton: () => {
      // Strategy 1: Button with aria-haspopup="dialog" containing add_2 icon (specific '+' button)
      const dialogBtns = document.querySelectorAll('button[aria-haspopup="dialog"]');
      for (const btn of dialogBtns) {
        if (btn.offsetParent === null || btn.disabled) continue;
        const icon = btn.querySelector('i.google-symbols');
        if (icon && icon.textContent.trim() === 'add_2') {
          window.veo3Debug?.debug('DOM', 'Add media button found: aria-haspopup="dialog" + add_2');
          return btn;
        }
      }
      // Strategy 2: Fallback to icon search
      let btn = findButtonByIcon('add_2');
      if (btn) return btn;
      btn = findButtonByIcon('add');
      if (btn) return btn;
      return findButtonByLabel('add') || findButtonByLabel('adicionar');
    },
    mediaListItem: '[data-item-index]',
    getMediaItems: () => findAllElements(['[data-item-index]']),

    // --- Resource dialog (opened by '+' button) ---
    searchInput: 'input[placeholder="Pesquisar recursos"], input[placeholder="Search resources"]',
    dialogScroller: '[data-testid="virtuoso-scroller"][data-virtuoso-scroller="true"]',
    dialogContainer: '[role="dialog"][id^="radix-"]',

    // --- Reference image cards in prompt area ---
    referenceCards: '.reference-image-card, [class*="reference"] img, [class*="ingredient"] img',

    // --- Status indicators (for multi-signal submission verification) ---
    loadingIndicators: '[class*="loading"], [class*="spinner"], [class*="progress"], [class*="generating"], [aria-busy="true"]',

    // --- Generation failure detection (policy violation tiles) ---
    // Tiles with data-tile-id that contain a warning icon + failure text.
    // Used during batch pause to scan for failed generations and auto-retry.

    // Detect if a specific tile has a failure state (warning icon + failure text)
    detectTileFailure: (tile) => {
      const icons = tile.querySelectorAll('i.google-symbols, i.material-icons, span.google-symbols');
      let hasWarning = false;
      for (const icon of icons) {
        if (icon.textContent.trim() === 'warning') {
          hasWarning = true;
          break;
        }
      }
      if (!hasWarning) return false;

      const text = tile.textContent.toLowerCase();
      return text.includes('falha') ||
             text.includes('failed') ||
             text.includes('violar') ||
             text.includes('violate');
    },

    // Detect if a specific tile is in "generating/loading" state (retry worked, generation in progress)
    // Checks for progress_activity icon, which Google Flow renders as a spinning indicator.
    detectTileGenerating: (tile) => {
      const icons = tile.querySelectorAll('i.google-symbols, i.material-icons, span.google-symbols');
      for (const icon of icons) {
        if (icon.textContent.trim() === 'progress_activity') {
          return true;
        }
      }
      return false;
    },

    // Re-query a tile from the live DOM by its data-tile-id attribute.
    // Returns null if the tile no longer exists (was removed/replaced by React re-render).
    getTileById: (tileId) => {
      return document.querySelector('[data-tile-id="' + tileId + '"]');
    },

    // Return all tiles with generation failure
    failedTiles: () => {
      const tiles = document.querySelectorAll('[data-tile-id]');
      const failed = [];
      for (const tile of tiles) {
        if (window.veo3Selectors.detectTileFailure(tile)) {
          failed.push(tile);
        }
      }
      return failed;
    },

    // Find the retry button (refresh icon) inside a specific tile
    retryButton: (tile) => {
      const buttons = tile.querySelectorAll('button');
      for (const btn of buttons) {
        const icon = btn.querySelector('i.google-symbols, i.material-icons, span.google-symbols');
        if (icon && icon.textContent.trim() === 'refresh') {
          return btn;
        }
      }
      return null;
    },

    // --- Utility functions (exposed for external use) ---
    findElement,
    findAllElements,
    findButtonByIcon,
    findButtonByLabel,
    findSubmitButton
  };

  console.log('[Flow] Selectors loaded (Slate.js + Radix UI + Virtuoso)');
})();
