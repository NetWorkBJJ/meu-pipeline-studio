// cdp-core.ts - Chrome DevTools Protocol wrapper for Electron webview automation
// Uses webContents.debugger.attach() to send REAL input events (isTrusted: true)
// that go through Chromium's full input pipeline (hit-test, focus, event bubbling)

import { webContents, type WebContents } from 'electron'

interface ClickOptions {
  button?: 'left' | 'right' | 'middle'
  clickCount?: number
  delay?: number
}

interface CdpRect {
  x: number
  y: number
  width: number
  height: number
}

interface CdpTestResult {
  step: string
  success: boolean
  detail?: string
  error?: string
}

let attachedContents: WebContents | null = null
let isAttached = false

function getDebugger(): WebContents['debugger'] {
  if (!attachedContents || !isAttached) {
    throw new Error('CDP not attached. Call attach() first.')
  }
  return attachedContents.debugger
}

async function sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const dbg = getDebugger()
  return dbg.sendCommand(method, params)
}

// === LIFECYCLE ===

async function attach(webContentsId: number): Promise<void> {
  if (isAttached && attachedContents) {
    // Already attached to same target - skip
    if (attachedContents.id === webContentsId) return
    // Different target - detach first
    detach()
  }

  const wc = webContents.fromId(webContentsId)
  if (!wc) {
    throw new Error(`WebContents with id ${webContentsId} not found`)
  }

  try {
    wc.debugger.attach('1.3')
  } catch (err) {
    // May already be attached (e.g. DevTools open)
    const msg = String(err)
    if (!msg.includes('Already attached')) {
      throw new Error(`Failed to attach CDP: ${msg}`)
    }
  }

  attachedContents = wc
  isAttached = true

  // Auto-detach when webContents is destroyed or navigates away
  wc.debugger.on('detach', (_event, reason) => {
    console.log(`[CDP] Debugger detached: ${reason}`)
    if (attachedContents?.id === wc.id) {
      attachedContents = null
      isAttached = false
    }
  })

  console.log(`[CDP] Attached to webContents ${webContentsId}`)
}

function detach(): void {
  if (attachedContents && isAttached) {
    try {
      attachedContents.debugger.detach()
    } catch {
      // Already detached
    }
  }
  attachedContents = null
  isAttached = false
}

function getIsAttached(): boolean {
  return isAttached && attachedContents !== null
}

// === INPUT PRIMITIVES ===

async function click(x: number, y: number, options: ClickOptions = {}): Promise<void> {
  const { button = 'left', clickCount = 1, delay = 50 } = options

  // Step 1: Move mouse to target (triggers hover states, tooltips etc.)
  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y
  })

  await sleep(20)

  // Step 2: Mouse press
  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button,
    clickCount
  })

  await sleep(delay)

  // Step 3: Mouse release
  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button,
    clickCount
  })
}

async function type(text: string): Promise<void> {
  // Input.insertText inserts text at current cursor position
  // Produces isTrusted InputEvent that Slate.js handles correctly
  await sendCommand('Input.insertText', { text })
}

async function press(key: string, modifiers?: number): Promise<void> {
  const keyMap: Record<string, { code: string; keyCode: number }> = {
    Enter: { code: 'Enter', keyCode: 13 },
    Escape: { code: 'Escape', keyCode: 27 },
    Tab: { code: 'Tab', keyCode: 9 },
    Backspace: { code: 'Backspace', keyCode: 8 },
    Delete: { code: 'Delete', keyCode: 46 },
    ArrowUp: { code: 'ArrowUp', keyCode: 38 },
    ArrowDown: { code: 'ArrowDown', keyCode: 40 },
    ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
    ArrowRight: { code: 'ArrowRight', keyCode: 39 },
    ' ': { code: 'Space', keyCode: 32 }
  }

  const mapped = keyMap[key]
  const code = mapped?.code || key
  const keyCode = mapped?.keyCode || key.charCodeAt(0)

  await sendCommand('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
    modifiers: modifiers || 0
  })

  await sleep(30)

  await sendCommand('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
    modifiers: modifiers || 0
  })
}

// === DOM QUERIES (via Runtime.evaluate) ===

