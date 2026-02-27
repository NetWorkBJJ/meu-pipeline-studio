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
    // Batch pause (fixed 45s between all slots)
    BATCH_PAUSE: 45000,
    BETWEEN_COMMANDS: 2000,
    AFTER_SUBMIT: 500,
    AFTER_MODE_SWITCH: 1000,
    MODE_VERIFY_TIMEOUT: 5000,
    AFTER_FILL: 300
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

  // === PROMPT FIELD FILL ===
  // Used by content-bridge, elements-handler, and image-creation-handler
  // Strategy 1: #PINHOLE_TEXT_AREA_ELEMENT_ID (primary - React textarea used by Google Flow)
  // Strategy 2: Slate.js contenteditable editor (fallback)
  // Based on nardoto-flow reference which uses #PINHOLE_TEXT_AREA_ELEMENT_ID as the main target

  async function fillSlateEditor(text) {
    window.veo3Debug?.debug('DOM', 'Filling prompt field', { textLength: text.length });

    // Strategy 1: Use #PINHOLE_TEXT_AREA_ELEMENT_ID (primary target in Google Flow)
    const textArea = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
    if (textArea) {
      window.veo3Debug?.debug('DOM', 'Using #PINHOLE_TEXT_AREA_ELEMENT_ID (primary)');
      await setReactValue(textArea, text, { clear: true, focus: true, blur: true, delay: 30 });
      await sleep(TIMING.AFTER_FILL);
      console.log('[fillSlateEditor] Text inserted via #PINHOLE_TEXT_AREA_ELEMENT_ID');
      return;
    }

    // Strategy 2: Slate.js contenteditable editor (fallback)
    const editor = await waitForElement(
      window.veo3Selectors?.slateEditor || '[data-slate-editor="true"][contenteditable="true"]',
      5000
    );
    if (editor) {
      window.veo3Debug?.debug('DOM', 'Using Slate editor (fallback)');
      editor.focus();
      await sleep(150);

      // Clear any existing text first (from failed previous submission).
      // The clear button ("Apagar comando") is only visible when editor has content.
      const hasExistingText = editor.querySelector('[data-slate-string="true"]');
      if (hasExistingText && hasExistingText.textContent.trim().length > 0) {
        console.log('[fillSlateEditor] Clearing existing text before fill');
        const clearBtn = window.veo3Selectors.clearButton();
        if (clearBtn) {
          await window.veo3RobustClick(clearBtn);
          await sleep(TIMING.SHORT);
          editor.focus();
          await sleep(150);
        }
      }

      // DO NOT use selectAll or Selection API - both crash Slate's selectionchange handler.
      // selectAll selects the placeholder span (contenteditable=false) which isn't in Slate's
      // WeakMap. The handler runs via setTimeout, and by then React may have re-rendered
      // the DOM nodes, making old references stale -> "Cannot resolve a Slate node".
      //
      // After focus(), Slate's onFocusIn sets a valid internal selection (start of doc).
      // execCommand('insertText') fires a trusted beforeinput event. Slate intercepts it
      // and calls Transforms.insertText(editor, text) using its OWN internal selection,
      // not the browser's. This correctly updates the model -> React re-renders -> submit works.

      let filled = false;

      // Strategy 2a: execCommand('insertText') at cursor position (no selectAll needed).
      // Slate's beforeinput handler intercepts and uses its internal selection.
      document.execCommand('insertText', false, text);
      await sleep(TIMING.AFTER_FILL);

      if (editor.textContent.trim().length > 0) {
        console.log('[fillSlateEditor] Text inserted via execCommand insertText');
        filled = true;
      }

      // Strategy 2b: Clipboard paste fallback (if execCommand didn't work)
      if (!filled) {
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

          if (editor.textContent.trim().length > 0) {
            console.log('[fillSlateEditor] Text inserted via clipboard paste');
            filled = true;
          }
        } catch (e) {
          console.warn('[fillSlateEditor] Clipboard paste failed:', e.message);
        }
      }

      // Strategy 2c: Direct textContent + InputEvent (last resort, nardoto-flow pattern)
      if (!filled) {
        editor.textContent = text;
        editor.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));
        await sleep(TIMING.AFTER_FILL);
        console.log('[fillSlateEditor] Text inserted via direct textContent + InputEvent');
        filled = true;
      }

      // Reinforce: dispatch InputEvent to ensure React state recognizes content.
      // Pattern from nardoto-flow: "Simula um espaco para ativar o botao de envio"
      // Simulates space + backspace to trigger React state update that enables submit button.
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'insertText', data: ' '
      }));
      await sleep(50);
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'deleteContentBackward'
      }));
      await sleep(100);

      return;
    }

    window.veo3Debug?.error('DOM', 'No prompt field found (#PINHOLE or Slate)');
    throw new Error('No prompt field found');
  }

  // === MULTI-SIGNAL SUBMISSION VERIFICATION ===
  // Checks 4 signals: editor cleared, loading spinner, aria-busy, submit button state

  async function checkSubmissionSuccess(timeout = 15000) {
    window.veo3Debug?.debug('SUBMIT', 'Checking submission signals', { timeout });
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Signal 1a: Textarea cleared (primary - Flow uses #PINHOLE_TEXT_AREA_ELEMENT_ID)
      const textArea = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
      if (textArea && textArea.value.trim() === '') {
        window.veo3Debug?.info('SUBMIT', 'Textarea cleared - submission confirmed');
        return true;
      }

      // Signal 1b: Slate editor cleared (fallback)
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
      const alerts = document.querySelectorAll('[role="alert"], [class*="toast"], [class*="notification"]');
      for (const alertEl of alerts) {
        const alertText = alertEl.textContent.toLowerCase();
        if (alertText.includes('success') || alertText.includes('sucesso') ||
            alertText.includes('created') || alertText.includes('criado') ||
            alertText.includes('generated') || alertText.includes('gerado') ||
            alertText.includes('processing')) {
          console.log('[checkSubmissionSuccess] Success indicator found');
          return true;
        }
      }

      // Signal 5: Submit button disappeared (removed from DOM after successful submission)
      if (!submitBtn) {
        console.log('[checkSubmissionSuccess] Submit button disappeared - submission confirmed');
        return true;
      }

      // Signal 6: Google Flow progress_activity icon appeared (generation spinner)
      const allIcons = document.querySelectorAll('i.google-symbols, i.material-icons');
      for (const icon of allIcons) {
        if (icon.textContent.trim() === 'progress_activity') {
          console.log('[checkSubmissionSuccess] progress_activity icon detected - submission confirmed');
          return true;
        }
      }

      await sleep(TIMING.POLL_NORMAL);
    }

    console.warn('[checkSubmissionSuccess] Verification timed out');
    return false;
  }

  // === SUBMIT WITH RETRY CHAIN ===
  // 5-level: robustClick -> mousedown triple -> form submit -> Enter key -> final robust retry

  async function submitWithRetry() {
    window.veo3Debug?.info('SUBMIT', 'Starting retry chain');

    // Level 0: Simple .click() (nardoto-flow pattern - most reliable for standard React buttons)
    const submitBtn0 = window.veo3Selectors?.submitButton?.();
    window.veo3Debug?.debug('SUBMIT', 'Level 0: simple click', { found: !!submitBtn0 });
    if (submitBtn0) {
      if (window.veo3Highlight) window.veo3Highlight(submitBtn0);
      window.veo3ClickLogger?.logNativeClick(submitBtn0, 'SUBMIT', 'simple click');
      submitBtn0.click();
      await sleep(TIMING.AFTER_SUBMIT);

      if (await checkSubmissionSuccess(3000)) return true;
      window.veo3Debug?.debug('SUBMIT', 'Level 0 failed, trying radixClick');
    }

    // Level 1: Radix/Pointer click (pointerdown/pointerup/click)
    // Google Flow uses React/Radix - settings button only works with pointerdown.
    const submitBtn1 = window.veo3Selectors?.submitButton?.();
    window.veo3Debug?.debug('SUBMIT', 'Level 1: radixClick (pointerdown)', { found: !!submitBtn1 });
    if (submitBtn1 && window.veo3RadixClick) {
      await window.veo3RadixClick(submitBtn1);
      await sleep(TIMING.AFTER_SUBMIT);

      if (await checkSubmissionSuccess(3000)) return true;
      window.veo3Debug?.debug('SUBMIT', 'Level 1 failed, trying robust click');
    }

    // Level 2: Robust click (click + mousedown/mouseup/click triple)
    const submitBtn2 = window.veo3Selectors?.submitButton?.();
    window.veo3Debug?.debug('SUBMIT', 'Level 2: robust click', { found: !!submitBtn2 });
    if (submitBtn2) {
      if (window.veo3RobustClick) {
        await window.veo3RobustClick(submitBtn2, { sendEnter: false });
      } else if (window.veo3ClickFeedback) {
        await window.veo3ClickFeedback.clickWithFeedback(submitBtn2);
      } else {
        submitBtn2.click();
      }
      await sleep(TIMING.AFTER_SUBMIT);

      if (await checkSubmissionSuccess(3000)) return true;
      window.veo3Debug?.debug('SUBMIT', 'Level 2 failed, trying robust click with Enter');
    }

    // Level 3: Robust click + focus + Enter key on the submit button
    const submitBtn3 = window.veo3Selectors?.submitButton?.();
    window.veo3Debug?.debug('SUBMIT', 'Level 3: robust click + Enter', { found: !!submitBtn3 });
    if (submitBtn3) {
      if (window.veo3RobustClick) {
        await window.veo3RobustClick(submitBtn3, { sendEnter: true, focusFirst: true });
      } else {
        submitBtn3.focus();
        submitBtn3.click();
        await sleep(50);
        submitBtn3.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
        }));
      }
      await sleep(TIMING.AFTER_SUBMIT);

      if (await checkSubmissionSuccess(3000)) return true;
      window.veo3Debug?.debug('SUBMIT', 'Level 3 failed, trying Enter key on editor');
    }

    // Level 4: Enter key dispatch on textarea/editor/active element
    const textAreaTarget = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
    const editorSelector = window.veo3Selectors?.slateEditor || '[data-slate-editor="true"][contenteditable="true"]';
    const editor = document.querySelector(editorSelector);
    const target = textAreaTarget || editor || document.activeElement || document.body;

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
    window.veo3Debug?.debug('SUBMIT', 'Level 4 failed, final retry');

    // Level 5: Final retry - robust click + Enter one more time
    const retryBtn = window.veo3Selectors?.submitButton?.();
    window.veo3Debug?.debug('SUBMIT', 'Level 5: final robust retry', { found: !!retryBtn });
    if (retryBtn) {
      if (window.veo3RobustClick) {
        await window.veo3RobustClick(retryBtn, { sendEnter: true, focusFirst: true });
      } else {
        retryBtn.click();
      }
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
