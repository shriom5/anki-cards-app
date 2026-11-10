# Card Catalog — Design Documentation

## 1. Overview

Card Catalog is a single-page browser app for creating Anki flashcard decks and
downloading them as `.apkg` files that Anki can import directly. There is no
backend, no build step, and no server-side code of any kind.

The app runs entirely in the user's browser. All cards are stored in browser
storage (localStorage for text and image references; IndexedDB for image blobs)
and nothing is ever transmitted to a server. When the user is ready they click
"Download .apkg", which assembles the deck — including a real SQLite database —
in-memory using WebAssembly and streams the result to disk.

Two external dependencies are loaded from CDN:

| Dependency | CDN URL | Purpose |
|---|---|---|
| JSZip 3.10.2 | `cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js` | Zip the `.apkg` archive |
| sql.js 1.14.2 | `cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/sql-wasm.js` | SQLite compiled to WASM; builds `collection.anki2` |

The app has two parallel representations of the same code:

- **`index.html`** — the production artifact. The entire application (HTML,
  CSS, JS) lives in a single file. All logic is inlined in one `<script>` block
  as a classic IIFE. No ES modules are used. This file can be opened directly
  from disk or deployed to any static host (GitHub Pages, etc.).

- **`src/` + `main.js`** — the modular form of the same logic, split into ES
  module files with JSDoc annotations. `index.html` loads `main.js` as
  `<script type="module">`, which imports from all the `src/` files. `test.html`
  imports the pure functions from the same source modules directly.

---

## 2. File Structure

```
ankiapp/
├── index.html          # Complete self-contained app (HTML + CSS + JS in one file)
├── test.html           # In-browser unit test runner (pure functions only)
├── README.md           # User-facing usage instructions and GitHub Pages how-to
├── DESIGN.md           # This document
└── src/                # ES modules; loaded by main.js, imported directly by test.html
    ├── db.js           # Low-level IndexedDB CRUD helpers (idbPut/Get/Delete/GetAllKeys)
    ├── images.js       # High-level image management built on db.js (store/fetch/remove/gc)
    ├── cards.js        # Card typedef, createCard(), persist(), loadCards() with migration
    ├── apkg.js         # .apkg generation: sql.js WASM + JSZip → Blob
    ├── ui.js           # DOM rendering: card list, image galleries, status bar
    └── utils.js        # Pure helpers: escapeHtml, slugify, sanitizeFileBase, getLastItem
```

### File descriptions

| File | Responsibility |
|---|---|
| `index.html` | HTML + CSS shell. Loads JSZip and sql.js as CDN globals, then loads `main.js` as `<script type="module">`. Contains no JavaScript logic of its own. |
| `main.js` | App entry point. Owns the `cards[]` array and pending-image state; wires all event listeners; drives startup (loadCards → render). |
| `test.html` | Standalone test page. Imports pure functions directly from `src/` modules and runs them through a minimal describe/it runner. Opens in any browser served over HTTP. |
| `src/db.js` | Opens and caches the `cardCatalogMedia` IndexedDB connection. Exports `idbPut`, `idbGet`, `idbDelete`, `idbGetAllKeys`. All functions return Promises. |
| `src/images.js` | Wraps `db.js` with domain logic. Generates image IDs, stores/fetches arrays of data URLs, runs GC. |
| `src/cards.js` | Defines the `Card` type. Exports `createCard` (validate + construct), `persist` (write to localStorage), `loadCards` (read from localStorage + resolve images from IDB, with migration). |
| `src/apkg.js` | Owns the entire `.apkg` build pipeline: SQL schema, sql.js invocation, card/note insertion, media embedding, JSZip assembly. |
| `src/ui.js` | Pure DOM functions. `render` rebuilds the card list. `renderGallery` / `wireImageInput` manage the image pickers. `setStatus` updates the status bar. |
| `src/utils.js` | Side-effect-free helpers. Used by both `ui.js` and `apkg.js`. Safe to import in test contexts. |

---

## 3. Module Dependency Graph

The `src/` modules have a clean layered structure with no cycles:

```
                  ┌────────────────────────────────────────────────┐
                  │                   main.js                       │
                  │  (not yet written; would replace the IIFE in    │
                  │   index.html and wire the modules together)      │
                  └───┬────────┬─────────┬──────────┬──────────────┘
                      │        │         │          │
                      ▼        ▼         ▼          ▼
                  cards.js  apkg.js   ui.js      (direct DOM)
                      │        │         │
                      │        ▼         ▼
                      │     utils.js   utils.js
                      │
                      ▼
                  images.js
                      │
                      ▼
                   db.js
```

