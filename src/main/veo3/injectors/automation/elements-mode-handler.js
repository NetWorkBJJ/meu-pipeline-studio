// elements-mode-handler.js - Handles "Elements to Video" mode
// Ported from nardoto-flow, adapted selectors for updated Flow UI

const elementsHandler = {
  async isElementsModeActive() {
    const modeText = window.veo3Selectors.getCurrentModeText();
    if (!modeText) return false;
    return modeText.includes('element') || modeText.includes('elemento');
  },

  async processPromptWithElements(promptIndex, commandData) {
    const { sleep } = window.veo3Timing;
    const images = this.getAllImagesForPrompt(commandData);

    console.log(`[ElementsHandler] Processing prompt #${promptIndex} with ${images.length} images`);

    // Step 1: Add reference images via media library selection
    for (const img of images) {
      if (img.galleryItemName) {
        // Select from media library by filename
        const selected = await window.veo3GalleryMapper.selectMediaByName(img.galleryItemName);
        if (!selected) {
          console.warn(`[ElementsHandler] Could not select "${img.galleryItemName}" from library`);
          // Fallback: try drag & drop if we have the image data
          if (img.imagePath || img.image?.dataUrl) {
            await this.uploadFallback(img);
          }
        }
        await sleep(500);
      } else if (img.image?.dataUrl || img.imagePath) {
        // No gallery mapping -- upload via drag & drop
        await this.uploadFallback(img);
        await sleep(500);
      }
    }

    // Step 2: Fill prompt text
    await this.fillPrompt(commandData.prompt);

    // Step 3: Click submit
    await this.clickSubmit();

    // Step 4: Wait for submission confirmation
    await this.waitForSubmission();
  },

  getAllImagesForPrompt(commandData) {
    return commandData.characterImages || [];
  },

  async uploadFallback(img) {
    const { sleep } = window.veo3Timing;
    let file = null;

    if (img.image?.dataUrl) {
      file = window.dataUrlToFile(img.image.dataUrl, img.image.name || `${img.name}.png`);
    }

    if (!file) {
      console.warn(`[ElementsHandler] No file data for "${img.name}"`);
      return;
    }

    // Find the prompt/editor area for drag target
    const editor = document.querySelector(window.veo3Selectors.slateEditor);
    if (editor) {
      await window.simulateImageDragDrop(file, editor.closest('[class]') || editor);
      await sleep(700);
      await window.waitAndConfirmCrop();
    }
  },

  async fillPrompt(text) {
    const { sleep, waitForElement } = window.veo3Timing;
    const editor = await waitForElement(window.veo3Selectors.slateEditor);
    if (!editor) {
      throw new Error('Slate editor not found');
    }

    editor.focus();
    await sleep(100);

    // Clear existing content
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await sleep(100);

    // Insert new text
    document.execCommand('insertText', false, text);
    await sleep(200);

    console.log(`[ElementsHandler] Prompt filled: "${text.substring(0, 60)}..."`);
  },

  async clickSubmit() {
    const { sleep } = window.veo3Timing;
    const submitBtn = window.veo3Selectors.submitButton();
    if (!submitBtn) {
      throw new Error('Submit button (arrow_forward) not found');
    }

    if (window.veo3ClickFeedback) {
      await window.veo3ClickFeedback.clickWithFeedback(submitBtn);
    } else {
      submitBtn.click();
    }
    await sleep(300);
    console.log('[ElementsHandler] Submit clicked');
  },

  async waitForSubmission(timeout = 15000) {
    const { sleep } = window.veo3Timing;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check if the editor was cleared (Flow clears it after accepting prompt)
      const editor = document.querySelector(window.veo3Selectors.slateEditor);
      if (editor) {
        const text = editor.textContent.trim();
        if (text === '' || text.length < 5) {
          console.log('[ElementsHandler] Submission confirmed (editor cleared)');
          return true;
        }
      }
      await sleep(500);
    }

    console.warn('[ElementsHandler] Submission wait timed out');
    return false;
  }
};

window.elementsHandler = elementsHandler;

console.log('[Flow] Elements mode handler loaded');
