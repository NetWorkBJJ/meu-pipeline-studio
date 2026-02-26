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

    // PRIORITY 3: By semantic attributes
    const attrBtns = document.querySelectorAll(
      'button[type="submit"], button[aria-label*="send"], button[aria-label*="Send"], ' +
      'button[aria-label*="Criar"], button[aria-label*="Create"], ' +
      'button[aria-label*="Enviar"], button[aria-label*="Gerar"], button[aria-label*="Generate"]'
    );
    for (const btn of attrBtns) {
      if (btn.offsetParent !== null && !btn.disabled) {
        window.veo3Debug?.debug('DOM', 'Submit button found: semantic attribute');
        return btn;
      }
    }

    // PRIORITY 4: By text content
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
      if (btn.offsetParent === null || btn.disabled) continue;
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

    // --- Settings button (multi-fallback) ---
    settingsButton: () => {
      const tuneBtn = findButtonByIcon('tune');
      if (tuneBtn) return tuneBtn;
      const settingsBtn = findButtonByIcon('settings');
      if (settingsBtn) return settingsBtn;
      return findButtonByLabel('config') || findButtonByLabel('settings') || findButtonByLabel('tune');
    },

    // --- Mode combobox (multi-strategy) ---
    modeCombobox: 'button[role="combobox"]',

    getModeCombobox: () => {
      // Strategy 1: role="combobox" with mode-related text
      const comboboxes = document.querySelectorAll('button[role="combobox"]');
      for (const cb of comboboxes) {
        if (cb.offsetParent === null) continue;
        const text = cb.textContent.trim().toLowerCase();
        if (text.includes('video') || text.includes('image') || text.includes('element') ||
            text.includes('texto') || text.includes('text') || text.includes('imagem') ||
            text.includes('elemento') || text.includes('criar')) {
          window.veo3Debug?.debug('DOM', 'Mode combobox found: strategy 1', { text });
          return cb;
        }
      }

      // Strategy 2: aria-haspopup="listbox"
      const listboxTriggers = document.querySelectorAll('[aria-haspopup="listbox"]');
      for (const trigger of listboxTriggers) {
        if (trigger.offsetParent === null) continue;
        window.veo3Debug?.debug('DOM', 'Mode combobox found: strategy 2 (listbox)');
        return trigger;
      }

      // Strategy 3: First visible combobox
      for (const cb of comboboxes) {
        if (cb.offsetParent !== null) {
          window.veo3Debug?.debug('DOM', 'Mode combobox found: strategy 3 (first visible)');
          return cb;
        }
      }

      window.veo3Debug?.warn('DOM', 'Mode combobox NOT found');
      return null;
    },

    getModeComboboxes: () => findAllElements(['button[role="combobox"]', '[aria-haspopup="listbox"]']),

    getCurrentModeText: () => {
      const comboboxes = findAllElements(['button[role="combobox"]', '[aria-haspopup="listbox"]']);
      for (const cb of comboboxes) {
        if (cb.offsetParent === null) continue;
        const text = cb.textContent.trim().toLowerCase();
        if (text.includes('video') || text.includes('image') || text.includes('elemento') ||
            text.includes('element') || text.includes('imagem') || text.includes('texto') ||
            text.includes('text') || text.includes('criar')) {
          return text;
        }
      }
      return null;
    },

    // --- Settings tabs (Radix UI with semantic aria-controls) ---
    tabVideo: '[role="tab"][aria-controls*="VIDEO"]',
    tabImage: '[role="tab"][aria-controls*="IMAGE"]',
    tabLandscape: '[role="tab"][aria-controls*="LANDSCAPE"]',
    tabPortrait: '[role="tab"][aria-controls*="PORTRAIT"]',
    tabCount: (n) => `[role="tab"][aria-controls*="${n}"]`,

    // --- Media library (Virtuoso virtual scroll) ---
    addMediaButton: () => {
      let btn = findButtonByIcon('add_2');
      if (btn) return btn;
      btn = findButtonByIcon('add');
      if (btn) return btn;
      return findButtonByLabel('add') || findButtonByLabel('adicionar');
    },
    mediaListItem: '[data-item-index]',
    getMediaItems: () => findAllElements(['[data-item-index]']),

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
