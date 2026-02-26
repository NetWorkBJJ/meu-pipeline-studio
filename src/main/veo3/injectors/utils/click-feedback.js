// click-feedback.js - Visual click feedback for automation debugging
// IIFE-wrapped to prevent re-injection errors on SPA navigation

(function () {
  if (window.__veo3_clickfb_loaded) return;
  window.__veo3_clickfb_loaded = true;

  const CLICK_FEEDBACK_CONFIG = {
    enabled: true,
    duration: 350,
    outlineWidth: '3px',
    outlineColor: '#ff0000',
    outlineStyle: 'solid',
    outlineOffset: '2px',
    useAnimation: true,
    zIndexBoost: 999999
  };

  const HIGHLIGHT_CLASS = 'veo3-click-highlight';
  const OVERLAY_CLASS = 'veo3-click-overlay';

  function injectClickFeedbackStyles() {
    if (document.getElementById('veo3-click-feedback-styles')) return;

    const style = document.createElement('style');
    style.id = 'veo3-click-feedback-styles';
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: ${CLICK_FEEDBACK_CONFIG.outlineWidth} ${CLICK_FEEDBACK_CONFIG.outlineStyle} ${CLICK_FEEDBACK_CONFIG.outlineColor} !important;
        outline-offset: ${CLICK_FEEDBACK_CONFIG.outlineOffset} !important;
        z-index: ${CLICK_FEEDBACK_CONFIG.zIndexBoost} !important;
        position: relative;
      }
      @keyframes veo3-click-pulse {
        0% { outline-color: ${CLICK_FEEDBACK_CONFIG.outlineColor}; outline-width: ${CLICK_FEEDBACK_CONFIG.outlineWidth}; }
        50% { outline-color: #ff6666; outline-width: 4px; }
        100% { outline-color: transparent; outline-width: ${CLICK_FEEDBACK_CONFIG.outlineWidth}; }
      }
      .${HIGHLIGHT_CLASS}.veo3-animate {
        animation: veo3-click-pulse ${CLICK_FEEDBACK_CONFIG.duration}ms ease-out forwards !important;
      }
      .${OVERLAY_CLASS} {
        position: fixed;
        pointer-events: none;
        border: ${CLICK_FEEDBACK_CONFIG.outlineWidth} ${CLICK_FEEDBACK_CONFIG.outlineStyle} ${CLICK_FEEDBACK_CONFIG.outlineColor};
        border-radius: 4px;
        z-index: ${CLICK_FEEDBACK_CONFIG.zIndexBoost};
        box-sizing: border-box;
        animation: veo3-overlay-fade ${CLICK_FEEDBACK_CONFIG.duration}ms ease-out forwards;
      }
      @keyframes veo3-overlay-fade {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.02); }
        100% { opacity: 0; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  function createOverlay(rect) {
    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.style.cssText = `
      top: ${rect.top - 2}px;
      left: ${rect.left - 2}px;
      width: ${rect.width + 4}px;
      height: ${rect.height + 4}px;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => { if (overlay.parentElement) overlay.remove(); }, CLICK_FEEDBACK_CONFIG.duration + 50);
    return overlay;
  }

  async function highlightElement(element, options = {}) {
    if (!CLICK_FEEDBACK_CONFIG.enabled || !element) return;
    const config = { ...CLICK_FEEDBACK_CONFIG, ...options };
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    createOverlay(rect);
    element.classList.add(HIGHLIGHT_CLASS);
    if (config.useAnimation) element.classList.add('veo3-animate');

    await new Promise(resolve => setTimeout(resolve, config.duration));
    if (document.body.contains(element)) {
      element.classList.remove(HIGHLIGHT_CLASS, 'veo3-animate');
    }
  }

  async function clickWithFeedback(element, options = {}) {
    if (!element) return false;
    const { waitForHighlight = false } = options;

    if (CLICK_FEEDBACK_CONFIG.enabled) {
      if (waitForHighlight) {
        await highlightElement(element);
        element.click();
      } else {
        highlightElement(element);
        element.click();
      }
    } else {
      element.click();
    }
    return true;
  }

  async function dispatchWithFeedback(element, events) {
    if (!element) return false;
    if (CLICK_FEEDBACK_CONFIG.enabled) highlightElement(element);
    for (const event of events) element.dispatchEvent(event);
    return true;
  }

  function setClickFeedbackEnabled(enabled) {
    CLICK_FEEDBACK_CONFIG.enabled = enabled;
    console.log('[ClickFeedback] Enabled:', enabled);
  }

  function configureClickFeedback(config) {
    Object.assign(CLICK_FEEDBACK_CONFIG, config);
  }

  injectClickFeedbackStyles();

  window.veo3ClickFeedback = {
    CLICK_FEEDBACK_CONFIG,
    highlightElement,
    clickWithFeedback,
    dispatchWithFeedback,
    setClickFeedbackEnabled,
    configureClickFeedback,
    injectClickFeedbackStyles
  };

  window.veo3Click = clickWithFeedback;
  window.veo3Highlight = highlightElement;

  console.log('[Flow] Click feedback loaded');
})();
