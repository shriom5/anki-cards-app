/**
 * @module cards
 * Card data model, validation, localStorage persistence, and load-from-storage.
 *
 * @typedef {Object} Card
 * @property {string}   front         - Front (question) text.
 * @property {string}   back          - Back (answer) text.
 * @property {string}   tags          - Space-separated tag string.
 * @property {string[]} frontImages   - Data URLs of front images. In-memory only;
 *                                      never written to localStorage.
 * @property {string[]} frontImageIds - IndexedDB keys for front images. These are
 *                                      persisted to localStorage.
 * @property {string[]} backImages    - Data URLs of back images. In-memory only.
 * @property {string[]} backImageIds  - IndexedDB keys for back images. Persisted.
 */

import { storeImages, fetchImages } from './images.js';

const STORAGE_KEY = 'cardCatalog.cards.v1';

/**
 * Validates inputs and creates a Card object.
 *
 * A card is valid when each side has either non-empty text or at least one image.
 * Returns null on validation failure so the caller can show an error without
 * having to re-validate.
 *
 * @param {string}   front
 * @param {string}   back
 * @param {string}   tags
 * @param {string[]} [frontImages=[]]
 * @param {string[]} [frontImageIds=[]]
 * @param {string[]} [backImages=[]]
 * @param {string[]} [backImageIds=[]]
 * @returns {Card|null}
 */
export function createCard(
  front, back, tags,
  frontImages = [], frontImageIds = [],
  backImages  = [], backImageIds  = [],
) {
  front = (front || '').trim();
  back  = (back  || '').trim();
  if (!front && !frontImages.length) return null;
  if (!back  && !backImages.length)  return null;
  return {
    front,
    back,
    tags:          (tags || '').trim(),
    frontImages:   frontImages.slice(),
    frontImageIds: frontImageIds.slice(),
    backImages:    backImages.slice(),
    backImageIds:  backImageIds.slice(),
  };
}

/**
 * Serialises cards to localStorage.
 *
 * Only card text, tags, and image IDs are written. Data URLs are omitted
 * because they live in IndexedDB, keeping localStorage usage minimal.
 *
 * @param {Card[]} cards
 * @returns {boolean} true on success; false if the storage quota was exceeded.
 */
export function persist(cards) {
  const meta = cards.map(({ front, back, tags, frontImageIds, backImageIds }) => {
    const m = { front, back, tags };
    if (frontImageIds?.length) m.frontImageIds = frontImageIds;
    if (backImageIds?.length)  m.backImageIds  = backImageIds;
    return m;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads cards from localStorage and resolves their images from IndexedDB.
 *
 * Migration: records written before the IndexedDB refactor stored data URLs
 * directly in localStorage (under `frontImages`, `backImages`, or the even
 * older singular `frontImage`/`backImage`). On first load those URLs are
 * transparently moved to IndexedDB and the returned `migrated` flag is set,
 * signalling that the caller should re-persist to update localStorage with
 * the new ID-only format.
 *
 * @returns {Promise<{ cards: Card[], migrated: boolean }>}
 */
export async function loadCards() {
  const str = localStorage.getItem(STORAGE_KEY);
  if (!str) return { cards: [], migrated: false };
  let raw;
  try { raw = JSON.parse(str); } catch { return { cards: [], migrated: false }; }

  const cards = [];
  let migrated = false;

  for (const m of raw) {
    const card = { front: m.front || '', back: m.back || '', tags: m.tags || '' };

    // ---- front images ----
    if (m.frontImageIds?.length) {
      const fi = await fetchImages(m.frontImageIds);
      card.frontImageIds = m.frontImageIds.filter((_, j) => fi[j] != null);
      card.frontImages   = fi.filter(Boolean);
    } else {
      const old = m.frontImages ?? (m.frontImage ? [m.frontImage] : []);
      if (old.length) {
        try   { card.frontImageIds = await storeImages(old); migrated = true; }
        catch { card.frontImageIds = []; }
        card.frontImages = old.slice();
      } else {
        card.frontImages = []; card.frontImageIds = [];
      }
    }

    // ---- back images ----
    if (m.backImageIds?.length) {
      const bi = await fetchImages(m.backImageIds);
      card.backImageIds = m.backImageIds.filter((_, j) => bi[j] != null);
      card.backImages   = bi.filter(Boolean);
    } else {
      const old = m.backImages ?? (m.backImage ? [m.backImage] : []);
      if (old.length) {
        try   { card.backImageIds = await storeImages(old); migrated = true; }
        catch { card.backImageIds = []; }
        card.backImages = old.slice();
      } else {
        card.backImages = []; card.backImageIds = [];
      }
    }

    cards.push(card);
  }

  return { cards, migrated };
}