Detailed import edges:

| Module | Imports from |
|---|---|
| `db.js` | — (no imports) |
| `images.js` | `db.js` |
| `cards.js` | `images.js` |
| `utils.js` | — (no imports) |
| `apkg.js` | `utils.js` |
| `ui.js` | `utils.js` |
| `main.js` (future) | `cards.js`, `images.js`, `apkg.js`, `ui.js`, `utils.js` |

`apkg.js` does not import `cards.js`. It consumes a plain array of card-shaped
objects, so the `Card` type is a structural contract rather than an import
dependency.

---

## 4. Data Model

### Card typedef

```js
/**
 * @typedef {Object} Card
 * @property {string}   front         - Front (question) text. May be empty if
 *                                      frontImages is non-empty.
 * @property {string}   back          - Back (answer) text. May be empty if
 *                                      backImages is non-empty.
 * @property {string}   tags          - Space-separated tag string (Anki format).
 * @property {string[]} frontImages   - Data URLs of front-side images.
 *                                      IN-MEMORY ONLY. Never written to localStorage.
 * @property {string[]} frontImageIds - IndexedDB keys for front images.
 *                                      Persisted to localStorage.
 * @property {string[]} backImages    - Data URLs of back-side images.
 *                                      IN-MEMORY ONLY.
 * @property {string[]} backImageIds  - IndexedDB keys for back images.
 *                                      Persisted to localStorage.
 */
```

### Dual storage split explained

Each image exists in two places simultaneously:

1. **IndexedDB** (`cardCatalogMedia` / `images` store): holds the raw data URL
   string (e.g. `data:image/png;base64,...`), keyed by a generated ID of the
   form `img_<timestamp>_<random>`. This is the source of truth for image bytes.

2. **In-memory `Card` object** (`frontImages` / `backImages`): a copy of the
   data URL is kept on the card object so that the render path can build `<img
   src="...">` tags synchronously without an async IndexedDB round-trip on every
   re-render.

The **localStorage** record stores only the IDs (`frontImageIds`,
`backImageIds`), never the data URLs. This keeps localStorage usage proportional
to the number of cards rather than the total image size, which matters because
localStorage is capped at ~5 MB in most browsers while IndexedDB is effectively
unlimited.

The in-memory data URL and the IndexedDB blob are always consistent: `storeImages`
writes to IndexedDB before the card is added to the array, and `removeImages` is
called after the card is removed from the array.

---

## 5. Storage Architecture

| What | Where | Why |
|---|---|---|
| Card text (`front`, `back`, `tags`) | localStorage | Small, synchronous, survives page refresh |
| Image IDs (`frontImageIds`, `backImageIds`) | localStorage | Small (just strings like `img_1234_abc`), must co-locate with card metadata for atomic persist |
| Image data URLs | IndexedDB | Can be many MB; IndexedDB has no meaningful quota; avoids localStorage overflow |
| Image data URLs (copy) | In-memory (`Card.frontImages` / `Card.backImages`) | Synchronous access for render; avoids async IDB reads on every re-render |
| Deck name | localStorage (`cardCatalog.deckName.v1`) | User preference; small |
| File name | localStorage (`cardCatalog.fileName.v1`) | User preference; small |

### localStorage keys

| Key | Value |
|---|---|
| `cardCatalog.cards.v1` | JSON array of `{ front, back, tags, frontImageIds?, backImageIds? }` |
| `cardCatalog.deckName.v1` | Plain string deck name |
| `cardCatalog.fileName.v1` | Plain string download file base name |

### IndexedDB schema

- Database name: `cardCatalogMedia`, version `1`
- Object store: `images` (out-of-line key, no key path)
  - Key: `string` — the image ID (`img_<ts>_<random>`)
  - Value: `string` — the full data URL

---

## 6. Key Flows

### 6.1 Startup

