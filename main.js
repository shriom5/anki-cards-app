/**
 * @module main
 * Application entry point. Loaded as <script type="module"> from index.html.
 *
 * Responsibilities
 * ----------------
 * - Hold all DOM references and mutable UI state (cards array, pending images).
 * - Wire event listeners by composing functions from the other modules.
 * - Drive the startup sequence: loadCards → render.
 * - Handle cross-cutting concerns: persist-and-report, top-level async errors.
 *
 * This module contains no business logic of its own. Logic lives in:
 *   cards.js  — data model and localStorage persistence
 *   ui.js     — DOM rendering
 *   images.js — IndexedDB image ops
 *   apkg.js   — .apkg export
 *   utils.js  — pure utilities
 */

import { slugify, sanitizeFileBase }                              from './src/utils.js';
import { storeImages, removeImages, gcImages }                   from './src/images.js';
import { createCard, persist, loadCards }                        from './src/cards.js';
import { render, wireImageInput, resetPendingImages, setStatus } from './src/ui.js';
import { buildApkg }                                             from './src/apkg.js';

// ---- DOM references ----------------------------------------------------------------

const els = {
  frontInput:      document.getElementById('frontInput'),
  backInput:       document.getElementById('backInput'),
  tagsInput:       document.getElementById('tagsInput'),
  addCardBtn:      document.getElementById('addCardBtn'),
  cardStack:       document.getElementById('cardStack'),
  emptyState:      document.getElementById('emptyState'),
  countTag:        document.getElementById('countTag'),
  clearAllBtn:     document.getElementById('clearAllBtn'),
  exportBtn:       document.getElementById('exportBtn'),
  deckNameInput:   document.getElementById('deckNameInput'),
  fileNameInput:   document.getElementById('fileNameInput'),
  statusEl:        document.getElementById('status'),
  bulkToggle:      document.getElementById('bulkToggle'),
  bulkPanel:       document.getElementById('bulkPanel'),
  bulkInput:       document.getElementById('bulkInput'),
  bulkAddBtn:      document.getElementById('bulkAddBtn'),
  frontImgFile:    document.getElementById('frontImgFile'),
  backImgFile:     document.getElementById('backImgFile'),
  frontImgGallery: document.getElementById('frontImgGallery'),
  backImgGallery:  document.getElementById('backImgGallery'),
};

// ---- App state ---------------------------------------------------------------------

/** All filed cards. Populated asynchronously by the startup sequence below. */
let cards = [];

/**
 * Images chosen via the file inputs but not yet attached to a card.
 * Data URLs are accumulated here until "File this card" is clicked,
 * at which point they are written to IndexedDB and the arrays are cleared.
 */
const pending = { frontImages: [], backImages: [] };

// ---- Preference keys ---------------------------------------------------------------

const DECK_KEY = 'cardCatalog.deckName.v1';
const FILE_KEY = 'cardCatalog.fileName.v1';

// ---- Image gallery wiring ----------------------------------------------------------

wireImageInput(els.frontImgFile, els.frontImgGallery, pending.frontImages);
wireImageInput(els.backImgFile,  els.backImgGallery,  pending.backImages);

// ---- Deck / filename preferences ---------------------------------------------------

const savedDeck = localStorage.getItem(DECK_KEY);
if (savedDeck) els.deckNameInput.value = savedDeck;

let userEditedFileName = false;
const savedFile = localStorage.getItem(FILE_KEY);
if (savedFile) {
  els.fileNameInput.value = savedFile;
  userEditedFileName = true;
} else {
  els.fileNameInput.value = slugify(els.deckNameInput.value);
}

els.deckNameInput.addEventListener('input', () => {
  localStorage.setItem(DECK_KEY, els.deckNameInput.value);
  if (!userEditedFileName) els.fileNameInput.value = slugify(els.deckNameInput.value);
});

els.fileNameInput.addEventListener('input', () => {
  userEditedFileName = true;
  localStorage.setItem(FILE_KEY, els.fileNameInput.value);
});

// ---- Helpers -----------------------------------------------------------------------

/** Re-renders the card list from the current cards array. */
const redraw = () => render(cards, els);

/**
 * Persists cards and shows a success or storage-full error message.
 * @param {string} successMsg
 */
function persistAndReport(successMsg) {
  if (persist(cards)) {
    setStatus(els.statusEl, successMsg, 'ok');
  } else {
    setStatus(els.statusEl,
      'Card NOT saved — local storage is full. Export your deck now before closing or refreshing this tab.',
      'err');
  }
}

// ---- File this card ----------------------------------------------------------------

