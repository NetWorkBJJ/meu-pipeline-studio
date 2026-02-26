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
    clearButton: () => findButtonByIcon('close'),

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

    // --- Mode combobox (multi-strategy) ---
    modeCombobox: 'button[role="combobox"]',

    getModeCombobox: () => {
      // Mode-related keywords for filtering comboboxes
      const modeKeywords = [
        'video', 'image', 'element', 'texto', 'text', 'imagem',
        'elemento', 'criar', 'create', 'ingredients', 'frames', 'frame'
      ];

      // Strategy 1: role="combobox" with mode-related text
      const comboboxes = document.querySelectorAll('button[role="combobox"]');
      for (const cb of comboboxes) {
        if (cb.offsetParent === null) continue;
        const text = cb.textContent.trim().toLowerCase();
        if (modeKeywords.some(kw => text.includes(kw))) {
          window.veo3Debug?.debug('DOM', 'Mode combobox found: strategy 1 (text match)', { text });
          return cb;
        }
      }

      // Strategy 2: Radix combobox with aria-controls (used by Google Flow)
      const radixComboboxes = document.querySelectorAll('button[role="combobox"][aria-controls*="radix"]');
      for (const cb of radixComboboxes) {
        if (cb.offsetParent !== null) {
          window.veo3Debug?.debug('DOM', 'Mode combobox found: strategy 2 (radix)');
          return cb;
        }
      }

      // Strategy 3: aria-haspopup="listbox"
      const listboxTriggers = document.querySelectorAll('[aria-haspopup="listbox"]');
      for (const trigger of listboxTriggers) {
        if (trigger.offsetParent === null) continue;
        window.veo3Debug?.debug('DOM', 'Mode combobox found: strategy 3 (listbox)');
        return trigger;
      }

      // Strategy 4: Any visible dropdown-like button near the prompt area
      const promptArea = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID, [data-slate-editor="true"]');
      if (promptArea) {
        const container = promptArea.closest('[class]')?.parentElement?.parentElement;
        if (container) {
          const nearbyBtns = container.querySelectorAll('button[role="combobox"], button[aria-haspopup]');
          for (const btn of nearbyBtns) {
            if (btn.offsetParent !== null) {
              window.veo3Debug?.debug('DOM', 'Mode combobox found: strategy 4 (near prompt area)');
              return btn;
            }
          }
        }
      }

      // Strategy 5: First visible combobox (last resort)
      for (const cb of comboboxes) {
        if (cb.offsetParent !== null) {
          window.veo3Debug?.debug('DOM', 'Mode combobox found: strategy 5 (first visible)');
          return cb;
        }
      }

      window.veo3Debug?.warn('DOM', 'Mode combobox NOT found after 5 strategies');
      return null;
    },

    getModeComboboxes: () => findAllElements([
      'button[role="combobox"]',
      'button[role="combobox"][aria-controls*="radix"]',
      '[aria-haspopup="listbox"]'
    ]),

    // Selectors for dropdown options (Radix UI / native)
    getModeOptions: () => findAllElements([
      '[role="option"]',
      '[role="menuitem"]',
      '[data-radix-collection-item]',
      '[role="listbox"] [role="option"]',
      'li[role="option"]'
    ]),

    getCurrentModeText: () => {
      const modeKeywords = [
        'video', 'image', 'elemento', 'element', 'imagem', 'texto',
        'text', 'criar', 'create', 'ingredients', 'frames', 'frame'
      ];
      const comboboxes = findAllElements([
        'button[role="combobox"]',
        'button[role="combobox"][aria-controls*="radix"]',
        '[aria-haspopup="listbox"]'
      ]);
      for (const cb of comboboxes) {
        if (cb.offsetParent === null) continue;
        const text = cb.textContent.trim().toLowerCase();
        if (modeKeywords.some(kw => text.includes(kw))) {
          return text;
        }
      }
      return null;
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

    // --- Utility functions (exposed for external use) ---
    findElement,
    findAllElements,
    findButtonByIcon,
    findButtonByLabel,
    findSubmitButton
  };

  console.log('[Flow] Selectors loaded (Slate.js + Radix UI + Virtuoso)');
})();
