/**
 * @module ui
 * DOM rendering: card list, image galleries, and the status bar.
 *
 * All functions receive the DOM elements they need as parameters rather than
 * querying the document directly, which keeps them decoupled and unit-testable.
 */

import { escapeHtml } from './utils.js';

/**
 * Renders all cards into the card-stack element.
 * Shows the empty-state placeholder when there are no cards.
 *
 * @param {import('./cards.js').Card[]} cards
 * @param {{
 *   cardStack:  HTMLElement,
 *   emptyState: HTMLElement,
 *   countTag:   HTMLElement,
 * }} els
 */
export function render(cards, { cardStack, emptyState, countTag }) {
  cardStack.innerHTML = '';
  if (cards.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    cards.forEach((c, idx) => {
      const tagsHtml = c.tags
        ? `<span class="tags">${escapeHtml(c.tags)}</span>`
        : '';
      const thumbs = imgs => imgs.length
        ? `<div class="entry-thumbs">${imgs.map(s => `<img class="entry-thumb" src="${s}" alt="">`).join('')}</div>`
        : '';
      const el = document.createElement('div');
      el.className = 'entry';
      el.innerHTML =
        `<div class="f">${escapeHtml(c.front)}${tagsHtml}${thumbs(c.frontImages)}</div>` +
        `<div class="b">${escapeHtml(c.back)}${thumbs(c.backImages)}</div>` +
        `<button class="remove" title="Remove card" data-idx="${idx}">&times;</button>`;
      cardStack.appendChild(el);
    });
  }
  countTag.textContent = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`;
}

/**
 * Renders an image gallery for a pending-images list.
 * Re-renders from scratch on every call; remove buttons fire via event delegation
 * wired by wireImageInput — not here.
 *
 * @param {HTMLElement} galleryEl
 * @param {string[]}    imagesArr - Data URLs to display as thumbnails.
 */
export function renderGallery(galleryEl, imagesArr) {
  galleryEl.innerHTML = '';
  imagesArr.forEach((dataUrl, idx) => {
    const item = document.createElement('div');
    item.className = 'img-gallery-item';
    const img = document.createElement('img');
    img.src = dataUrl; img.alt = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'img-remove';
    btn.title = 'Remove';
    btn.setAttribute('data-idx', idx);
    btn.textContent = '×';
    item.append(img, btn);
    galleryEl.appendChild(item);
  });
}

/**
 * Wires a file input so that each selected image is appended to imagesArr
 * and the gallery is re-rendered. Also wires click-delegation on the gallery
 * container for the per-thumbnail remove buttons.
 *
 * Call once per input during initialisation — do not call again on re-renders.
 *
 * @param {HTMLInputElement} fileInput
 * @param {HTMLElement}      galleryEl
 * @param {string[]}         imagesArr - Mutable array; images are pushed/spliced in place.
 */
export function wireImageInput(fileInput, galleryEl, imagesArr) {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      imagesArr.push(reader.result);
      fileInput.value = '';
      renderGallery(galleryEl, imagesArr);
    };
    reader.readAsDataURL(file);
  });
  galleryEl.addEventListener('click', e => {
    const btn = e.target.closest('.img-remove');
    if (!btn) return;
    imagesArr.splice(parseInt(btn.getAttribute('data-idx'), 10), 1);
    renderGallery(galleryEl, imagesArr);
  });
}

/**
 * Empties both pending image arrays and clears their gallery UI.
 * Called after a card is successfully filed.
 *
 * @param {{ frontImages: string[], backImages: string[] }} pending
 * @param {{
 *   frontImgFile:    HTMLInputElement,
 *   backImgFile:     HTMLInputElement,
 *   frontImgGallery: HTMLElement,
 *   backImgGallery:  HTMLElement,
 * }} els
 */
export function resetPendingImages(pending, els) {
  pending.frontImages.length = 0;
  pending.backImages.length  = 0;
  els.frontImgFile.value = '';
  els.backImgFile.value  = '';
  renderGallery(els.frontImgGallery, pending.frontImages);
  renderGallery(els.backImgGallery,  pending.backImages);
}

/**
 * Updates the status bar text and colour class.
 *
 * @param {HTMLElement}       statusEl
 * @param {string}            msg
 * @param {'ok'|'err'|string} [cls='']
 */
export function setStatus(statusEl, msg, cls = '') {
  statusEl.textContent = msg;
  statusEl.className   = cls;
}
