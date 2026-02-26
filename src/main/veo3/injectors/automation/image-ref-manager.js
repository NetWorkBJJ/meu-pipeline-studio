// image-ref-manager.js - Reference image management
// Ported from nardoto-flow, simplified (removed UI preview system)

const ImageRefManager = {
  loadedImages: [],         // { file, dataUrl, name }[]
  promptImageMap: new Map(), // promptIndex -> { start: { dataUrl, name }, end: null }
  currentMode: 'byname',   // 'byname' | 'single' | 'random'

  init() {
    this.loadedImages = [];
    this.promptImageMap = new Map();
    console.log('[ImageRefManager] Initialized');
  },

  addImage(imageData) {
    // imageData: { dataUrl, name, file? }
    if (!imageData || !imageData.dataUrl) return;

    const file = imageData.file || window.dataUrlToFile(imageData.dataUrl, imageData.name || 'image.png');
    this.loadedImages.push({
      file,
      dataUrl: imageData.dataUrl,
      name: imageData.name || `image_${this.loadedImages.length}`
    });

    console.log(`[ImageRefManager] Added image: ${imageData.name}`);
  },

  addImages(imagesArray) {
    for (const img of imagesArray) {
      this.addImage(img);
    }
  },

  processImagesForPrompts(totalPrompts) {
    this.promptImageMap.clear();

    if (this.loadedImages.length === 0) return;

    switch (this.currentMode) {
      case 'single':
        // All prompts get the first image
        for (let i = 0; i < totalPrompts; i++) {
          this.promptImageMap.set(i, { start: this.loadedImages[0], end: null });
        }
        break;

      case 'random': {
        // Shuffle and assign sequentially
        const shuffled = [...this.loadedImages].sort(() => Math.random() - 0.5);
        for (let i = 0; i < totalPrompts; i++) {
          this.promptImageMap.set(i, {
            start: shuffled[i % shuffled.length],
            end: null
          });
        }
        break;
      }

      case 'byname':
      default:
        // Matching handled externally via characterMatcher/galleryMapper
        break;
    }
  },

  getImageForPrompt(promptIndex) {
    return this.promptImageMap.get(promptIndex) || null;
  },

  setImageForPrompt(promptIndex, imageData) {
    this.promptImageMap.set(promptIndex, { start: imageData, end: null });
  },

  promptHasImage(promptIndex) {
    return this.promptImageMap.has(promptIndex);
  },

  getPromptsToSkip() {
    const skip = [];
    for (const [idx, data] of this.promptImageMap) {
      if (!data || !data.start) skip.push(idx);
    }
    return skip;
  },

  clear() {
    this.loadedImages = [];
    this.promptImageMap.clear();
  },

  getStats() {
    return {
      totalImages: this.loadedImages.length,
      mappedPrompts: this.promptImageMap.size,
      mode: this.currentMode
    };
  }
};

window.ImageRefManager = ImageRefManager;

console.log('[Flow] Image ref manager loaded');