```
page load
  │
  ├─ CDN scripts load (JSZip, sql-wasm.js)
  │
  └─ IIFE runs
       │
       ├─ SQL.Database initialisation begins (async, non-blocking)
       │   sql.js fetches the WASM binary; stored in _sqlJsReady promise
       │
       ├─ DOM elements collected, event listeners attached
       │
       ├─ localStorage preferences restored (deck name, file name)
       │
       └─ initCards() / loadCards() [async]
            │
            ├─ Read STORAGE_KEY from localStorage; parse JSON
            │
            ├─ For each raw record:
            │    ├─ If frontImageIds present → fetchImages(ids) from IDB
            │    │    └─ Drop any IDs whose IDB value is null (orphan cleanup)
            │    └─ Else (old format) → storeImages(dataUrls) → migration
            │
            ├─ If migrated === true → persist() (rewrite localStorage, IDs only)
            │
            ├─ gcImages() [fire-and-forget]
            │    └─ idbGetAllKeys() → find keys not in any card → idbDelete()
            │
            └─ render()
                 └─ Build .entry elements from cards[]; inject thumbnails
                    from card.frontImages / card.backImages (data URLs, synchronous)
```

### 6.2 Filing a card ("File this card" button)

```
user clicks "File this card"
  │
  ├─ Button disabled (prevents double-submit)
  │
  ├─ storeImages(pendingFrontImages) → IndexedDB writes → returns frontImageIds
  ├─ storeImages(pendingBackImages)  → IndexedDB writes → returns backImageIds
  │   [if either throws: removeImages() on already-stored IDs; show error; return]
  │
  ├─ createCard(front, back, tags, frontImages, frontImageIds, backImages, backImageIds)
  │    ├─ Validates: at least one of (text, images) must be non-empty per side
  │    └─ Returns Card object (or null on failure)
  │        [if null: removeImages(all ids just stored); show error; return]
  │
  ├─ cards.push(card)
  │
  ├─ persist(cards) → JSON.stringify → localStorage.setItem
  │    └─ Returns false if quota exceeded → show error (card is still in memory)
  │
  ├─ render()
  │
  └─ resetPendingImages() — clears pendingFrontImages, pendingBackImages arrays
       and re-renders the empty galleries
```

**Critical ordering**: `storeImages` must complete before `createCard` and
`cards.push` so that the IDs exist in IndexedDB by the time `persist` writes
them to localStorage. If the page is refreshed after `persist` but before the
IDB write, the IDs would be dangling. The current code avoids this by writing
IDB first.

### 6.3 Deleting a card (remove button)

```
user clicks × on a card entry
  │
  ├─ Identify idx from data-idx attribute
  ├─ Collect imgIds = card.frontImageIds ++ card.backImageIds
  │
  ├─ cards.splice(idx, 1)      ← mutates array in place, preserving reference
  │
  ├─ persist(cards)            ← rewrites localStorage without the deleted card
  │
  ├─ render()                  ← rebuilds DOM
  │
  └─ removeImages(imgIds)      ← fire-and-forget IDB delete
       └─ Intentionally after render() so the UI is fast;
          image bytes are large and deletion is not on the critical path
```

Note: `clearAllBtn` follows the same pattern but collects all IDs first, then
reassigns `cards = []` (acceptable in the IIFE since there are no external
references to the array). In the `src/` module design, callers should use
`cards.splice(0, cards.length)` to preserve the array reference.

### 6.4 Exporting a deck (.apkg)

```
user clicks "Download .apkg"
  │
  ├─ Guard: cards.length === 0 → error
  │
  ├─ exportBtn disabled + label changed to "Building deck…"
  │
  └─ buildApkg(deckName, cards) [async]
       │
       ├─ await getSqlJs()         ← resolves the CDN WASM promise (usually
       │                              already resolved; zero-wait on second click)
       │
       ├─ new SQL.Database()
       ├─ db.run(TEMPLATE_SQL)     ← creates col/notes/cards/revlog/graves tables
       │                              and inserts one template row into col
       │
       ├─ Read col.decks and col.models JSON blobs
       ├─ Mutate the template deck/model: set name, id, did; re-insert under new key
       ├─ db.run('UPDATE col SET decks/models=?')
       │
       ├─ For each card in cardList:
       │    ├─ sha1Hex(deckId + front + back + i) → noteGuid (10 hex chars)
       │    ├─ toAnkiHtml(front/back): escape HTML, convert \n → <br>
       │    ├─ For each image: assign filename img_<noteId>_front/back_<n>.<ext>
       │    │    ├─ media.push({ filename, bytes: dataUrlToBytes(dataUrl) })
       │    │    └─ Append <br><img src="filename"> to frontHtml / backHtml
       │    ├─ flds = frontHtml + \x1f + backHtml   (\x1f is Anki field separator)
       │    ├─ csum = checksumFromHex(sha1Hex(flds)) (first 8 hex chars → uint32)
       │    ├─ db.run('INSERT INTO notes VALUES(...)')
       │    └─ db.run('INSERT INTO cards VALUES(...)')
       │
       ├─ db.export()   → Uint8Array of SQLite binary
       ├─ db.close()
       │
       ├─ new JSZip()
       │    ├─ zip.file('collection.anki2', binaryArray)
       │    ├─ For each media item: zip.file(String(idx), item.bytes)
       │    └─ zip.file('media', JSON.stringify({ "0": "img_...", ... }))
       │
       └─ zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' })
            └─ Trigger download via temporary <a> element + URL.createObjectURL
```

