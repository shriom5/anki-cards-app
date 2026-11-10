import { getLastItem } from './utils.js';

// ---------------------------------------------------------------------------
// Schema SQL for a blank Anki 2.x collection (collection.anki2)
// ---------------------------------------------------------------------------

const TEMPLATE_SQL = [
  'PRAGMA foreign_keys=OFF;',
  'BEGIN TRANSACTION;',
  'CREATE TABLE col (',
  '    id              integer primary key,',
  '    crt             integer not null,',
  '    mod             integer not null,',
  '    scm             integer not null,',
  '    ver             integer not null,',
  '    dty             integer not null,',
  '    usn             integer not null,',
  '    ls              integer not null,',
  '    conf            text not null,',
  '    models          text not null,',
  '    decks           text not null,',
  '    dconf           text not null,',
  '    tags            text not null',
  ');',
  'INSERT INTO "col" VALUES(',
  '  1,',
  '  1388548800,',
  '  1435645724219,',
  '  1435645724215,',
  '  11,',
  '  0,',
  '  0,',
  '  0,',
  '  \'{"nextPos": 1, "estTimes": true, "activeDecks": [1], "sortType": "noteFld", "timeLim": 0, "sortBackwards": false, "addToCur": true, "curDeck": 1, "newBury": true, "newSpread": 0, "dueCounts": true, "curModel": "1435645724216", "collapseTime": 1200}\',',
  '  \'{"1388596687391": {"vers": [], "name": "Basic-f15d2", "tags": ["Tag"], "did": 1435588830424, "usn": -1, "req": [[0, "all", [0]]], "flds": [{"name": "Front", "media": [], "sticky": false, "rtl": false, "ord": 0, "font": "Arial", "size": 20}, {"name": "Back", "media": [], "sticky": false, "rtl": false, "ord": 1, "font": "Arial", "size": 20}], "sortf": 0, "latexPre": "\\\\documentclass[12pt]{article}\\n\\\\special{papersize=3in,5in}\\n\\\\usepackage[utf8]{inputenc}\\n\\\\usepackage{amssymb,amsmath}\\n\\\\pagestyle{empty}\\n\\\\setlength{\\\\parindent}{0in}\\n\\\\begin{document}\\n", "tmpls": [{"name": "Card 1", "qfmt": "{{Front}}", "did": null, "bafmt": "", "afmt": "{{Back}}", "ord": 0, "bqfmt": ""}], "latexPost": "\\\\end{document}", "type": 0, "id": 1388596687391, "css": ".card {\\n font-family: arial;\\n font-size: 20px;\\n text-align: center;\\n color: black;\\n background-color: white;\\n}\\n", "mod": 1435645658}}\',',
  '  \'{"1": {"desc": "", "name": "Default", "extendRev": 50, "usn": 0, "collapsed": false, "newToday": [0, 0], "timeToday": [0, 0], "dyn": 0, "extendNew": 10, "conf": 1, "revToday": [0, 0], "lrnToday": [0, 0], "id": 1, "mod": 1435645724}, "1435588830424": {"desc": "", "name": "Template", "extendRev": 50, "usn": -1, "collapsed": false, "newToday": [545, 0], "timeToday": [545, 0], "dyn": 0, "extendNew": 10, "conf": 1, "revToday": [545, 0], "lrnToday": [545, 0], "id": 1435588830424, "mod": 1435588830}}\',',
  '  \'{"1": {"name": "Default", "replayq": true, "lapse": {"leechFails": 8, "minInt": 1, "delays": [10], "leechAction": 0, "mult": 0}, "rev": {"perDay": 100, "fuzz": 0.05, "ivlFct": 1, "maxIvl": 36500, "ease4": 1.3, "bury": true, "minSpace": 1}, "timer": 0, "maxTaken": 60, "usn": 0, "new": {"perDay": 20, "delays": [1, 10], "separate": true, "ints": [1, 4, 7], "initialFactor": 2500, "bury": true, "order": 1}, "mod": 0, "id": 1, "autoplay": true}}\',',
  '  \'{}\'',
  ');',
  'CREATE TABLE notes (',
  '    id              integer primary key,',
  '    guid            text not null,',
  '    mid             integer not null,',
  '    mod             integer not null,',
  '    usn             integer not null,',
  '    tags            text not null,',
  '    flds            text not null,',
  '    sfld            text not null,',
  '    csum            integer not null,',
  '    flags           integer not null,',
  '    data            text not null',
  ');',
  'CREATE TABLE cards (',
  '    id              integer primary key,',
  '    nid             integer not null,',
  '    did             integer not null,',
  '    ord             integer not null,',
  '    mod             integer not null,',
  '    usn             integer not null,',
  '    type            integer not null,',
  '    queue           integer not null,',
  '    due             integer not null,',
  '    ivl             integer not null,',
  '    factor          integer not null,',
  '    reps            integer not null,',
  '    lapses          integer not null,',
  '    left            integer not null,',
  '    odue            integer not null,',
  '    odid            integer not null,',
  '    flags           integer not null,',
  '    data            text not null',
  ');',
  'CREATE TABLE revlog (',
  '    id              integer primary key,',
  '    cid             integer not null,',
  '    usn             integer not null,',
  '    ease            integer not null,',
  '    ivl             integer not null,',
  '    lastIvl         integer not null,',
  '    factor          integer not null,',
  '    time            integer not null,',
  '    type            integer not null',
  ');',
  'CREATE TABLE graves (',
  '    usn             integer not null,',
  '    oid             integer not null,',
  '    type            integer not null',
  ');',
  'ANALYZE sqlite_master;',
  'CREATE INDEX ix_notes_usn on notes (usn);',
  'CREATE INDEX ix_cards_usn on cards (usn);',
  'CREATE INDEX ix_revlog_usn on revlog (usn);',
  'CREATE INDEX ix_cards_nid on cards (nid);',
  'CREATE INDEX ix_cards_sched on cards (did, queue, due);',
  'CREATE INDEX ix_revlog_cid on revlog (cid);',
  'CREATE INDEX ix_notes_csum on notes (csum);',
  'COMMIT;',
].join('\n');

