// image-creation-handler.js - Handles "Create Images" mode (Nano Banana Pro)
// Ported from nardoto-flow, adapted for updated Flow UI

const imageCreationHandler = {
  async isImageCreationModeActive() {
    const modeText = window.veo3Selectors.getCurrentModeText();
    if (!modeText) return false;
    return modeText.includes('image') || modeText.includes('imagem') || modeText.includes('criar');
  },

  async processPromptWithImageCreation(promptIndex, commandData) {
    const { sleep } = window.veo3Timing;
    const images = this.getAllImagesForPrompt(commandData);

    console.log(`[ImageCreation] Processing prompt #${promptIndex} with ${images.length} ref images`);

    // Step 1: Add reference images (if any)
    for (const img of images) {
      if (img.galleryItemName) {
        const selected = await window.veo3GalleryMapper.selectMediaByName(img.galleryItemName);
        if (!selected && (img.image?.dataUrl || img.imagePath)) {
          await this.uploadFallback(img);
        }
        await sleep(500);
      } else if (img.image?.dataUrl || img.imagePath) {
        await this.uploadFallback(img);
        await sleep(500);
      }
    }

    // Step 2: Fill prompt
    await this.fillPrompt(commandData.prompt);

    // Step 3: Submit
    await this.clickSubmit();

    // Step 4: Wait for confirmation
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
      console.warn(`[ImageCreation] No file data for "${img.name}"`);
      return;
    }

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
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await sleep(100);
    document.execCommand('insertText', false, text);
    await sleep(200);

    console.log(`[ImageCreation] Prompt filled: "${text.substring(0, 60)}..."`);
  },

  async clickSubmit() {
    const { sleep } = window.veo3Timing;
    const submitBtn = window.veo3Selectors.submitButton();
    if (!submitBtn) {
      throw new Error('Submit button not found');
    }

    if (window.veo3ClickFeedback) {
      await window.veo3ClickFeedback.clickWithFeedback(submitBtn);
    } else {
      submitBtn.click();
    }
    await sleep(300);
  },

  async waitForSubmission(timeout = 15000) {
    const { sleep } = window.veo3Timing;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const editor = document.querySelector(window.veo3Selectors.slateEditor);
      if (editor) {
        const text = editor.textContent.trim();
        if (text === '' || text.length < 5) {
          console.log('[ImageCreation] Submission confirmed');
          return true;
        }
      }
      await sleep(500);
    }

    console.warn('[ImageCreation] Submission wait timed out');
    return false;
  }
};

window.imageCreationHandler = imageCreationHandler;

console.log('[Flow] Image creation handler loaded');
