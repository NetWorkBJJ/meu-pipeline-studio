// click-logger.js - Click flow logger for automation debugging
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Wraps robustClick/radixClick/veo3Click with sequential logging
// Reads window.__veo3_phase (set by content-bridge.js) for phase context

(function () {
  if (window.__veo3_clicklog_loaded) return;
  window.__veo3_clicklog_loaded = true;

  let clickCounter = 0;
  const clickLog = [];

  // Extract human-readable description from a DOM element
  function describeElement(el) {
    if (!el) return '(null)';
    const parts = [];

    // Tag
    parts.push(el.tagName.toLowerCase());

    // Role
    const role = el.getAttribute('role');
    if (role) parts.push('[role=' + role + ']');

    // aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) parts.push('aria="' + ariaLabel.substring(0, 40) + '"');

    // aria-haspopup
    const haspopup = el.getAttribute('aria-haspopup');
    if (haspopup) parts.push('haspopup=' + haspopup);

    // Icon text (google-symbols)
    const icon = el.querySelector('i.google-symbols, i.material-icons, span.google-symbols');
    if (icon) parts.push('icon="' + icon.textContent.trim() + '"');

    // Hidden span text (like "Apagar comando")
    const spans = el.querySelectorAll('span');
    for (const span of spans) {
      const spanText = span.textContent.trim();
      if (spanText.length > 0 && spanText.length < 50 && span !== icon) {
        parts.push('span="' + spanText + '"');
        break;
      }
    }

    // Text content (fallback, short) - only if no icon or span found
    if (!ariaLabel && !icon && spans.length === 0) {
      const text = el.textContent.trim().substring(0, 50);
      if (text) parts.push('"' + text + '"');
    }

    // data-item-index (gallery items)
    const itemIdx = el.getAttribute('data-item-index');
    if (itemIdx !== null) parts.push('item-index=' + itemIdx);

    // aria-controls (for tabs)
    const controls = el.getAttribute('aria-controls');
    if (controls) parts.push('controls="' + controls.substring(0, 50) + '"');

    return parts.join(' ');
  }

  // Wrap a click function with logging
  function wrapClickFn(originalFn, methodName) {
    return async function loggedClick(element, ...args) {
      clickCounter++;
      const phase = window.__veo3_phase || 'UNKNOWN';
      const desc = describeElement(element);
      const entry = {
        step: clickCounter,
        phase,
        method: methodName,
        element: desc,
        timestamp: Date.now(),
        success: null
      };

      console.log(
        '[CLICK #' + String(clickCounter).padStart(2, '0') + '] ' +
        '[' + phase + '] ' +
        methodName + ' -> ' + desc
      );

      try {
        const result = await originalFn(element, ...args);
        entry.success = true;
        clickLog.push(entry);
        return result;
      } catch (err) {
        entry.success = false;
        entry.error = err.message;
        clickLog.push(entry);
        console.log(
          '[CLICK #' + String(clickCounter).padStart(2, '0') + '] FAILED: ' + err.message
        );
        throw err;
      }
    };
  }

  // Log native .click() calls on elements within automation
  // Call this BEFORE element.click() for tabs and other native clicks
  function logNativeClick(element, phase, context) {
    clickCounter++;
    const desc = describeElement(element);
    console.log(
      '[CLICK #' + String(clickCounter).padStart(2, '0') + '] ' +
      '[' + (phase || window.__veo3_phase || 'UNKNOWN') + '] ' +
      '.click() -> ' + desc +
      (context ? ' (' + context + ')' : '')
    );
    clickLog.push({
      step: clickCounter,
      phase: phase || window.__veo3_phase || 'UNKNOWN',
      method: '.click()',
      element: desc,
      context,
      timestamp: Date.now(),
      success: true
    });
  }

  // Wrap existing click functions with logging versions
  // Uses a Set to track which functions have already been wrapped (prevents double-wrap)
  const wrapped = new Set();

  function wrapClickFunctions() {
    if (window.veo3RobustClick && !wrapped.has('robustClick')) {
      const orig = window.veo3RobustClick;
      window.veo3RobustClick = wrapClickFn(orig, 'robustClick');
      wrapped.add('robustClick');
    }
    if (window.veo3RadixClick && !wrapped.has('radixClick')) {
      const orig = window.veo3RadixClick;
      window.veo3RadixClick = wrapClickFn(orig, 'radixClick');
      wrapped.add('radixClick');
    }
    if (window.veo3Click && !wrapped.has('clickWithFeedback')) {
      const orig = window.veo3Click;
      window.veo3Click = wrapClickFn(orig, 'clickWithFeedback');
      wrapped.add('clickWithFeedback');
    }
  }

  // Try immediately, then retry (click-feedback may load after this script)
  wrapClickFunctions();
  setTimeout(wrapClickFunctions, 500);
  setTimeout(wrapClickFunctions, 2000);

  // Print full summary of all clicks (called at end of automation)
  function printClickSummary() {
    console.log('=== CLICK FLOW SUMMARY (' + clickLog.length + ' clicks) ===');
    for (const entry of clickLog) {
      const status = entry.success ? 'OK' : 'FAIL';
      console.log(
        '#' + String(entry.step).padStart(2, '0') +
        ' [' + entry.phase + '] ' +
        entry.method + ' -> ' + entry.element +
        (entry.context ? ' (' + entry.context + ')' : '') +
        ' [' + status + ']'
      );
    }
    console.log('=== END SUMMARY ===');
  }

  // Reset counter and log (called at start of each automation run)
  function resetClickLog() {
    clickCounter = 0;
    clickLog.length = 0;
    console.log('[ClickLogger] Log reset');
  }

  window.veo3ClickLogger = {
    clickLog,
    logNativeClick,
    printClickSummary,
    resetClickLog,
    describeElement,
    getClickCount: () => clickCounter
  };

  console.log('[Flow] Click logger loaded');
})();