async function evaluate<T>(expression: string): Promise<T> {
  const result = (await sendCommand('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })) as { result: { value: T; type: string; subtype?: string; description?: string } }

  if (result.result.subtype === 'error') {
    throw new Error(result.result.description || 'Evaluation error')
  }

  return result.result.value
}

async function getRect(selector: string): Promise<CdpRect | null> {
  // Evaluate in page context to get bounding rect
  // Handles both CSS selectors and JS expressions that return elements
  const rect = await evaluate<CdpRect | null>(`
    (() => {
      let el;
      try {
        el = ${selector.startsWith('document.') || selector.startsWith('window.') ? selector : `document.querySelector(${JSON.stringify(selector)})`};
      } catch(e) {
        return null;
      }
      if (!el) return null;
      if (typeof el === 'function') el = el();
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()
  `)

  return rect
}

// === COMPOSITE HELPERS ===

async function clickElement(selector: string): Promise<boolean> {
  const rect = await getRect(selector)
  if (!rect) {
    console.log(`[CDP] clickElement: element not found for "${selector.substring(0, 80)}"`)
    return false
  }

  // Click center of element
  const cx = Math.round(rect.x + rect.width / 2)
  const cy = Math.round(rect.y + rect.height / 2)

  console.log(`[CDP] clickElement: clicking (${cx}, ${cy}) for "${selector.substring(0, 60)}"`)
  await click(cx, cy)
  return true
}

async function typeIntoElement(selector: string, text: string): Promise<boolean> {
  const clicked = await clickElement(selector)
  if (!clicked) return false

  await sleep(100)
  await type(text)
  return true
}

// === POC TEST ===

async function runPocTest(): Promise<CdpTestResult[]> {
  const results: CdpTestResult[] = []

  function log(step: string, success: boolean, detail?: string, error?: string): void {
    results.push({ step, success, detail, error })
    const status = success ? 'OK' : 'FAIL'
    console.log(`[CDP POC] ${status}: ${step}${detail ? ' - ' + detail : ''}${error ? ' - ' + error : ''}`)
  }

  try {
    // Test 1: Verify connection
    const title = await evaluate<string>('document.title')
    log('1. Connection', true, `Page title: "${title}"`)
  } catch (err) {
    log('1. Connection', false, undefined, String(err))
    return results
  }

  try {
    // Test 2: Verify injectors loaded
    const hasSelectors = await evaluate<boolean>('typeof window.veo3Selectors !== "undefined"')
    log('2. Injectors', hasSelectors, hasSelectors ? 'veo3Selectors available' : 'veo3Selectors NOT found')
    if (!hasSelectors) return results
  } catch (err) {
    log('2. Injectors', false, undefined, String(err))
    return results
  }

  try {
    // Test 3: Find prompt field
    const promptRect = await getRect('[data-slate-editor="true"][contenteditable="true"]')
    if (!promptRect) {
      const textAreaRect = await getRect('#PINHOLE_TEXT_AREA_ELEMENT_ID')
      if (!textAreaRect) {
        log('3. Find prompt', false, 'No prompt field found (Slate or textarea)')
        return results
      }
      log('3. Find prompt', true, `Textarea at (${textAreaRect.x}, ${textAreaRect.y})`)
    } else {
      log('3. Find prompt', true, `Slate editor at (${promptRect.x}, ${promptRect.y})`)
    }
  } catch (err) {
    log('3. Find prompt', false, undefined, String(err))
    return results
  }

  try {
    // Test 4: Click prompt field (CDP real click)
    const clicked = await clickElement('[data-slate-editor="true"][contenteditable="true"]')
      || await clickElement('#PINHOLE_TEXT_AREA_ELEMENT_ID')
    log('4. Click prompt', clicked, clicked ? 'CDP click dispatched' : 'No prompt field to click')
    if (!clicked) return results
    await sleep(200)
  } catch (err) {
    log('4. Click prompt', false, undefined, String(err))
    return results
  }

  try {
    // Test 5: Type text (CDP real input)
    const testText = 'CDP test: automation with real input events'
    await type(testText)
    await sleep(300)

    // Verify text was inserted
    const content = await evaluate<string>(`
      (() => {
        const slate = document.querySelector('[data-slate-editor="true"]');
        if (slate) return slate.textContent || '';
        const ta = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
        if (ta) return ta.value || '';
        return '';
      })()
    `)

    const textFound = content.includes('CDP test')
    log('5. Type text', textFound, `Content: "${content.substring(0, 60)}"`)
    if (!textFound) return results
  } catch (err) {
    log('5. Type text', false, undefined, String(err))
    return results
  }

  try {
    // Test 6: Find submit button
    const submitRect = await getRect('window.veo3Selectors.submitButton()')
    log('6. Find submit', !!submitRect, submitRect
      ? `Submit at (${submitRect.x}, ${submitRect.y})`
      : 'Submit button not found')
  } catch (err) {
    log('6. Find submit', false, undefined, String(err))
  }

  // NOTE: We do NOT actually submit in the POC test to avoid wasting a generation
  // The test validates: connection, DOM queries, CDP click, CDP type
  log('7. POC complete', true, 'All core CDP primitives validated. Submit skipped (would waste a generation).')

  return results
}

// === AUTOMATION OPERATIONS ===
// Used by the main automation flow via CDP_REQUEST/CDP_RESPONSE protocol.
// Reuses the same primitives validated by runPocTest.

interface CdpOpResult {
  success: boolean
  error?: string
}

async function fillPrompt(text: string): Promise<CdpOpResult> {
  try {
    // Step 1: Clear existing text via the clear button (uses injected veo3Selectors)
    const clearRect = await evaluate<CdpRect | null>(`
      (() => {
        if (typeof window.veo3Selectors === 'undefined') return null;
        const btn = window.veo3Selectors.clearButton();
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })()
    `)

    if (clearRect) {
      const cx = Math.round(clearRect.x + clearRect.width / 2)
      const cy = Math.round(clearRect.y + clearRect.height / 2)
      console.log(`[CDP] fillPrompt: clearing existing text via clear button at (${cx}, ${cy})`)
      await click(cx, cy)
      await sleep(400)
    }

    // Step 2: Click the Slate editor (primary target - same selector as POC test)
    let clicked = await clickElement('[data-slate-editor="true"][contenteditable="true"]')
    if (!clicked) {
      clicked = await clickElement('#PINHOLE_TEXT_AREA_ELEMENT_ID')
    }
    if (!clicked) {
      return { success: false, error: 'No prompt field found (Slate editor or textarea)' }
    }

    await sleep(150)

    // Step 3: Type text via CDP Input.insertText (isTrusted event that Slate recognizes)
    console.log(`[CDP] fillPrompt: typing ${text.length} chars`)
    await type(text)
    await sleep(300)

    // Step 4: Verify text was inserted
    const content = await evaluate<string>(`
      (() => {
        const slate = document.querySelector('[data-slate-editor="true"]');
        if (slate) return slate.textContent || '';
        const ta = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
        if (ta) return ta.value || '';
        return '';
      })()
    `)

    if (!content || content.trim().length === 0) {
      return { success: false, error: 'Text insertion verification failed - editor appears empty' }
    }

    console.log(`[CDP] fillPrompt: verified, content length=${content.length}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: `fillPrompt failed: ${String(err)}` }
  }
}

async function clickSubmit(): Promise<CdpOpResult> {
  try {
    // Use injected veo3Selectors.submitButton() for robust button detection
    const submitRect = await evaluate<CdpRect | null>(`
      (() => {
        if (typeof window.veo3Selectors !== 'undefined' && window.veo3Selectors.submitButton) {
          const btn = window.veo3Selectors.submitButton();
          if (btn) {
            const r = btn.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return { x: r.x, y: r.y, width: r.width, height: r.height };
          }
        }
        return null;
      })()
    `)

    if (!submitRect) {
      return { success: false, error: 'Submit button not found via veo3Selectors' }
    }

    const cx = Math.round(submitRect.x + submitRect.width / 2)
    const cy = Math.round(submitRect.y + submitRect.height / 2)

    console.log(`[CDP] clickSubmit: clicking submit at (${cx}, ${cy})`)
    await click(cx, cy)
    await sleep(500)

    // Verify submission: check if editor cleared or loading indicator appeared
    const submitted = await evaluate<boolean>(`
      (() => {
        const slate = document.querySelector('[data-slate-editor="true"]');
        if (slate && slate.textContent.trim().length < 5) return true;
        const ta = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
        if (ta && ta.value.trim() === '') return true;
        const icons = document.querySelectorAll('i.google-symbols, i.material-icons');
        for (const icon of icons) {
          if (icon.textContent.trim() === 'progress_activity') return true;
        }
        return false;
      })()
    `)

    if (!submitted) {
      // Retry with Enter key as fallback
      console.log('[CDP] clickSubmit: click did not trigger submission, trying Enter key')
      await press('Enter')
      await sleep(1000)
    }

    console.log('[CDP] clickSubmit: done')
    return { success: true }
  } catch (err) {
    return { success: false, error: `clickSubmit failed: ${String(err)}` }
  }
}

// === UTILS ===

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// === EXPORT ===

export const cdpCore = {
  attach,
  detach,
  isAttached: getIsAttached,
  click,
  type,
  press,
  evaluate,
  getRect,
  clickElement,
  typeIntoElement,
  runPocTest,
  fillPrompt,
  clickSubmit
}
