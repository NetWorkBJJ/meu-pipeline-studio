// rename-automator.js - Automates renaming all media cards in Flow collection
// Iterates through Virtuoso virtual scroll list, right-clicks each card,
// clicks "Renomear", types the prompt text as new name, confirms with Enter.

(function () {
  if (window.__veo3_rename_loaded) return;
  window.__veo3_rename_loaded = true;

  // === STATE ===

  var renameState = {
    running: false,
    stopped: false,
    processed: 0,
    skipped: 0,
    errors: 0,
    total: 0
  };

  // === HELPERS ===

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function notifySidepanel(action, data) {
    console.log(JSON.stringify({
      type: 'CONTENT_TO_SIDEPANEL',
      action: action,
      data: data || {}
    }));
  }

  // Get all visible [data-item-index] items in the Virtuoso list
  function getVisibleItems() {
    return Array.from(document.querySelectorAll('[data-item-index]'));
  }

  // Known Material Icon / UI button text patterns that pollute prompt extraction
  var UI_NOISE_PATTERNS = [
    'redo', 'undo', 'content_copy', 'delete_forever', 'more_vert', 'download',
    'progress_activity', 'sentiment_satisfied', 'keyboard_arrow_down', 'keyboard_arrow_up',
    'Reuse text prompt', 'Ampliar', 'Reutilizar', 'reutilizar', 'Excluir', 'Baixar',
    'close', 'check', 'edit', 'whiteboard', 'open_in_new'
  ];

  // Clean extracted text by removing UI noise fragments
  function cleanPromptText(rawText) {
    if (!rawText) return null;
    var text = rawText;

    // Remove Material Icon names (typically single words without spaces, all lowercase)
    for (var i = 0; i < UI_NOISE_PATTERNS.length; i++) {
      // Remove exact occurrences of noise patterns
      text = text.split(UI_NOISE_PATTERNS[i]).join('');
    }

    // Collapse multiple whitespace/newlines into single space
    text = text.replace(/\s+/g, ' ').trim();

    return text.length > 10 ? text : null;
  }

  // Get only the direct text content of an element, excluding child elements
  function getDirectTextContent(element) {
    var text = '';
    for (var i = 0; i < element.childNodes.length; i++) {
      if (element.childNodes[i].nodeType === 3) { // TEXT_NODE
        text += element.childNodes[i].textContent;
      }
    }
    return text.trim();
  }

  // Extract prompt text from a card item
  // The prompt is the description/command text, e.g. "(TAKE 1) Wide establishing shot..."
  function extractPromptText(itemElement) {
    // Strategy 1: class-based selector - get innermost text
    var promptDiv = itemElement.querySelector('[class*="sc-21e778e8"]');
    if (promptDiv) {
      // Get text only from direct text nodes + innermost spans/divs, excluding buttons/icons
      var cleaned = getCleanTextFromElement(promptDiv);
      if (cleaned && cleaned.length > 10) {
        return cleaned;
      }
    }

    // Strategy 2: find the deepest div containing "(TAKE" pattern
    var allDivs = itemElement.querySelectorAll('div');
    var bestTakeDiv = null;
    var bestTakeDepth = -1;
    for (var i = 0; i < allDivs.length; i++) {
      var directText = getDirectTextContent(allDivs[i]);
      if (directText.match(/\(TAKE\s+\d+\)/)) {
        // Prefer deeper (more specific) divs
        var depth = getDepth(allDivs[i], itemElement);
        if (depth > bestTakeDepth) {
          bestTakeDepth = depth;
          bestTakeDiv = allDivs[i];
        }
      }
    }
    if (bestTakeDiv) {
      var cleaned2 = getCleanTextFromElement(bestTakeDiv);
      if (cleaned2 && cleaned2.length > 20) return cleaned2;
    }

    // Strategy 3: longest clean text block > 30 chars from leaf divs
    var best = '';
    for (var j = 0; j < allDivs.length; j++) {
      // Only consider leaf-ish divs (no UI button children)
      if (allDivs[j].querySelector('button, [role="button"], i.material-icons, i[class*="icon"]')) continue;
      if (allDivs[j].children.length > 5) continue;

      var txt = getCleanTextFromElement(allDivs[j]);
      if (txt && txt.length > 30 && txt.length > best.length) {
        best = txt;
      }
    }
    return best || null;
  }

  // Get clean text from an element, excluding icon/button text
  function getCleanTextFromElement(element) {
    // Clone the element to manipulate safely
    var clone = element.cloneNode(true);

    // Remove all icon elements (Material Icons use <i> tags, also <svg>)
    var icons = clone.querySelectorAll('i, svg, [class*="icon"], [role="img"]');
    for (var i = 0; i < icons.length; i++) {
      icons[i].remove();
    }

    // Remove button elements and their content
    var buttons = clone.querySelectorAll('button, [role="button"]');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].remove();
    }

    // Get remaining text and clean it
    var raw = clone.textContent.trim();
    return cleanPromptText(raw);
  }

  // Get nesting depth of element within ancestor
  function getDepth(element, ancestor) {
    var depth = 0;
    var current = element;
    while (current && current !== ancestor) {
      depth++;
      current = current.parentElement;
    }
    return depth;
  }

  // Extract the current displayed name of the card (the overlay text on the thumbnail)
  function extractCurrentName(itemElement) {
    // The name is typically shown as an overlay on the image/video thumbnail
    // Look for text elements within the media area (left column)
    var spans = itemElement.querySelectorAll('span, p');
    for (var i = 0; i < spans.length; i++) {
      var text = spans[i].textContent.trim();
      if (text.length > 3 && text.length < 200 && !text.match(/\(TAKE/)) {
        return text;
      }
    }
    return null;
  }

  // Right-click on an element using contextmenu event dispatch
  // Falls back to CDP right-click if JS dispatch doesn't trigger the menu
  async function rightClickElement(element) {
    var rect = element.getBoundingClientRect();
    var cx = Math.round(rect.left + rect.width / 2);
    var cy = Math.round(rect.top + rect.height / 2);

    // Try CDP right-click first (isTrusted: true)
    if (window.__veo3_cdpRightClickAt) {
      try {
        var cdpResult = await window.__veo3_cdpRightClickAt(cx, cy);
        if (cdpResult && cdpResult.success !== false) return true;
      } catch (e) {
        console.log('[RENAME] CDP right-click failed, trying JS dispatch');
      }
    }

    // Fallback: JS contextmenu event
    element.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: cx,
      clientY: cy,
      button: 2
    }));
    return true;
  }

  // Wait for the context menu to appear
  async function waitForContextMenu(timeoutMs) {
    if (!timeoutMs) timeoutMs = 5000;
    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
      // Look for Radix UI context menu
      var menu = document.querySelector('[role="menu"][data-state="open"]');
      if (menu) return menu;
      // Also check for menuitem elements that could indicate an open menu
      var items = document.querySelectorAll('[role="menuitem"]');
      if (items.length > 0) {
        // Verify they're visible
        for (var i = 0; i < items.length; i++) {
          var rect = items[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return items[i].closest('[role="menu"]') || items[i].parentElement;
        }
      }
      await sleep(100);
    }
    return null;
  }

  // Find the "Renomear" button in the context menu
  function findRenameButton() {
    var menuItems = document.querySelectorAll('[role="menuitem"]');
    for (var i = 0; i < menuItems.length; i++) {
      var text = menuItems[i].textContent.trim();
      if (text.indexOf('Renomear') !== -1 || text.indexOf('Rename') !== -1) {
        return menuItems[i];
      }
      // Also check for the whiteboard icon
      var icon = menuItems[i].querySelector('i');
      if (icon && icon.textContent.trim() === 'whiteboard') {
        return menuItems[i];
      }
    }
    return null;
  }

  // Snapshot existing inputs before clicking Renomear (to detect new ones)
  function snapshotInputs() {
    var inputs = document.querySelectorAll('input[type="text"], input:not([type]), [contenteditable="true"]');
    var set = new Set();
    for (var i = 0; i < inputs.length; i++) {
      set.add(inputs[i]);
    }
    return set;
  }

  // Wait for rename input to appear after clicking Renomear
  // Uses beforeSnapshot to detect NEW inputs that appeared after clicking Renomear
  // Also scopes search near the specific card (itemElement)
  async function waitForRenameInput(timeoutMs, beforeSnapshot, itemElement) {
    if (!timeoutMs) timeoutMs = 5000;
    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
      // Strategy 1: Find NEW input elements that didn't exist before clicking Renomear
      var inputs = document.querySelectorAll('input[type="text"], input:not([type])');
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        // Skip inputs that existed before we clicked Renomear
        if (beforeSnapshot && beforeSnapshot.has(inp)) continue;
        var rect = inp.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          console.log('[RENAME] Found NEW input: value="' + (inp.value || '') + '"');
          return inp;
        }
      }

      // Strategy 2: Find input INSIDE the specific card element
      if (itemElement) {
        var cardInputs = itemElement.querySelectorAll('input[type="text"], input:not([type])');
        for (var j = 0; j < cardInputs.length; j++) {
          var r1 = cardInputs[j].getBoundingClientRect();
          if (r1.width > 0 && r1.height > 0) {
            console.log('[RENAME] Found card-scoped input: value="' + (cardInputs[j].value || '') + '"');
            return cardInputs[j];
          }
        }
      }

      // Strategy 3: Find NEW contenteditable elements
      var editables = document.querySelectorAll('[contenteditable="true"]');
      for (var k = 0; k < editables.length; k++) {
        if (beforeSnapshot && beforeSnapshot.has(editables[k])) continue;
        var r2 = editables[k].getBoundingClientRect();
        if (r2.width > 0 && r2.height > 0 && !editables[k].matches('[data-slate-editor]')) {
          console.log('[RENAME] Found NEW contenteditable');
          return editables[k];
        }
      }

      await sleep(100);
    }
    return null;
  }

  // Dismiss any open overlay/menu
  async function dismissOverlay() {
    if (window.__veo3_cdpPress) {
      await window.__veo3_cdpPress('Escape');
    } else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    await sleep(300);
  }

  // Click element via CDP (preferred) or JS fallback
  async function clickElement(element) {
    if (window.__veo3_cdpClickElement) {
      var ok = await window.__veo3_cdpClickElement(element);
      if (ok) return true;
    }
    // Fallback
    if (window.veo3RobustClick) {
      return await window.veo3RobustClick(element);
    }
    element.click();
    return true;
  }

  // Type text into an element (input or contenteditable)
  async function typeIntoElement(element, text) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      // For input elements: focus, select all, then replace with new text
      element.focus();
      element.select(); // select all existing text (native API, works for input/textarea)
      await sleep(100);

      // Try CDP type for isTrusted events (types over selected text, replacing it)
      if (window.__veo3_cdpType) {
        try {
          var cdpResult = await window.__veo3_cdpType(text);
          if (cdpResult && cdpResult.success) return true;
          console.log('[RENAME] CDP type returned failure, trying JS fallback');
        } catch (e) {
          console.log('[RENAME] CDP type failed: ' + e.message + ', using JS fallback');
        }
      }

      // JS fallback: set value via native setter + dispatch events
      var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(element, text);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } else {
      // For contenteditable: clear then type
      element.focus();
      element.textContent = '';
      await sleep(100);

      if (window.__veo3_cdpType) {
        try {
          var cdpResult2 = await window.__veo3_cdpType(text);
          if (cdpResult2 && cdpResult2.success) return true;
        } catch (e) {
          console.log('[RENAME] CDP type in contenteditable failed');
        }
      }

      // JS fallback
      element.textContent = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }

  // Press Enter to confirm rename
  async function pressEnter() {
    if (window.__veo3_cdpPress) {
      await window.__veo3_cdpPress('Enter');
    } else {
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
      }));
    }
  }

  // Find the confirm button (checkmark) if present
  function findConfirmButton() {
    // Look for a button with a check/confirm icon near the rename input
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var icon = buttons[i].querySelector('i, svg');
      var text = buttons[i].textContent.trim().toLowerCase();
      if (text === 'check' || text === 'done' || text === 'confirm') {
        var rect = buttons[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return buttons[i];
      }
      // Check for checkmark SVG (the screenshot shows checkmark + X buttons)
      if (icon && buttons[i].getAttribute('aria-label') &&
          buttons[i].getAttribute('aria-label').toLowerCase().indexOf('confirm') !== -1) {
        return buttons[i];
      }
    }
    return null;
  }

  // Find the clickable media area of a card (thumbnail/video area on the left)
  function findMediaArea(itemElement) {
    // Look for img, video, or the main clickable area
    var media = itemElement.querySelector('img, video, [role="img"]');
    if (media) return media;
    // Try the first child div (usually the media column)
    var firstChild = itemElement.querySelector('div > div');
    if (firstChild) return firstChild;
    return itemElement;
  }

  // === SCROLL HELPERS ===

  // Find the Virtuoso scroll container
  function findScrollContainer() {
    // Virtuoso uses data-testid="virtuoso-scroller" or a parent with overflow
    var scroller = document.querySelector('[data-testid="virtuoso-scroller"]');
    if (scroller) return scroller;
    // Fallback: find the scrollable parent of gallery items
    var item = document.querySelector('[data-item-index]');
    if (!item) return null;
    var el = item.parentElement;
    while (el) {
      var style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') return el;
      el = el.parentElement;
    }
    return null;
  }

  // Get visible items sorted by data-item-index (ascending)
  function getSortedVisibleItems() {
    var items = Array.from(document.querySelectorAll('[data-item-index]'));
    items.sort(function (a, b) {
      return parseInt(a.getAttribute('data-item-index')) - parseInt(b.getAttribute('data-item-index'));
    });
    return items;
  }

  // Check if a card looks already renamed (current name starts like the prompt)
  function isAlreadyRenamed(itemElement, promptText) {
    if (!promptText) return false;
    // Look for a visible name/title on the card that matches the prompt
    // Cards in Flow show the name as overlay on the thumbnail or in a text element
    var spans = itemElement.querySelectorAll('span, p, [class*="name"], [class*="title"]');
    var promptStart = promptText.substring(0, 30).toLowerCase();
    for (var i = 0; i < spans.length; i++) {
      var text = (spans[i].textContent || '').trim();
      // If any visible text on the card starts with the prompt text, it's already renamed
      if (text.length > 25 && text.toLowerCase().indexOf(promptStart) === 0) {
        return true;
      }
    }
    return false;
  }

  // === MAIN RENAME AUTOMATION ===
  // Strategy: process ONE item at a time, re-query DOM each time.
  // Never hold stale element references across rename operations.
  // Scroll forward with scrollTop increments (not scrollIntoView on stale elements).

  async function renameAll() {
    if (renameState.running) {
      console.log('[RENAME] Already running, ignoring');
      return;
    }

    renameState.running = true;
    renameState.stopped = false;
    renameState.processed = 0;
    renameState.skipped = 0;
    renameState.errors = 0;
    renameState.total = 0;

    notifySidepanel('RENAME_STARTED');
    console.log('[RENAME] Starting rename-all automation...');

    // Track processed indices (data-item-index values)
    var processedIndices = new Set();
    // Track the highest index we've attempted, to enforce forward-only progression
    var highestAttemptedIndex = -1;
    var noProgressScrollCount = 0;
    var MAX_NO_PROGRESS_SCROLLS = 5;

    try {
      // Find scroll container
      var scrollContainer = findScrollContainer();

      // Scroll to top first
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
        await sleep(600);
      }

      while (!renameState.stopped) {
        // Re-query visible items fresh each iteration (Virtuoso recycles DOM)
        var visibleItems = getSortedVisibleItems();

        if (visibleItems.length === 0) {
          console.log('[RENAME] No visible items, trying to scroll...');
          if (scrollContainer) {
            scrollContainer.scrollTop += 400;
            await sleep(500);
            noProgressScrollCount++;
            if (noProgressScrollCount >= MAX_NO_PROGRESS_SCROLLS) break;
          } else {
            break;
          }
          continue;
        }

        // Find the FIRST item that hasn't been processed yet AND is at or after our highest attempted index
        var targetItem = null;
        var targetIndex = -1;
        for (var i = 0; i < visibleItems.length; i++) {
          var idx = parseInt(visibleItems[i].getAttribute('data-item-index'));
          if (isNaN(idx)) continue;
          // Only go forward: skip items below our progress watermark
          if (idx < highestAttemptedIndex && processedIndices.has(String(idx))) continue;
          // Skip already processed
          if (processedIndices.has(String(idx))) continue;
          targetItem = visibleItems[i];
          targetIndex = idx;
          break;
        }

        // No unprocessed items in current viewport - scroll down
        if (!targetItem) {
          if (!scrollContainer) {
            console.log('[RENAME] No scroll container, finishing');
            break;
          }

          var prevScrollTop = scrollContainer.scrollTop;
          scrollContainer.scrollTop += 300;
          await sleep(500);

          // Check if scroll actually moved (we might be at the bottom)
          var newScrollTop = scrollContainer.scrollTop;
          if (Math.abs(newScrollTop - prevScrollTop) < 5) {
            noProgressScrollCount++;
            console.log('[RENAME] Scroll stuck (' + noProgressScrollCount + '/' + MAX_NO_PROGRESS_SCROLLS + ')');
            if (noProgressScrollCount >= MAX_NO_PROGRESS_SCROLLS) {
              console.log('[RENAME] Cannot scroll further, finishing');
              break;
            }
          } else {
            noProgressScrollCount = 0;
          }
          continue;
        }

        // Reset no-progress counter since we found an item
        noProgressScrollCount = 0;

        var indexStr = String(targetIndex);
        highestAttemptedIndex = Math.max(highestAttemptedIndex, targetIndex);

        // Extract prompt text
        var promptText = extractPromptText(targetItem);
        if (!promptText) {
          console.log('[RENAME] No prompt found for item ' + indexStr + ', skipping');
          processedIndices.add(indexStr);
          renameState.skipped++;
          continue;
        }

        // Check if already renamed (safety net against re-processing)
        if (isAlreadyRenamed(targetItem, promptText)) {
          console.log('[RENAME] Item ' + indexStr + ' already renamed, skipping');
          processedIndices.add(indexStr);
          renameState.skipped++;
          continue;
        }

        console.log('[RENAME] Processing item ' + indexStr + ': ' + promptText.substring(0, 60) + '...');

        // Scroll the target item into view so user can see progress
        // Safe because we re-query DOM fresh each outer while iteration
        targetItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        await sleep(300);

        // Step 1: Find the media area to right-click
        var mediaArea = findMediaArea(targetItem);
        if (!mediaArea) {
          console.log('[RENAME] No media area found for item ' + indexStr);
          processedIndices.add(indexStr);
          renameState.skipped++;
          continue;
        }

        // Step 2: Right-click to open context menu
        await rightClickElement(mediaArea);
        await sleep(400);

        // Step 3: Wait for context menu
        var menu = await waitForContextMenu(3000);
        if (!menu) {
          console.log('[RENAME] Context menu did not appear for item ' + indexStr + ', retrying...');
          await rightClickElement(targetItem);
          await sleep(400);
          menu = await waitForContextMenu(3000);
        }

        if (!menu) {
          console.log('[RENAME] Context menu failed for item ' + indexStr + ', skipping');
          await dismissOverlay();
          processedIndices.add(indexStr);
          renameState.skipped++;
          notifySidepanel('RENAME_PROGRESS', {
            current: processedIndices.size,
            processed: renameState.processed,
            skipped: renameState.skipped,
            errors: renameState.errors
          });
          continue;
        }

        // Step 4: Find and click "Renomear"
        var renameBtn = findRenameButton();
        if (!renameBtn) {
          console.log('[RENAME] Renomear button not found for item ' + indexStr + ', skipping');
          await dismissOverlay();
          processedIndices.add(indexStr);
          renameState.skipped++;
          notifySidepanel('RENAME_PROGRESS', {
            current: processedIndices.size,
            processed: renameState.processed,
            skipped: renameState.skipped,
            errors: renameState.errors
          });
          continue;
        }

        // Snapshot inputs BEFORE clicking Renomear (to detect new rename input)
        var inputSnapshot = snapshotInputs();

        await clickElement(renameBtn);
        await sleep(500);

        // Step 5: Wait for rename input (pass snapshot and item for scoped detection)
        var renameInput = await waitForRenameInput(3000, inputSnapshot, targetItem);
        if (!renameInput) {
          console.log('[RENAME] Rename input did not appear for item ' + indexStr + ', skipping');
          await dismissOverlay();
          processedIndices.add(indexStr);
          renameState.skipped++;
          notifySidepanel('RENAME_PROGRESS', {
            current: processedIndices.size,
            processed: renameState.processed,
            skipped: renameState.skipped,
            errors: renameState.errors
          });
          continue;
        }

        // Step 6: Type the prompt text as new name
        await typeIntoElement(renameInput, promptText);
        await sleep(200);

        // Step 7: Confirm - try confirm button first, then Enter
        var confirmBtn = findConfirmButton();
        if (confirmBtn) {
          await clickElement(confirmBtn);
        } else {
          await pressEnter();
        }
        await sleep(500);

        // Done with this item
        processedIndices.add(indexStr);
        renameState.processed++;
        renameState.total = processedIndices.size;

        console.log('[RENAME] Renamed item ' + indexStr + ' (' + renameState.processed + ' done)');
        notifySidepanel('RENAME_PROGRESS', {
          current: processedIndices.size,
          processed: renameState.processed,
          skipped: renameState.skipped,
          errors: renameState.errors,
          lastItem: promptText.substring(0, 60)
        });

        // Brief pause between items
        await sleep(300);
      }
    } catch (err) {
      console.log('[RENAME] Error: ' + err.message);
      renameState.errors++;
      notifySidepanel('RENAME_ERROR', { message: err.message });
    }

    renameState.running = false;
    console.log('[RENAME] Complete: ' + renameState.processed + ' renamed, ' +
                renameState.skipped + ' skipped, ' + renameState.errors + ' errors');
    notifySidepanel('RENAME_COMPLETE', {
      total: processedIndices.size,
      processed: renameState.processed,
      skipped: renameState.skipped,
      errors: renameState.errors
    });
  }

  function stop() {
    renameState.stopped = true;
    console.log('[RENAME] Stop requested');
  }

  function isRunning() {
    return renameState.running;
  }

  // === EXPOSE ON WINDOW ===

  window.veo3RenameAutomator = {
    renameAll: renameAll,
    stop: stop,
    isRunning: isRunning,
    getState: function () { return Object.assign({}, renameState); }
  };

  console.log('[Flow] Rename automator loaded');
})();
