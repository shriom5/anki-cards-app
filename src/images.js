/**
 * @module images
 * High-level image management built on top of db.js.
 *
 * Images are stored as data URL strings in IndexedDB, keyed by generated IDs.
 * The IDs (not the data URLs) are what gets written to localStorage alongside
 * card metadata — keeping localStorage small regardless of image count or size.
 */

import { idbPut, idbGet, idbDelete, idbGetAllKeys } from './db.js';

/**
 * Generates a unique, stable-ish image storage key.
 * Format: img_<timestamp>_<random suffix>
 * @returns {string}
 */
export function makeImageId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Writes an array of data URLs to IndexedDB, assigning a fresh ID to each.
 * Returns IDs in the same order as the input, so callers can store them
 * alongside the card as parallel arrays.
 *
 * @param {string[]} dataUrls
 * @returns {Promise<string[]>} Assigned IDs, one per input URL.
 */
export async function storeImages(dataUrls) {
  const ids = dataUrls.map(makeImageId);
  await Promise.all(ids.map((id, i) => idbPut(id, dataUrls[i])));
  return ids;
}

/**
 * Fetches data URLs for a list of IDs.
 * IDs not found in IndexedDB resolve to null (e.g. after a migration failure).
 *
 * @param {string[]} ids
 * @returns {Promise<(string|null)[]>}
 */
export function fetchImages(ids) {
  return Promise.all(ids.map(idbGet));
}

/**
 * Deletes images from IndexedDB by ID.
 * Fire-and-forget — errors are logged but not propagated.
 *
 * @param {string[]} ids
 */
export function removeImages(ids) {
  idbDelete(ids).catch(e => console.warn('removeImages:', e));
}

/**
 * Garbage-collects orphaned images: deletes any IndexedDB entries whose IDs
 * are not referenced by any card in the provided array.
 * Fire-and-forget — safe to call without awaiting.
 *
 * @param {import('./cards.js').Card[]} cards
 */
export function gcImages(cards) {
  idbGetAllKeys().then(allKeys => {
    const used = new Set(cards.flatMap(c => [
      ...(c.frontImageIds ?? []),
      ...(c.backImageIds  ?? []),
    ]));
    const orphans = allKeys.filter(k => !used.has(k));
    if (orphans.length) idbDelete(orphans).catch(() => {});
  }).catch(() => {});
}