The `mimeType: 'application/octet-stream'` is intentional: some mobile browsers
would rename a `application/zip` file to `.zip`, breaking the Anki import.

---

## 7. Backwards Compatibility

The app has accumulated two image storage formats and handles all three
transparently during `loadCards` / `initCards`:

| Era | localStorage fields | Handling |
|---|---|---|
| Oldest (pre-multi-image) | `frontImage` (string), `backImage` (string) | Wrapped in `[...]` to form a one-element array, then migrated to IDB |
| Old (multi-image, pre-IDB) | `frontImages` (string[]), `backImages` (string[]) | Data URLs moved to IDB; IDs written back via `persist()` |
| Current | `frontImageIds` (string[]), `backImageIds` (string[]) | IDs resolved from IDB; data URLs hydrated into memory |

Migration is performed on first load and is transparent to the user. The
`migrated` flag returned by `loadCards` tells the caller to call `persist()`
immediately so that subsequent loads use the new format. The old data URL
content is never deleted from localStorage by the migration itself — it is
overwritten when `persist()` rewrites the key with the new format (IDs only).

After migration, `gcImages` is called to clean up any orphaned IDB entries
(e.g. images that were stored but whose cards were deleted while offline, or
failed half-migrations).

---

## 8. Important Invariants

The following invariants must be preserved by any agent editing this codebase.
Violating them can cause data loss or corrupt the deck export.

### 8.1 Images are never stored in localStorage

`persist()` / `loadCards()` only write `frontImageIds` and `backImageIds` to
localStorage. Data URLs must never appear in the JSON written to `STORAGE_KEY`.
Storing them there would cause quota errors for even modest image sizes and
break the storage split design.

### 8.2 `storeImages` must complete before `cards.push` and `persist`

The write order is strict:

1. `storeImages(dataUrls)` → IDB write, returns `ids`
2. `createCard(...)` with the returned `ids`
3. `cards.push(card)`
4. `persist(cards)` → localStorage write with `ids`

If steps 3-4 execute before step 1, localStorage records will reference IDB
keys that do not yet exist. A page reload before the IDB write completes would
make those images irrecoverable.

### 8.3 Use `cards.splice(0, cards.length)` not `cards = []`

The `src/` module design passes the `cards` array by reference to `wireImageInput`,
`gcImages`, and event handlers. Reassigning `cards = []` replaces the reference
and breaks those closures. Use `splice` to mutate the array in place.

(The monolithic `index.html` IIFE currently uses `cards = []` in `clearAllBtn`
because it owns the closure, but this is a known inconsistency that must not be
replicated in the modular version.)

### 8.4 `persist()` returns a boolean; callers must surface `false` as an error

`persist` returns `false` when `localStorage.setItem` throws a quota error. The
card is still in memory but will be lost on page reload. Callers must check the
return value and display an error message telling the user to export before
refreshing. Silently swallowing `false` leads to silent data loss.

```js
const saved = persist(cards);
if (!saved) setStatus('Card NOT saved — local storage is full. Export now.', 'err');
```

### 8.5 `gcImages` is fire-and-forget; never `await` it in the main flow

`gcImages` does an `idbGetAllKeys` scan and then deletes orphans. It is designed
to run asynchronously in the background after startup without blocking the render
path. Awaiting it in the startup flow would delay first render by one full IDB
round-trip. Errors inside it are caught and suppressed because GC failure is
non-fatal — the orphan bytes will be cleaned up on the next startup.
