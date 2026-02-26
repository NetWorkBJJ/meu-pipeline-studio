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
      .veo3-click-circle {
        position: fixed;
        pointer-events: none;
        border: 3px solid #ff0000;
        border-radius: 50%;
        z-index: ${CLICK_FEEDBACK_CONFIG.zIndexBoost};
        box-sizing: border-box;
        animation: veo3-circle-fade 600ms ease-out forwards;
      }
      @keyframes veo3-circle-fade {
        0% { opacity: 1; transform: scale(0.8); }
        50% { opacity: 0.7; transform: scale(1.3); }
        100% { opacity: 0; transform: scale(1.6); }
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

  function createCircleOverlay(rect) {
    const circle = document.createElement('div');
    circle.className = 'veo3-click-circle';
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.max(rect.width, rect.height, 40);
    circle.style.cssText = `
      left: ${cx - radius / 2}px;
      top: ${cy - radius / 2}px;
      width: ${radius}px;
      height: ${radius}px;
    `;
    document.body.appendChild(circle);
    setTimeout(() => { if (circle.parentElement) circle.remove(); }, 650);
    return circle;
  }

  async function highlightElement(element, options = {}) {
    if (!CLICK_FEEDBACK_CONFIG.enabled || !element) return;
    const config = { ...CLICK_FEEDBACK_CONFIG, ...options };
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    createOverlay(rect);
    createCircleOverlay(rect);
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

  /**
   * Robust click: .click() + full mousedown/mouseup/click event sequence.
   * Google Flow (React/Angular) needs the full event chain to register clicks.
   * After triple dispatch, optionally focuses element and sends Enter key.
   */
  async function robustClick(element, options = {}) {
    if (!element) return false;
    const { sendEnter = false, focusFirst = false } = options;

    if (CLICK_FEEDBACK_CONFIG.enabled) highlightElement(element);

    // Ensure element is visible and scrolled into view
    if (element.scrollIntoView) {
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
    }

    // Step 1: Native .click()
    element.click();

    // Step 2: Full mousedown -> mouseup -> click event sequence with coordinates
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const eventInit = {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: cx,
      clientY: cy,
      screenX: cx,
      screenY: cy
    };

    element.dispatchEvent(new MouseEvent('mousedown', eventInit));
    element.dispatchEvent(new MouseEvent('mouseup', eventInit));
    element.dispatchEvent(new MouseEvent('click', eventInit));

    // Step 3: Optional focus + Enter (for buttons that need keyboard confirmation)
    if (focusFirst || sendEnter) {
      element.focus();
    }

    if (sendEnter) {
      await new Promise(r => setTimeout(r, 50));
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
      }));
      element.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
      }));
    }

    return true;
  }

  /**
   * Click for Radix UI components (DropdownMenu, Popover, etc.)
   * Radix UI listens to onPointerDown, NOT onClick or onMouseDown.
   * A regular .click() or mousedown dispatch will NOT open Radix menus.
   */
  async function radixClick(element) {
    if (!element) return false;
    if (CLICK_FEEDBACK_CONFIG.enabled) highlightElement(element);

    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const opts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      isPrimary: true,
      clientX: cx,
      clientY: cy,
      screenX: cx,
      screenY: cy
    };

    element.dispatchEvent(new PointerEvent('pointerdown', opts));
    await new Promise(r => setTimeout(r, 100));
    element.dispatchEvent(new PointerEvent('pointerup', opts));
    await new Promise(r => setTimeout(r, 50));
    // Also dispatch click for any non-Radix handlers that listen to click
    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, button: 0,
      clientX: cx, clientY: cy
    }));

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
    robustClick,
    dispatchWithFeedback,
    setClickFeedbackEnabled,
    configureClickFeedback,
    injectClickFeedbackStyles
  };

  window.veo3Click = clickWithFeedback;
  window.veo3RobustClick = robustClick;
  window.veo3RadixClick = radixClick;
  window.veo3Highlight = highlightElement;

  console.log('[Flow] Click feedback loaded');
})();
