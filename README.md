# Card Catalog — Anki Deck Builder

A single-page app for typing up Anki flashcards and downloading them as a
`.apkg` file you can import straight into Anki. It's one self-contained
`index.html` file — no build step, no backend, no server-side code at all.
Cards you type in are kept in your browser's local storage until you export
them; nothing is ever sent to a server.

## Host it on GitHub Pages (free, public, anyone can use it)

1. Create a new **public** GitHub repository (e.g. `card-catalog`).
2. Upload `index.html` to the root of that repository (drag-and-drop on
   github.com works fine, or `git add` / `git commit` / `git push` if you're
   using the command line).
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to `Deploy from a branch`,
   pick branch `main` (or whichever branch has the file) and folder `/ (root)`,
   then click **Save**.
5. GitHub will give you a live URL after a minute or two, usually:
   `https://<your-username>.github.io/<repo-name>/`
6. That's it — anyone with the link can open it and build a deck.

## Using the app

- Fill in **Front** and **Back** for a card and click **File this card**.
- Click **+ paste in several cards at once** to add many cards in one go —
  one per line, front and back separated by a tab or a `|`.
- Tags are optional and space-separated.
- Set a **Deck name** at the bottom, then click **Download .apkg**.
- In Anki: **File → Import**, pick the downloaded `.apkg`.

## How the export works, briefly

Anki's `.apkg` format is a zip file containing a SQLite database
(`collection.anki2`) plus a `media` manifest. The app builds that SQLite
database entirely in the browser using [sql.js](https://github.com/sql-js/sql.js)
(SQLite compiled to WebAssembly) and zips it with
[JSZip](https://stuk.github.io/jszip/), both loaded from a CDN — so it works
on GitHub Pages with zero server code. Card text is stored as basic HTML
(Anki fields render as HTML), so `<`, `>`, `&` and line breaks are handled
for you.

## Customizing

Everything — layout, colors, fonts, the export logic — lives in the one
`index.html` file, so it's easy to tweak. The card generation code is in the
`buildApkg` function near the bottom of the `<script>` block.