// ---------------------------------------------------------------------------
// Lazy sql.js initialisation — does NOT run at module load time
// ---------------------------------------------------------------------------

let _sqlJsReady = null;

function getSqlJs() {
  if (!_sqlJsReady) {
    _sqlJsReady = window.initSqlJs({
      locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/${f}`,
    });
  }
  return _sqlJsReady;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Returns the SHA-1 digest of `str` as a lowercase hex string.
 * @param {string} str
 * @returns {Promise<string>}
 */
async function sha1Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-1', enc);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Escapes HTML special characters and converts newlines to `<br>` tags,
 * producing the HTML string that Anki stores in the `flds` column.
 *
 * @param {string} text - Plain text from the card front or back field.
 * @returns {string} HTML-escaped string safe to embed in Anki field content.
 */
export const toAnkiHtml = text =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

/**
 * Decodes a data URL to a `Uint8Array` of the raw image bytes.
 *
 * @param {string} dataUrl - A `data:image/...;base64,...` URL.
 * @returns {Uint8Array}
 */
export const dataUrlToBytes = dataUrl => {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/**
 * Extracts the file extension that should be used for an image stored as a
 * data URL (e.g. `"jpg"`, `"png"`, `"gif"`, `"svg"`).
 *
 * @param {string} dataUrl - A `data:image/...;base64,...` URL.
 * @returns {string} Lowercase file extension without the leading dot.
 */
export const extFromDataUrl = dataUrl => {
  const m = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);/);
  if (!m) return 'png';
  const t = m[1].toLowerCase();
  if (t === 'jpeg') return 'jpg';
  if (t === 'svg+xml') return 'svg';
  return t;
};

/**
 * Converts the first 8 hex characters of a SHA-1 digest to the unsigned
 * 32-bit integer that Anki stores as the `csum` (checksum) column value in
 * the `notes` table.
 *
 * @param {string} hex - Full hex string from {@link sha1Hex}.
 * @returns {number}
 */
export const checksumFromHex = hex => parseInt(hex.substring(0, 8), 16);

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Builds an Anki deck package (.apkg) in memory and returns it as a Blob.
 *
 * ## .apkg format
 * An .apkg file is a ZIP archive (mimetype `application/octet-stream`) that
 * contains three kinds of entries:
 *
 * - **`collection.anki2`** — a SQLite database file that holds the deck
 *   schema (tables `col`, `notes`, `cards`, `revlog`, `graves`).  The `col`
 *   table stores deck and model metadata as JSON blobs.  Each flash card
 *   produces one row in `notes` (the content) and one row in `cards` (the
 *   scheduling metadata).
 *
 * - **`media`** — a JSON object that maps sequential integer keys
 *   (`"0"`, `"1"`, …) to the original filenames of the attached images
 *   (e.g. `{"0": "img_123_front_0.jpg", "1": "img_123_back_0.png"}`).
 *
 * - **Numbered image files** (`"0"`, `"1"`, …) — the raw image bytes, keyed
 *   by the same integer strings used in the media manifest.  The HTML stored
 *   in `notes.flds` references images by their original filenames; Anki uses
 *   the media manifest to resolve those names to the numbered zip entries.
 *
 * JSZip is consumed via the global `window.JSZip` loaded by the CDN script
 * tag in the host page — it is not imported as an ES module.
 *
 * @param {string} deckName
 *   Human-readable name shown in the Anki deck list (e.g. `"My Deck"`).
 *
 * @param {Array<{
 *   front: string,
 *   back: string,
 *   tags?: string,
 *   frontImages?: string[],
 *   frontImage?: string,
 *   backImages?: string[],
 *   backImage?: string
 * }>} cardList
 *   Array of card objects.  `frontImages`/`backImages` are arrays of data
 *   URLs; the legacy single-image fields `frontImage`/`backImage` are also
 *   supported transparently.
 *
 * @returns {Promise<Blob>} A Blob with mimetype `application/octet-stream`
 *   that can be downloaded directly as a `.apkg` file and imported via
 *   Anki's File → Import menu.
 */
export async function buildApkg(deckName, cardList) {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  db.run(TEMPLATE_SQL);
  const SEP = '\x1f'; // Anki field separator

  const getId = (table, col, ts) => {
    const stmt = db.prepare(
      `SELECT ${col} as v FROM ${table} WHERE ${col} >= :ts ORDER BY ${col} DESC LIMIT 1`
    );
    stmt.bind({ ':ts': ts });
    let v = null;
    if (stmt.step()) v = stmt.getAsObject().v;
    stmt.free();
    return v ? +v + 1 : ts;
  };

  const getInitialRowValue = (table, col) => {
    const res = db.exec(`SELECT ${col} FROM ${table}`);
    return JSON.parse(res[0].values[0][0]);
  };

  const now = Date.now();
  const topDeckId  = getId('cards', 'did', now);
  const topModelId = getId('notes', 'mid', now + 1);
  const media = [];

  // --- update decks ---
  const decks = getInitialRowValue('col', 'decks');
  const deck = getLastItem(decks);
  deck.name = deckName;
  deck.id   = topDeckId;
  decks[String(topDeckId)] = deck;
  db.run('UPDATE col SET decks=? WHERE id=1', [JSON.stringify(decks)]);

  // --- update models ---
  const models = getInitialRowValue('col', 'models');
  const model = getLastItem(models);
  model.name = deckName;
  model.did  = topDeckId;
  model.id   = topModelId;
  models[String(topModelId)] = model;
  db.run('UPDATE col SET models=? WHERE id=1', [JSON.stringify(models)]);

  // --- insert notes + cards ---
  for (let i = 0; i < cardList.length; i++) {
    const c = cardList[i];
    const cardNow = Date.now() + i;
    const guidHex = await sha1Hex(`${topDeckId}${c.front}${c.back}${i}`);
    const noteGuid = guidHex.substring(0, 10);
    const noteId   = getId('notes', 'id', cardNow);
    let frontHtml  = toAnkiHtml(c.front);
    let backHtml   = toAnkiHtml(c.back);

    // support both old single-image and new multi-image storage format
    const frontImgs = c.frontImages || (c.frontImage ? [c.frontImage] : []);
    const backImgs  = c.backImages  || (c.backImage  ? [c.backImage]  : []);

    for (const [imgIdx, dataUrl] of frontImgs.entries()) {
      const ext      = extFromDataUrl(dataUrl);
      const filename = `img_${noteId}_front_${imgIdx}.${ext}`;
      media.push({ filename, bytes: dataUrlToBytes(dataUrl) });
      frontHtml += `<br><img src="${filename}">`;
    }

    for (const [imgIdx, dataUrl] of backImgs.entries()) {
      const ext      = extFromDataUrl(dataUrl);
      const filename = `img_${noteId}_back_${imgIdx}.${ext}`;
      media.push({ filename, bytes: dataUrlToBytes(dataUrl) });
      backHtml += `<br><img src="${filename}">`;
    }

    const flds     = `${frontHtml}${SEP}${backHtml}`;
    const fldsHash = await sha1Hex(flds);
    const strTags  = c.tags ? ` ${c.tags.replace(/,/g, ' ').trim()} ` : '';

    db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)', [
      noteId, noteGuid, topModelId, getId('notes', 'mod', cardNow), -1,
      strTags, flds, frontHtml, checksumFromHex(fldsHash), 0, '',
    ]);

    const cardId = getId('cards', 'id', cardNow);
    db.run('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      cardId, noteId, topDeckId, 0,
      getId('cards', 'mod', cardNow),
      -1, 0, 0, i + 1, 0, 0, 0, 0, 0, 0, 0, 0, '',
    ]);
  }

  const binaryArray = db.export();
  db.close();

  // --- build zip ---
  const zip = new window.JSZip();
  zip.file('collection.anki2', binaryArray);

  const mediaManifest = {};
  for (const [idx, item] of media.entries()) {
    mediaManifest[idx] = item.filename;
    zip.file(String(idx), item.bytes);
  }
  zip.file('media', JSON.stringify(mediaManifest));

  // application/octet-stream keeps mobile browsers from renaming .apkg to .zip
  return zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });
}
