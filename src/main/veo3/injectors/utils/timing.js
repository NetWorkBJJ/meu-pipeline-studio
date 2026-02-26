// timing.js - Timing utilities for Flow automation
// IIFE-wrapped to prevent re-injection errors on SPA navigation

(function () {
  if (window.__veo3_timing_loaded) return;
  window.__veo3_timing_loaded = true;

  const TIMING = {
    MICRO: 100,
    SHORT: 300,
    MEDIUM: 500,
    STANDARD: 1000,
    NETWORK: 1500,
    UPLOAD: 2000,
    PROCESSING: 3000,
    GENERATION: 5000,
    ELEMENT_TIMEOUT: 10000,
    NETWORK_TIMEOUT: 30000,
    GENERATION_TIMEOUT: 300000,
    POLL_FAST: 100,
    POLL_NORMAL: 500,
    POLL_SLOW: 1000,
    // Batch pauses
    BATCH_PAUSE_VIDEO: 60000,
    BATCH_PAUSE_IMAGE: 27000,
    BETWEEN_COMMANDS: 2000,
    AFTER_SUBMIT: 1000,
    AFTER_MODE_SWITCH: 1000,
    AFTER_FILL: 500
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitForElement(selector, timeout = TIMING.ELEMENT_TIMEOUT, parent = document) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = parent.querySelector(selector);
      if (element) return element;
      await sleep(TIMING.POLL_FAST);
    }
    return null;
  }

  async function waitForAnyElement(selectors, timeout = TIMING.ELEMENT_TIMEOUT, parent = document) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      for (const selector of selectors) {
        const element = parent.querySelector(selector);
        if (element) return element;
      }
      await sleep(TIMING.POLL_FAST);
    }
    return null;
  }

  async function waitForElementToDisappear(selector, timeout = TIMING.ELEMENT_TIMEOUT, parent = document) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = parent.querySelector(selector);
      if (!element) return true;
      await sleep(TIMING.POLL_NORMAL);
    }
    return false;
  }

  async function withTimeout(fn, timeout, errorMessage = 'Timeout') {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeout)
      )
    ]);
  }

  // === RESOURCE TRACKING ===

  const activeResources = {
    intervals: new Map(),
    observers: new Map(),
    timeouts: new Map()
  };

  function createTrackedInterval(id, callback, ms) {
    if (activeResources.intervals.has(id)) {
      clearInterval(activeResources.intervals.get(id));
    }
    const intervalId = setInterval(callback, ms);
    activeResources.intervals.set(id, intervalId);
    return intervalId;
  }

  function stopTrackedInterval(id) {
    if (activeResources.intervals.has(id)) {
      clearInterval(activeResources.intervals.get(id));
      activeResources.intervals.delete(id);
    }
  }

  function createTrackedObserver(id, callback, target, options) {
    if (activeResources.observers.has(id)) {
      activeResources.observers.get(id).disconnect();
    }
    const observer = new MutationObserver(callback);
    observer.observe(target, options);
    activeResources.observers.set(id, observer);
    return observer;
  }

  function disconnectTrackedObserver(id) {
    if (activeResources.observers.has(id)) {
      activeResources.observers.get(id).disconnect();
      activeResources.observers.delete(id);
    }
  }

  function cleanupAllResources() {
    for (const [, intervalId] of activeResources.intervals) clearInterval(intervalId);
    activeResources.intervals.clear();
    for (const [, observer] of activeResources.observers) observer.disconnect();
    activeResources.observers.clear();
    for (const [, timeoutId] of activeResources.timeouts) clearTimeout(timeoutId);
    activeResources.timeouts.clear();
    console.log('[Flow] All resources cleaned up');
  }

  // === REACT VALUE SETTER ===

  async function setReactValue(element, value, options = {}) {
    const { clear = true, focus = true, blur = false, delay = 10 } = options;
    if (!element) {
      console.warn('[setReactValue] Element not provided');
      return false;
    }

    try {
      const isTextArea = element.tagName.toLowerCase() === 'textarea';
      const prototype = isTextArea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

      if (!nativeInputValueSetter) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }

      if (focus) {
        element.focus();
        await sleep(delay);
      }

      if (clear) {
        nativeInputValueSetter.call(element, '');
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(delay);
      }

      nativeInputValueSetter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      await sleep(delay);
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      await sleep(delay);

      // Force re-render trick
      const currentValue = element.value;
      nativeInputValueSetter.call(element, currentValue + ' ');
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(delay);
      nativeInputValueSetter.call(element, currentValue);
      element.dispatchEvent(new Event('input', { bubbles: true }));

      if (blur) {
        await sleep(delay);
        element.blur();
      }

      console.log('[setReactValue] Field filled:', value.substring(0, 40) + '...');
      return true;
    } catch (error) {
      console.warn('[setReactValue] Error, using fallback:', error.message);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }

  // === SHARED SLATE.JS EDITOR FILL ===
  // Used by content-bridge, elements-handler, and image-creation-handler
  // Strategy 1: ClipboardEvent paste (less intrusive for Slate)
  // Strategy 2: execCommand insertText fallback

  async function fillSlateEditor(text) {
    window.veo3Debug?.debug('DOM', 'Filling Slate editor', { textLength: text.length });

    const editor = await waitForElement(
      window.veo3Selectors?.slateEditor || '[data-slate-editor="true"][contenteditable="true"]'
    );
    if (!editor) {
      // Fallback: try legacy textarea
      const textArea = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
      if (textArea) {
        window.veo3Debug?.debug('DOM', 'Using legacy textarea fallback');
        await setReactValue(textArea, text, { clear: true, focus: true, delay: 50 });
        return;
      }
      window.veo3Debug?.error('DOM', 'Slate editor not found');
      throw new Error('Slate editor not found');
    }

    editor.focus();
    await sleep(200);

    // Clear existing content
    document.execCommand('selectAll', false, null);
    await sleep(100);
    document.execCommand('delete', false, null);
    await sleep(200);

    // Strategy 1: Clipboard API (less intrusive for Slate.js)
    try {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboardData
      });
      editor.dispatchEvent(pasteEvent);
      await sleep(TIMING.AFTER_FILL);

      // Verify text was inserted
      if (editor.textContent.trim().length > 0) {
        console.log('[fillSlateEditor] Text inserted via clipboard paste');
        return;
      }
    } catch (e) {
      console.warn('[fillSlateEditor] Clipboard paste failed, trying execCommand:', e.message);
    }

    // Strategy 2: execCommand fallback (works but may cause Slate warning)
    document.execCommand('insertText', false, text);
    await sleep(TIMING.AFTER_FILL);
    console.log('[fillSlateEditor] Text inserted via execCommand');
  }

  // === MULTI-SIGNAL SUBMISSION VERIFICATION ===
  // Checks 4 signals: editor cleared, loading spinner, aria-busy, submit button state

  async function checkSubmissionSuccess(timeout = 15000) {
    window.veo3Debug?.debug('SUBMIT', 'Checking submission signals', { timeout });
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Signal 1: Editor cleared (Flow clears editor after accepting prompt)
      const editorSelector = window.veo3Selectors?.slateEditor || '[data-slate-editor="true"][contenteditable="true"]';
      const editor = document.querySelector(editorSelector);
      if (editor) {
        const text = editor.textContent.trim();
        if (text === '' || text.length < 5) {
          window.veo3Debug?.info('SUBMIT', 'Editor cleared - submission confirmed');
          return true;
        }
      }

      // Signal 2: Loading indicators appeared
      const loadingSel = window.veo3Selectors?.loadingIndicators ||
        '[class*="loading"], [class*="spinner"], [class*="progress"], [class*="generating"], [aria-busy="true"]';
      const loadingEl = document.querySelector(loadingSel);
      if (loadingEl) {
        console.log('[checkSubmissionSuccess] Loading indicator detected - submission confirmed');
        return true;
      }

      // Signal 3: Submit button became disabled or changed text
      const submitBtn = window.veo3Selectors?.submitButton?.();
      if (submitBtn && submitBtn.disabled) {
        console.log('[checkSubmissionSuccess] Submit button disabled - submission confirmed');
        return true;
      }

      // Signal 4: Success text indicators
      const successTexts = ['success', 'sucesso', 'created', 'criado', 'generated', 'gerado', 'processing'];
      const allText = document.body.innerText?.toLowerCase() || '';
      for (const st of successTexts) {
        // Only check in recent DOM changes (rough heuristic: check small areas)
        const alerts = document.querySelectorAll('[role="alert"], [class*="toast"], [class*="notification"]');
        for (const alert of alerts) {
          if (alert.textContent.toLowerCase().includes(st)) {
            console.log('[checkSubmissionSuccess] Success indicator found:', st);
            return true;
          }
        }
      }

      await sleep(TIMING.POLL_NORMAL);
    }

    console.warn('[checkSubmissionSuccess] Verification timed out');
    return false;
  }

  // === SUBMIT WITH RETRY CHAIN ===
  // 4-level: button click -> form submit -> Enter key -> retry

  async function submitWithRetry() {
    window.veo3Debug?.info('SUBMIT', 'Starting retry chain');

    // Level 1: Click submit button
    const submitBtn = window.veo3Selectors?.submitButton?.();
    window.veo3Debug?.debug('SUBMIT', 'Level 1: button click', { found: !!submitBtn });
    if (submitBtn) {
      if (window.veo3ClickFeedback) {
        await window.veo3ClickFeedback.clickWithFeedback(submitBtn);
      } else {
        submitBtn.click();
      }
      await sleep(TIMING.AFTER_SUBMIT);

      if (await checkSubmissionSuccess(5000)) return true;
      window.veo3Debug?.debug('SUBMIT', 'Level 1 failed, trying form submit');
    }

    // Level 2: Try form submit
    const form = document.querySelector('form');
    window.veo3Debug?.debug('SUBMIT', 'Level 2: form submit', { found: !!form });
    if (form) {
      try {
        form.requestSubmit?.() || form.submit();
        await sleep(TIMING.AFTER_SUBMIT);
        if (await checkSubmissionSuccess(5000)) return true;
      } catch (e) {
        window.veo3Debug?.warn('SUBMIT', 'Form submit error: ' + e.message);
      }
      window.veo3Debug?.debug('SUBMIT', 'Level 2 failed, trying Enter key');
    }

    // Level 3: Enter key dispatch
    const editorSelector = window.veo3Selectors?.slateEditor || '[data-slate-editor="true"][contenteditable="true"]';
    const editor = document.querySelector(editorSelector);
    const target = editor || document.activeElement || document.body;

    const enterEvents = [
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }),
      new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }),
      new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })
    ];

    for (const evt of enterEvents) {
      target.dispatchEvent(evt);
      await sleep(50);
    }
    await sleep(TIMING.AFTER_SUBMIT);

    if (await checkSubmissionSuccess(5000)) return true;
    window.veo3Debug?.debug('SUBMIT', 'Level 3 failed, final retry');

    // Level 4: Final retry - click submit button again
    const retryBtn = window.veo3Selectors?.submitButton?.();
    window.veo3Debug?.debug('SUBMIT', 'Level 4: final button retry', { found: !!retryBtn });
    if (retryBtn) {
      retryBtn.click();
      await sleep(TIMING.AFTER_SUBMIT);
      return await checkSubmissionSuccess(8000);
    }

    window.veo3Debug?.error('SUBMIT', 'All submission strategies failed');
    return false;
  }

  // === EXPORT ===

  window.veo3Timing = {
    TIMING,
    sleep,
    waitForElement,
    waitForAnyElement,
    waitForElementToDisappear,
    withTimeout,
    setReactValue,
    fillSlateEditor,
    checkSubmissionSuccess,
    submitWithRetry,
    createTrackedInterval,
    stopTrackedInterval,
    createTrackedObserver,
    disconnectTrackedObserver,
    cleanupAllResources,
    activeResources
  };

  console.log('[Flow] Timing utils loaded');
})();
