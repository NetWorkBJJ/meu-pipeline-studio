// selectors.js - DOM selectors for Google Flow (updated UI: Slate.js + Radix UI + Virtuoso)
// REWRITTEN for the Feb 2026 Flow update

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

function findAllElements(selectors, parent = document) {
  if (typeof selectors === 'string') selectors = [selectors];
  for (const sel of selectors) {
    try {
      const els = parent.querySelectorAll(sel);
      if (els.length > 0) return Array.from(els);
    } catch (e) { /* skip */ }
  }
  return [];
}

function findButtonByIcon(iconText, parent = document) {
  const buttons = parent.querySelectorAll('button');
  for (const btn of buttons) {
    const icons = btn.querySelectorAll('.material-symbols-outlined, .material-icons, [class*="icon"]');
    for (const icon of icons) {
      if (icon.textContent.trim() === iconText) return btn;
    }
    // Fallback: check direct text content for icon fonts
    if (btn.textContent.trim() === iconText && btn.children.length <= 1) return btn;
  }
  return null;
}

function findButtonByLabel(labelText, parent = document) {
  const buttons = parent.querySelectorAll('button');
  const labelLower = labelText.toLowerCase();
  for (const btn of buttons) {
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes(labelLower)) return btn;
    const text = btn.textContent.trim().toLowerCase();
    if (text === labelLower) return btn;
  }
  return null;
}

// === SELECTOR DEFINITIONS ===

window.veo3Selectors = {
  // --- Prompt area ---
  slateEditor: '[data-slate-editor="true"][contenteditable="true"]',
  submitButton: () => findButtonByIcon('arrow_forward'),
  clearButton: () => findButtonByIcon('close'),
  settingsButton: () => findButtonByIcon('tune'),

  // --- Mode combobox (Radix UI) ---
  modeCombobox: 'button[role="combobox"]',
  getModeComboboxes: () => findAllElements(['button[role="combobox"]']),

  // --- Settings tabs (Radix UI with semantic aria-controls) ---
  tabVideo: '[role="tab"][aria-controls*="VIDEO"]',
  tabImage: '[role="tab"][aria-controls*="IMAGE"]',
  tabLandscape: '[role="tab"][aria-controls*="LANDSCAPE"]',
  tabPortrait: '[role="tab"][aria-controls*="PORTRAIT"]',
  tabCount: (n) => `[role="tab"][aria-controls*="${n}"]`,

  // --- Media library (Virtuoso virtual scroll) ---
  addMediaButton: () => findButtonByIcon('add_2'),
  mediaListItem: '[data-item-index]',
  getMediaItems: () => findAllElements(['[data-item-index]']),

  // --- Reference image cards in prompt area ---
  referenceCards: '.reference-image-card, [class*="reference"] img, [class*="ingredient"] img',

  // --- Results area ---
  resultCards: '[data-item-index]',

  // --- Utility functions (exposed for external use) ---
  findElement,
  findAllElements,
  findButtonByIcon,
  findButtonByLabel,

  // --- Mode detection helpers ---
  getCurrentModeText: () => {
    const comboboxes = findAllElements(['button[role="combobox"]']);
    for (const cb of comboboxes) {
      const text = cb.textContent.trim().toLowerCase();
      if (text.includes('video') || text.includes('image') || text.includes('elemento') || text.includes('element') || text.includes('imagem') || text.includes('texto') || text.includes('text')) {
        return text;
      }
    }
    return null;
  },

  // Returns the combobox element that controls creation mode
  getModeCombobox: () => {
    const comboboxes = findAllElements(['button[role="combobox"]']);
    for (const cb of comboboxes) {
      const text = cb.textContent.trim().toLowerCase();
      if (text.includes('video') || text.includes('image') || text.includes('element') || text.includes('texto') || text.includes('text') || text.includes('imagem') || text.includes('elemento')) {
        return cb;
      }
    }
    return comboboxes[0] || null;
  }
};

console.log('[Flow] Selectors loaded (Slate.js + Radix UI + Virtuoso)');
