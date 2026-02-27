// gallery-mapper.js - Media library mapping for Google Flow
// IIFE-wrapped to prevent re-injection errors on SPA navigation
// Uses Virtuoso virtual scroll: reads text labels from [data-item-index] items

(function () {
  if (window.__veo3_gallery_loaded) return;
  window.__veo3_gallery_loaded = true;

  const galleryState = {
    items: [],     // { name, index }[]
    isMapping: false
  };

  async function openMediaLibrary() {
    const { sleep, waitForElement } = window.veo3Timing;
    const addBtn = window.veo3Selectors.addMediaButton();
    if (!addBtn) {
      console.warn('[GalleryMapper] Add media button not found');
      return false;
    }

    // Use robustClick for visual feedback (red circle)
    if (window.veo3RobustClick) {
      await window.veo3RobustClick(addBtn);
    } else {
      addBtn.scrollIntoView({ block: 'center' });
      await sleep(200);
      addBtn.click();
    }
    await sleep(1000);

    // Verify dialog opened by checking for search input or list items
    const searchInput = await waitForElement(
      window.veo3Selectors.searchInput, 6000
    );
    if (searchInput) {
      console.log('[GalleryMapper] Media library opened (search input found)');
      return true;
    }

    // Fallback: check for list items
    const startTime = Date.now();
    while (Date.now() - startTime < 3000) {
      const items = document.querySelectorAll(window.veo3Selectors.mediaListItem);
      if (items.length > 0) {
        console.log('[GalleryMapper] Media library opened, found', items.length, 'visible items');
        return true;
      }
      await sleep(300);
    }

    console.warn('[GalleryMapper] Media library did not open within timeout');
    return false;
  }

  function readMediaListItems() {
    const items = document.querySelectorAll(window.veo3Selectors.mediaListItem);
    const result = [];

    for (const item of items) {
      const index = parseInt(item.getAttribute('data-item-index') || '-1', 10);
      const textContent = item.textContent.trim();

      if (textContent && index >= 0) {
        result.push({
          name: textContent,
          index,
          element: item
        });
      }
    }

    return result;
  }

  async function scrollAndCollectAll(maxScrollAttempts = 20) {
    const { sleep } = window.veo3Timing;
    const allItems = new Map();
    let lastCount = 0;
    let sameCountStreak = 0;

    for (let attempt = 0; attempt < maxScrollAttempts; attempt++) {
      const visible = readMediaListItems();
      for (const item of visible) {
        if (!allItems.has(item.index)) {
          allItems.set(item.index, { name: item.name, index: item.index });
        }
      }

      if (allItems.size === lastCount) {
        sameCountStreak++;
        if (sameCountStreak >= 3) break; // No new items after 3 scrolls
      } else {
        sameCountStreak = 0;
        lastCount = allItems.size;
      }

      // Scroll the Virtuoso container down
      const lastVisible = visible[visible.length - 1];
      if (lastVisible?.element) {
        lastVisible.element.scrollIntoView({ block: 'end' });
      }
      await sleep(300);
    }

    return Array.from(allItems.values()).sort((a, b) => a.index - b.index);
  }

  async function mapGallery() {
    if (galleryState.isMapping) return galleryState.items;
    galleryState.isMapping = true;

    try {
      const opened = await openMediaLibrary();
      if (!opened) {
        galleryState.isMapping = false;
        return [];
      }

      const items = await scrollAndCollectAll();
      galleryState.items = items;

      // Close the media library
      if (window.__veo3_cdpPress) { await window.__veo3_cdpPress('Escape'); } else { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
      await window.veo3Timing.sleep(300);

      console.log(`[GalleryMapper] Mapped ${items.length} items from media library`);
      return items;
    } finally {
      galleryState.isMapping = false;
    }
  }

  // Check if a [data-item-index] element is a prompt history item (not an actual image).
  // Prompt history items contain action buttons, progress indicators, and full prompt text
  // that can include character names — causing false positive matches.
  function isPromptHistoryItem(text) {
    return text.includes('reutilizar comando') || text.includes('reuse command') ||
      text.includes('delete_forever') || text.includes('progress_activity') ||
      text.includes('(take ');
  }

  // Strip icon prefixes ("image", "videocam") and file extensions from text for clean matching
  function cleanMediaText(text) {
    return text.replace(/^(image|videocam|video)\s*/i, '').replace(/\.(png|jpg|jpeg|webp)$/i, '').trim();
  }

  // Find the best matching individual image card within a Virtuoso row or the row itself.
  // Virtuoso [data-item-index] rows can contain MULTIPLE image cards side-by-side.
  // Clicking the row center lands on the wrong card, so we drill into child elements.
  function findBestCardInItem(item, targetLower, cleanTarget) {
    var fullText = item.textContent.trim().toLowerCase();
    var bestCard = null;
    var bestScore = 0;

    // Strategy A: Look for individual clickable cards as direct children of the row
    var children = item.querySelectorAll(':scope > div, :scope > button, :scope > a');

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.offsetParent === null) continue;
      var childText = child.textContent.trim().toLowerCase();

      // Skip wrappers whose text equals the full row (not an individual card)
      if (childText === fullText) continue;
      // Skip very short text (just icons like "image" or "add_2")
      if (childText.length < 5) continue;

      var cleanChild = cleanMediaText(childText);
      var score = scoreMatch(cleanChild, cleanTarget);

      if (score > bestScore) {
        bestScore = score;
        bestCard = child;
      }
      if (score >= 1000) break;
    }

    // Strategy B: If no child cards matched (single-card item or flat structure),
    // check the item itself — but only if it looks like an image item (not too long)
    if (!bestCard && children.length <= 1) {
      var cleanFull = cleanMediaText(fullText);
      var itemScore = scoreMatch(cleanFull, cleanTarget);
      if (itemScore > 0) {
        bestScore = itemScore;
        bestCard = item;
      }
    }

    return { element: bestCard, score: bestScore };
  }

  // Score how well a cleaned text matches the target (0 = no match, 1000 = exact)
  function scoreMatch(cleanText, cleanTarget) {
    if (cleanText === cleanTarget) return 1000;
    if (cleanText.includes(cleanTarget)) return cleanTarget.length + 1;
    if (cleanTarget.includes(cleanText) && cleanText.length > 5) return cleanText.length;
    return 0;
  }

  async function selectMediaByName(targetName) {
    const { sleep, TIMING, waitForElement, setReactValue } = window.veo3Timing;
    window.veo3Debug?.info('GALLERY', 'Selecting media by search: ' + targetName);

    // Step 1: Click '+' button to open resource dialog (with red circle feedback)
    const addBtn = window.veo3Selectors.addMediaButton();
    if (!addBtn) {
      window.veo3Debug?.warn('GALLERY', 'Add media button not found');
      return false;
    }
    await window.veo3RobustClick(addBtn);
    await sleep(TIMING.STANDARD);

    // Step 2: Wait for search input to appear in the dialog
    const searchInput = await waitForElement(
      window.veo3Selectors.searchInput, 6000
    );
    if (!searchInput) {
      window.veo3Debug?.warn('GALLERY', 'Search input not found in dialog');
      if (window.__veo3_cdpPress) { await window.__veo3_cdpPress('Escape'); } else { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
      await sleep(300);
      // Fallback to legacy scroll-based selection
      return await selectMediaByNameLegacy(targetName);
    }

    // Step 3: Type character name in search field (React-compatible value setter)
    await setReactValue(searchInput, targetName, { clear: true, focus: true, blur: false, delay: 50 });
    await sleep(TIMING.NETWORK); // Wait for search results to filter

    // Step 4: Wait for Virtuoso to render results
    await sleep(500);

    // Step 5: Find the specific image card that matches the target.
    // [data-item-index] items are Virtuoso rows that may contain MULTIPLE image cards.
    // We drill into each row to find and click the specific card, not the row center.
    const items = document.querySelectorAll('[data-item-index]');
    const targetLower = targetName.toLowerCase();
    const cleanTarget = cleanMediaText(targetLower);
    let bestCard = null;
    let bestScore = 0;

    for (const item of items) {
      if (item.offsetParent === null) continue;

      // Filter out prompt history items (contain character names from previous prompts)
      const fullText = item.textContent.trim().toLowerCase();
      if (isPromptHistoryItem(fullText)) {
        window.veo3Debug?.debug('GALLERY', 'Skipping prompt history item: "' + fullText.substring(0, 60) + '..."');
        continue;
      }

      // Find the best matching card within this row
      const result = findBestCardInItem(item, targetLower, cleanTarget);
      if (result.score > bestScore) {
        bestScore = result.score;
        bestCard = result.element;
      }
      if (bestScore >= 1000) break;
    }

    if (bestCard) {
      const cardText = bestCard.textContent.trim();
      const parentIndex = bestCard.closest('[data-item-index]')?.getAttribute('data-item-index') || '?';
      window.veo3Debug?.info('GALLERY', 'Found card in row ' + parentIndex + ': "' + cardText.substring(0, 80) + '" (score=' + bestScore + ')');
      await window.veo3RobustClick(bestCard); // Red circle feedback on specific card
      await sleep(TIMING.MEDIUM);
      // Dialog may auto-close after selection
      return true;
    }

    // No match found - close dialog
    window.veo3Debug?.warn('GALLERY', 'No search results matched: ' + targetName);
    if (window.__veo3_cdpPress) { await window.__veo3_cdpPress('Escape'); } else { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
    await sleep(300);
    return false;
  }

  // Legacy fallback: scroll-and-scan approach (used if search input not found)
  async function selectMediaByNameLegacy(targetName) {
    const { sleep } = window.veo3Timing;
    const targetLower = targetName.toLowerCase();
    const cleanTarget = cleanMediaText(targetLower);

    const existingItems = document.querySelectorAll(window.veo3Selectors.mediaListItem);
    if (existingItems.length === 0) {
      const opened = await openMediaLibrary();
      if (!opened) return false;
    }

    // Try to find and click a specific card within visible items
    const items = readMediaListItems();
    for (const item of items) {
      const itemTextLower = item.name.toLowerCase();
      // Skip prompt history items
      if (isPromptHistoryItem(itemTextLower)) continue;

      // Try to find specific card within the row
      const result = findBestCardInItem(item.element, targetLower, cleanTarget);
      if (result.element && result.score > 0) {
        await window.veo3RobustClick(result.element);
        await sleep(500);
        console.log('[GalleryMapper] Selected media (legacy): "' + result.element.textContent.trim().substring(0, 80) + '"');
        return true;
      }
    }

    const allItems = await scrollAndCollectAll(10);
    for (const item of allItems) {
      const itemTextLower = item.name.toLowerCase();
      if (isPromptHistoryItem(itemTextLower)) continue;
      if (itemTextLower.includes(targetLower) || cleanMediaText(itemTextLower).includes(cleanTarget)) {
        const freshItems = readMediaListItems();
        for (const fresh of freshItems) {
          if (fresh.index === item.index) {
            const result = findBestCardInItem(fresh.element, targetLower, cleanTarget);
            const clickTarget = result.element || fresh.element;
            await window.veo3RobustClick(clickTarget);
            await sleep(500);
            console.log('[GalleryMapper] Selected media (legacy scroll): "' + clickTarget.textContent.trim().substring(0, 80) + '"');
            return true;
          }
        }
      }
    }

    console.warn('[GalleryMapper] Media "' + targetName + '" not found (legacy)');
    return false;
  }

  function matchCharacterToMedia(characterName, mediaItems) {
    const charLower = characterName.toLowerCase();
    const charParts = charLower.split(/[\s_\-]+/).filter(p => p.length >= 3);

    let bestMatch = null;
    let bestScore = 0;

    for (const item of mediaItems) {
      const itemLower = item.name.toLowerCase();
      let score = 0;

      // Full name match
      if (itemLower.includes(charLower)) {
        score = charLower.length * 10 + 50;
      } else {
        // Partial word matching
        for (const part of charParts) {
          if (itemLower.includes(part)) {
            score += part.length * 5;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    return bestScore >= 15 ? bestMatch : null;
  }

  window.veo3GalleryMapper = {
    galleryState,
    mapGallery,
    selectMediaByName,
    selectMediaByNameLegacy,
    readMediaListItems,
    matchCharacterToMedia,
    openMediaLibrary
  };

  console.log('[Flow] Gallery mapper loaded (Virtuoso mode)');
})();
