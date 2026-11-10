# Card Catalog

A browser app for making Anki flashcard decks. Type your cards, hit download, import the file into Anki. No account, no backend, nothing leaves your browser.

Images are supported — you can attach multiple photos to either side of a card. Cards and images are stored locally in your browser until you export.

## Usage

1. Type a front (question) and back (answer). Add images if you want.
2. Click **File this card** (or Cmd/Ctrl+Enter).
3. Repeat until done.
4. Set a deck name at the bottom and click **Download .apkg**.
5. In Anki: **File → Import**, pick the file.

For bulk entry, click **+ paste in several cards at once** and paste tab-separated or pipe-separated lines (`front | back`).

## Running locally

```
python3 -m http.server 7823
```

Then open `http://localhost:7823`.

## Code layout

```
index.html      HTML + CSS shell
main.js         entry point — event wiring and startup
src/
  cards.js      card model, localStorage persistence, load/migrate
  images.js     IndexedDB image store (store, fetch, garbage-collect)
  db.js         raw IndexedDB helpers
  ui.js         render, gallery, status bar
  apkg.js       .apkg export (SQLite via WASM + JSZip)
  utils.js      pure utility functions
test.html       unit tests (open in browser, 55 tests)
DESIGN.md       architecture notes for contributors
```

## How export works

`.apkg` is a zip file containing a SQLite database (`collection.anki2`) and a media manifest. This app builds that database entirely in the browser using [sql.js](https://github.com/sql-js/sql.js) (SQLite compiled to WebAssembly) and packages it with [JSZip](https://stuk.github.io/jszip/). Both are loaded from CDN — no server needed.
