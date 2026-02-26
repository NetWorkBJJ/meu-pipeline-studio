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
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await window.veo3Timing.sleep(300);

      console.log(`[GalleryMapper] Mapped ${items.length} items from media library`);
      return items;
    } finally {
      galleryState.isMapping = false;
    }
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
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(300);
      // Fallback to legacy scroll-based selection
      return await selectMediaByNameLegacy(targetName);
    }

    // Step 3: Type character name in search field (React-compatible value setter)
    await setReactValue(searchInput, targetName, { clear: true, focus: true, blur: false, delay: 50 });
    await sleep(TIMING.NETWORK); // Wait for search results to filter

    // Step 4: Wait for Virtuoso to render results
    await sleep(500);

    // Step 5: Find and click the best matching item from filtered results
    const items = document.querySelectorAll('[data-item-index]');
    const targetLower = targetName.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const item of items) {
      if (item.offsetParent === null) continue;
      const text = item.textContent.trim().toLowerCase();

      // Exact match gets highest score
      if (text === targetLower) {
        bestMatch = item;
        bestScore = 1000;
        break;
      }
      // Contains match
      if (text.includes(targetLower) || targetLower.includes(text)) {
        const score = Math.min(text.length, targetLower.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
      }
    }

    if (bestMatch) {
      window.veo3Debug?.info('GALLERY', 'Found match, clicking: ' + bestMatch.textContent.trim());
      await window.veo3RobustClick(bestMatch); // Red circle feedback
      await sleep(TIMING.MEDIUM);
      // Dialog may auto-close after selection
      return true;
    }

    // No match found - close dialog
    window.veo3Debug?.warn('GALLERY', 'No search results matched: ' + targetName);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(300);
    return false;
  }

  // Legacy fallback: scroll-and-scan approach (used if search input not found)
  async function selectMediaByNameLegacy(targetName) {
    const { sleep } = window.veo3Timing;
    const targetLower = targetName.toLowerCase();

    const existingItems = document.querySelectorAll(window.veo3Selectors.mediaListItem);
    if (existingItems.length === 0) {
      const opened = await openMediaLibrary();
      if (!opened) return false;
    }

    const items = readMediaListItems();
    for (const item of items) {
      if (item.name.toLowerCase().includes(targetLower)) {
        await window.veo3RobustClick(item.element);
        await sleep(500);
        console.log(`[GalleryMapper] Selected media (legacy): "${item.name}"`);
        return true;
      }
    }

    const allItems = await scrollAndCollectAll(10);
    for (const item of allItems) {
      if (item.name.toLowerCase().includes(targetLower)) {
        const freshItems = readMediaListItems();
        for (const fresh of freshItems) {
          if (fresh.index === item.index) {
            await window.veo3RobustClick(fresh.element);
            await sleep(500);
            console.log(`[GalleryMapper] Selected media (legacy scroll): "${item.name}"`);
            return true;
          }
        }
      }
    }

    console.warn(`[GalleryMapper] Media "${targetName}" not found (legacy)`);
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
