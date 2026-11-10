/**
 * @module utils
 * Pure utility functions — no side effects, no external dependencies.
 * Safe to import in both browser and test contexts.
 */

/**
 * Escapes HTML special characters to prevent XSS when inserting text into innerHTML.
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Converts a display name to a URL/filename-safe slug.
 * Falls back to 'deck' if the result would be empty.
 * @param {string|null} name
 * @returns {string}
 * @example slugify('My Deck 2024') // → 'my-deck-2024'
 */
export function slugify(name) {
  return (name || 'deck').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'deck';
}

/**
 * Strips the .apkg extension and filesystem-unsafe characters from a filename base.
 * Falls back to 'deck' if the result would be empty.
 * @param {string|null} name
 * @returns {string}
 */
export function sanitizeFileBase(name) {
  let base = (name || 'deck').trim().replace(/\.apkg$/i, '');
  base = base.replace(/[\/\\:*?"<>|]+/g, '-').trim();
  return base || 'deck';
}

/**
 * Pops and returns the last property value from a plain object, mutating it in place.
 * Used to extract the template deck/model entry from Anki's JSON config objects.
 * @param {Object} obj
 * @returns {*}
 */
export function getLastItem(obj) {
  const keys = Object.keys(obj);
  const lastKey = keys[keys.length - 1];
  const item = obj[lastKey];
  delete obj[lastKey];
  return item;
}
