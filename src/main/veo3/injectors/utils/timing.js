// timing.js - Timing utilities for Flow automation
// Ported from nardoto-flow with minimal changes

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
  POLL_SLOW: 1000
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
  for (const [, intervalId] of activeResources.intervals) {
    clearInterval(intervalId);
  }
  activeResources.intervals.clear();
  for (const [, observer] of activeResources.observers) {
    observer.disconnect();
  }
  activeResources.observers.clear();
  for (const [, timeoutId] of activeResources.timeouts) {
    clearTimeout(timeoutId);
  }
  activeResources.timeouts.clear();
}

async function setReactValue(element, value, options = {}) {
  const { clear = true, focus = true, blur = false, delay = 10 } = options;
  if (!element) return false;

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

    return true;
  } catch (error) {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
}

window.veo3Timing = {
  TIMING,
  sleep,
  waitForElement,
  waitForAnyElement,
  waitForElementToDisappear,
  withTimeout,
  setReactValue,
  createTrackedInterval,
  stopTrackedInterval,
  createTrackedObserver,
  disconnectTrackedObserver,
  cleanupAllResources,
  activeResources
};

console.log('[Flow] Timing utils loaded');
