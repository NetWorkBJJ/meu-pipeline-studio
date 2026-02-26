// gallery-mapper.js - Media library mapping for Google Flow
// REWRITTEN for Virtuoso virtual scroll UI (Feb 2026 update)
// Old approach: extract UUIDs from background-image URLs
// New approach: read text labels (filenames) from Virtuoso list items

const galleryState = {
  items: [],     // { name, index }[]
  isMapping: false
};

async function openMediaLibrary() {
  const { sleep } = window.veo3Timing;
  const addBtn = window.veo3Selectors.addMediaButton();
  if (!addBtn) {
    console.warn('[GalleryMapper] Add media button not found');
    return false;
  }

  addBtn.click();
  await sleep(800);
  return true;
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

    // Close the media library by pressing Escape or clicking outside
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await window.veo3Timing.sleep(300);

    console.log(`[GalleryMapper] Mapped ${items.length} items from media library`);
    return items;
  } finally {
    galleryState.isMapping = false;
  }
}

async function selectMediaByName(targetName) {
  const { sleep } = window.veo3Timing;
  const targetLower = targetName.toLowerCase();

  // Open media library if not already open
  const existingItems = document.querySelectorAll(window.veo3Selectors.mediaListItem);
  if (existingItems.length === 0) {
    const opened = await openMediaLibrary();
    if (!opened) return false;
  }

  // Search through visible items
  const items = readMediaListItems();
  for (const item of items) {
    if (item.name.toLowerCase().includes(targetLower)) {
      if (window.veo3ClickFeedback) {
        await window.veo3ClickFeedback.clickWithFeedback(item.element);
      } else {
        item.element.click();
      }
      await sleep(500);
      console.log(`[GalleryMapper] Selected media: "${item.name}"`);
      return true;
    }
  }

  // If not found in visible items, try scrolling to find it
  const allItems = await scrollAndCollectAll(10);
  for (const item of allItems) {
    if (item.name.toLowerCase().includes(targetLower)) {
      // Re-query since scrolling changed the DOM
      const freshItems = readMediaListItems();
      for (const fresh of freshItems) {
        if (fresh.index === item.index) {
          if (window.veo3ClickFeedback) {
            await window.veo3ClickFeedback.clickWithFeedback(fresh.element);
          } else {
            fresh.element.click();
          }
          await sleep(500);
          console.log(`[GalleryMapper] Selected media (after scroll): "${item.name}"`);
          return true;
        }
      }
    }
  }

  console.warn(`[GalleryMapper] Media "${targetName}" not found`);
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
  readMediaListItems,
  matchCharacterToMedia,
  openMediaLibrary
};

console.log('[Flow] Gallery mapper loaded (Virtuoso mode)');