els.addCardBtn.addEventListener('click', async () => {
  els.addCardBtn.disabled = true;

  let frontImageIds = [], backImageIds = [];
  try {
    if (pending.frontImages.length) frontImageIds = await storeImages(pending.frontImages);
    if (pending.backImages.length)  backImageIds  = await storeImages(pending.backImages);
  } catch (e) {
    console.error('storeImages:', e);
    setStatus(els.statusEl, 'Failed to save images — try again.', 'err');
    els.addCardBtn.disabled = false;
    return;
  }

  const card = createCard(
    els.frontInput.value, els.backInput.value, els.tagsInput.value,
    pending.frontImages, frontImageIds,
    pending.backImages,  backImageIds,
  );

  if (!card) {
    removeImages([...frontImageIds, ...backImageIds]);
    setStatus(els.statusEl, 'A card needs a front (text or image) and a back (text or image).', 'err');
    els.addCardBtn.disabled = false;
    return;
  }

  cards.push(card);
  els.frontInput.value = '';
  els.backInput.value  = '';
  els.tagsInput.value  = '';
  resetPendingImages(pending, els);
  els.frontInput.focus();
  persistAndReport('Card filed.');
  redraw();
  els.addCardBtn.disabled = false;
});

// Cmd/Ctrl+Enter submits from either text area
[els.frontInput, els.backInput].forEach(el => {
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); els.addCardBtn.click(); }
  });
});

// ---- Bulk paste --------------------------------------------------------------------

els.bulkToggle.addEventListener('click', () => els.bulkPanel.classList.toggle('open'));

els.bulkAddBtn.addEventListener('click', () => {
  let added = 0;
  for (const line of els.bulkInput.value.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.includes('\t') ? line.split('\t') : line.split('|');
    if (parts.length < 2) continue;
    const card = createCard(parts[0], parts.slice(1).join(line.includes('\t') ? '\t' : '|'), '');
    if (card) { cards.push(card); added++; }
  }
  if (added > 0) {
    els.bulkInput.value = '';
    persistAndReport(`${added} ${added === 1 ? 'card' : 'cards'} added from paste.`);
    redraw();
  } else {
    setStatus(els.statusEl, "Couldn't find any front | back pairs in that text.", 'err');
  }
});

// ---- Remove a card -----------------------------------------------------------------

els.cardStack.addEventListener('click', e => {
  const btn = e.target.closest('.remove');
  if (!btn) return;
  const idx = parseInt(btn.getAttribute('data-idx'), 10);
  const c   = cards[idx];
  const ids = [...(c.frontImageIds ?? []), ...(c.backImageIds ?? [])];
  cards.splice(idx, 1);
  persist(cards);
  redraw();
  if (ids.length) removeImages(ids);
});

// ---- Clear all ---------------------------------------------------------------------

els.clearAllBtn.addEventListener('click', () => {
  if (!cards.length) return;
  if (!confirm(`Remove all ${cards.length} filed cards? This can't be undone.`)) return;
  const allIds = cards.flatMap(c => [...(c.frontImageIds ?? []), ...(c.backImageIds ?? [])]);
  cards.splice(0, cards.length);
  persist(cards);
  redraw();
  setStatus(els.statusEl, 'Drawer cleared.', 'ok');
  if (allIds.length) removeImages(allIds);
});

// ---- Export ------------------------------------------------------------------------

els.exportBtn.addEventListener('click', async () => {
  if (!cards.length) { setStatus(els.statusEl, 'File at least one card before exporting.', 'err'); return; }

  const deckName = els.deckNameInput.value.trim() || 'My Deck';
  const fileBase = sanitizeFileBase(els.fileNameInput.value || slugify(deckName));

  els.exportBtn.disabled    = true;
  const originalLabel        = els.exportBtn.textContent;
  els.exportBtn.textContent = 'Building deck…';
  setStatus(els.statusEl, `Generating ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}…`);

  try {
    const blob = await buildApkg(deckName, cards);
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${fileBase}.apkg` });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus(els.statusEl, `Downloaded ${fileBase}.apkg — import it via Anki's File → Import.`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus(els.statusEl, `Something went wrong: ${err.message}`, 'err');
  } finally {
    els.exportBtn.disabled    = false;
    els.exportBtn.textContent = originalLabel;
  }
});

// ---- Startup -----------------------------------------------------------------------

(async () => {
  const { cards: loaded, migrated } = await loadCards().catch(err => {
    console.error('loadCards failed:', err);
    return { cards: [], migrated: false };
  });
  cards.push(...loaded);
  if (migrated) persist(cards); // rewrite localStorage with IDs after migration
  gcImages(cards);              // clean up any orphaned IndexedDB entries
  redraw();
})();
