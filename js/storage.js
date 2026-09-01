import { IDB_PREFIX, putImage, getImage, deleteImage, dataUrlToBlob, blobToDataUrl } from "./imageStore.js";
import { getStorageUsage } from "./lazyImage.js";

const CARDS_KEY = "mc_cards_v1";
const BOARDS_KEY = "mc_boards_v1";
const MEASUREMENTS_KEY = "mc_measurements_v1";
const THEME_KEY = "mc_theme_v1";
const UNIT_KEY = "mc_unit_v1";
const SIZE_PREFS_KEY = "mc_size_prefs_v1";
const MEASUREMENT_NOTES_KEY = "mc_measurement_notes_v1";
const CHECKLISTS_KEY = "mc_checklists_v1";
const HOME_TITLE_KEY = "mc_home_title_v1";
const LAST_SEEN_VERSION_KEY = "mc_last_seen_version_v1";
const LAST_BACKUP_KEY = "mc_last_backup_at_v1";
const BACKUP_BANNER_DISMISSED_KEY = "mc_backup_banner_dismissed_at_v1";
const STORAGE_WARNING_DISMISSED_KEY = "mc_storage_warning_dismissed_at_v1";
const FIRST_OPEN_KEY = "mc_first_open_at_v1";
const ONBOARDING_SEEN_KEY = "mc_onboarding_seen_v1";
const IMAGES_MIGRATED_KEY = "mc_images_migrated_v1";
const STOCK_ITEMS_KEY = "mc_stock_items_v1";
const STOCK_SORT_KEY = "mc_stock_sort_v1";
const RESTOCK_BANNER_DISMISSED_KEY = "mc_restock_banner_dismissed_at_v1";
const TOMBSTONES_KEY = "mc_tombstones_v1";

export const WISHLIST_BOARD_ID = "wishlist";

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// A deleted record leaves no trace in its store to ever tell another device
// it's gone -- this is that trace. Recorded on every delete regardless of
// whether Cloud Backup is even configured (this module has no business
// knowing that), consumed and cleared by js/cloudBackup.js's pushAll once
// it's actually been synced. Harmless dead weight otherwise: a handful of
// small {store, recordId, deletedAt} rows for anyone who never turns Cloud
// Backup on.
function recordTombstone(store, recordId) {
  const tombstones = readJSON(TOMBSTONES_KEY, []);
  tombstones.push({ id: `${store}:${recordId}`, store, recordId, deletedAt: Date.now() });
  writeJSON(TOMBSTONES_KEY, tombstones);
}

export async function getTombstones() {
  return readJSON(TOMBSTONES_KEY, []);
}

export async function clearTombstones(ids) {
  const idSet = new Set(ids);
  writeJSON(TOMBSTONES_KEY, readJSON(TOMBSTONES_KEY, []).filter((t) => !idSet.has(t.id)));
}

// ---- Boards ----
// The Wishlist is a built-in board that always exists (id "wishlist") so a
// card can belong to it and to any number of ordinary moodboards at once.

function ensureWishlistBoard(boards) {
  if (boards.some((b) => b.id === WISHLIST_BOARD_ID)) return boards;
  return [{ id: WISHLIST_BOARD_ID, name: "Wishlist", isSystem: true, createdAt: Date.now() }, ...boards];
}

export function getBoards() {
  return ensureWishlistBoard(readJSON(BOARDS_KEY, []));
}

export function getBoard(id) {
  return getBoards().find((b) => b.id === id) || null;
}

export function createBoard(name) {
  const boards = getBoards();
  const board = { id: uid(), name: name.trim(), isSystem: false, createdAt: Date.now(), updatedAt: Date.now() };
  boards.push(board);
  writeJSON(BOARDS_KEY, boards);
  return board;
}

export function renameBoard(id, name) {
  const boards = getBoards();
  const idx = boards.findIndex((b) => b.id === id);
  if (idx < 0 || boards[idx].isSystem) return null;
  boards[idx] = { ...boards[idx], name: name.trim(), updatedAt: Date.now() };
  writeJSON(BOARDS_KEY, boards);
  return boards[idx];
}

// { tombstone: false } is for js/cloudBackup.js's applyRemoteDeletion only,
// replaying a deletion that already happened on another device -- same
// reasoning as deleteCard's option below.
export async function deleteBoard(id, { tombstone = true } = {}) {
  const board = getBoard(id);
  if (!board || board.isSystem) return;
  writeJSON(BOARDS_KEY, getBoards().filter((b) => b.id !== id));
  if (tombstone) recordTombstone("boards", id);
  const cards = getCards();
  for (const card of cards) {
    if (card.boardIds.includes(id)) {
      await saveCard({ ...card, boardIds: card.boardIds.filter((b) => b !== id) });
    }
  }
}

function upsertBoardByName(name, isSystem = false) {
  if (isSystem) return getBoard(WISHLIST_BOARD_ID);
  const norm = name.trim().toLowerCase();
  const existing = getBoards().find((b) => !b.isSystem && b.name.trim().toLowerCase() === norm);
  if (existing) return existing;
  return createBoard(name);
}

// ---- Cards ----

export function getCards() {
  return readJSON(CARDS_KEY, []);
}

export function getCard(id) {
  return getCards().find((c) => c.id === id) || null;
}

export async function saveCard(card) {
  const cards = getCards();
  const idx = cards.findIndex((c) => c.id === card.id);
  const previous = idx >= 0 ? cards[idx] : null;

  // A fresh camera/library upload arrives as a Blob (see photo.js) — move it
  // into IndexedDB and store just a reference, since the actual bytes are
  // too big for localStorage's tiny quota. A link's image (or a re-saved
  // idb: reference) is already a plain string and passes through untouched.
  let image = card.image;
  if (image instanceof Blob) {
    image = IDB_PREFIX + card.id;
    await putImage(card.id, card.image);
  }
  if (previous?.image?.startsWith(IDB_PREFIX) && previous.image !== image) {
    await deleteImage(previous.image.slice(IDB_PREFIX.length)).catch(() => {});
  }

  const withTimestamp = { ...card, image, updatedAt: Date.now() };
  if (idx >= 0) cards[idx] = withTimestamp;
  else cards.push(withTimestamp);
  writeJSON(CARDS_KEY, cards);
  return withTimestamp;
}

// { tombstone: false } is for js/cloudBackup.js's applyRemoteDeletion only,
// replaying a deletion that already happened on another device -- recording
// a *new* tombstone for that would just re-push it right back with a
// fresher timestamp, and the row would never age out server-side.
export async function deleteCard(id, { tombstone = true } = {}) {
  const card = getCard(id);
  if (card?.image?.startsWith(IDB_PREFIX)) {
    await deleteImage(card.image.slice(IDB_PREFIX.length)).catch(() => {});
  }
  writeJSON(CARDS_KEY, getCards().filter((c) => c.id !== id));
  if (tombstone) recordTombstone("cards", id);
}

// The only caller of the { tombstone: false } option above -- js/cloudBackup.js's
// pullChanges routes a pulled deletion through here rather than calling
// deleteCard directly, so the sync-only intent is explicit at the call site
// instead of a bare `{ tombstone: false }` showing up in the middle of
// feature code.
export async function applyRemoteDeletion(store, recordId) {
  if (store === "cards") return deleteCard(recordId, { tombstone: false });
  if (store === "boards") return deleteBoard(recordId, { tombstone: false });
  if (store === "checklists") return deleteChecklist(recordId, { tombstone: false });
  if (store === "measurements") return deleteMeasurement(recordId, { tombstone: false });
  if (store === "stockItems") return deleteStockItem(recordId, { tombstone: false });
}

// A pulled record's image arrives as either a portable data: URI (from an
// old-style export, or another device that hasn't upgraded to
// storage-based image sync), a "storage:<store>:<id>" reference (revived
// lazily on first resolve, see cloudImageSync.js), a remote http(s) URL, or
// nothing -- only the data: URI case needs reviving into this device's own
// image store right away, keyed by the record's own id so every device
// agrees on the same image-store key for the same record.
async function reviveImage(image, id) {
  if (typeof image !== "string" || !image.startsWith("data:")) return image || null;
  try {
    await putImage(id, await dataUrlToBlob(image));
    return IDB_PREFIX + id;
  } catch {
    return null;
  }
}

function upsertById(key, records) {
  const existing = readJSON(key, []);
  for (const r of records) {
    const idx = existing.findIndex((e) => e.id === r.id);
    if (idx >= 0) existing[idx] = r;
    else existing.push(r);
  }
  writeJSON(key, existing);
}

// Generic upsert-by-id, used only by Cloud Backup's pull/merge step
// (js/cloudBackup.js) -- writes each record exactly as given, matching by
// its own id, unlike importData() below whose always-new-id behavior is
// only correct for a one-time file import, never for ongoing sync where two
// devices need to agree on the same id for the same record.
export async function upsertRecords(store, records) {
  if (!records.length) return;
  if (store === "boards") return upsertById(BOARDS_KEY, records);
  if (store === "checklists") return upsertById(CHECKLISTS_KEY, records);
  if (store === "measurements") return upsertById(MEASUREMENTS_KEY, records);
  if (store === "stockItems") return upsertById(STOCK_ITEMS_KEY, records);
  if (store !== "cards") return;
  const revived = await Promise.all(records.map(async (r) => ({ ...r, image: await reviveImage(r.image, r.id) })));
  const cards = getCards();
  for (const r of revived) {
    const idx = cards.findIndex((c) => c.id === r.id);
    if (idx >= 0) cards[idx] = r;
    else cards.push(r);
  }
  writeJSON(CARDS_KEY, cards);
}

// Rewrites just a card's image field, leaving everything else alone -- used
// only by cloudImageSync.js's download side (via createStorageResolver's
// injected patchRecordImage) to self-upgrade a pulled "storage:" reference
// to a plain local "idb:" one the first time it's actually resolved, so
// every later open is instant with no network round trip.
export async function patchCardImage(id, image) {
  const cards = getCards();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx < 0) return;
  cards[idx] = { ...cards[idx], image };
  writeJSON(CARDS_KEY, cards);
}

export function getCardsForBoard(boardId) {
  return getCards()
    .filter((c) => c.boardIds.includes(boardId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function createEmptyCard() {
  return {
    id: uid(),
    createdAt: Date.now(),
    kind: "link",
    url: "",
    image: "",
    title: "",
    note: "",
    price: "",
    currency: "",
    siteName: "",
    boardIds: [],
    wishlist: null,
  };
}

export function makeWishlistFields() {
  return { category: "top", garment: {}, sizeLabel: "" };
}

// ---- Measurements ----

export function getMeasurements() {
  return readJSON(MEASUREMENTS_KEY, []).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function getLatestMeasurement() {
  const all = getMeasurements();
  return all[0] || null;
}

export function saveMeasurement(entry) {
  const all = readJSON(MEASUREMENTS_KEY, []);
  const withTimestamp = { ...entry, updatedAt: Date.now() };
  const idx = all.findIndex((m) => m.id === entry.id);
  if (idx >= 0) all[idx] = withTimestamp;
  else all.push(withTimestamp);
  writeJSON(MEASUREMENTS_KEY, all);
  return withTimestamp;
}

// { tombstone: false } is for js/cloudBackup.js's applyRemoteDeletion only,
// replaying a deletion that already happened on another device -- same
// reasoning as deleteCard's option above.
export function deleteMeasurement(id, { tombstone = true } = {}) {
  writeJSON(MEASUREMENTS_KEY, readJSON(MEASUREMENTS_KEY, []).filter((m) => m.id !== id));
  if (tombstone) recordTombstone("measurements", id);
}

export function createEmptyMeasurement() {
  return { id: uid(), date: new Date().toISOString().slice(0, 10), values: {}, note: "" };
}

// A single persistent record of "sizes I usually wear" per garment
// category, kept separate from the dated measurement history — this is
// just a memory aid, not part of the wishlist sizing comparison.
export function getSizePrefs() {
  return readJSON(SIZE_PREFS_KEY, {});
}

export function setSizePrefs(prefs) {
  writeJSON(SIZE_PREFS_KEY, prefs);
  bumpPrefsUpdatedAt();
}

export function getMeasurementNotes() {
  return localStorage.getItem(MEASUREMENT_NOTES_KEY) || "";
}

export function setMeasurementNotes(text) {
  localStorage.setItem(MEASUREMENT_NOTES_KEY, text);
  bumpPrefsUpdatedAt();
}

// ---- Lists (checklists) ----
// Simple named checklists — e.g. "things to look for" shopping lists —
// kept separate from cards/boards since they have no image/link/price.

export function getChecklists() {
  return readJSON(CHECKLISTS_KEY, []);
}

export function getChecklist(id) {
  return getChecklists().find((l) => l.id === id) || null;
}

export function createChecklist(name) {
  const lists = getChecklists();
  const list = { id: uid(), name: name.trim(), createdAt: Date.now(), updatedAt: Date.now(), items: [] };
  lists.push(list);
  writeJSON(CHECKLISTS_KEY, lists);
  return list;
}

// A child item can't have its own children — nesting is a single level deep.
export function makeChecklistItem({ text = "" } = {}) {
  return { id: uid(), text, checked: false, children: [] };
}

export function saveChecklist(list) {
  const lists = getChecklists();
  const withTimestamp = { ...list, updatedAt: Date.now() };
  const idx = lists.findIndex((l) => l.id === list.id);
  if (idx >= 0) lists[idx] = withTimestamp;
  else lists.push(withTimestamp);
  writeJSON(CHECKLISTS_KEY, lists);
  return withTimestamp;
}

// { tombstone: false } is for js/cloudBackup.js's applyRemoteDeletion only,
// replaying a deletion that already happened on another device -- same
// reasoning as deleteCard's option above.
export function deleteChecklist(id, { tombstone = true } = {}) {
  writeJSON(CHECKLISTS_KEY, getChecklists().filter((l) => l.id !== id));
  if (tombstone) recordTombstone("checklists", id);
}

export function exportChecklistData(list) {
  return {
    type: "checklist",
    version: 1,
    exportedAt: new Date().toISOString(),
    checklists: [list],
  };
}

// ---- Stock items ----
// A flat table of everyday consumables (underwear, contact lenses, razor
// blades...) you buy on a cycle rather than saving once — deliberately
// separate from cards/boards, which are about things you're keeping.

export function getStockItems() {
  return readJSON(STOCK_ITEMS_KEY, []);
}

export function getStockItem(id) {
  return getStockItems().find((i) => i.id === id) || null;
}

export function saveStockItem(item) {
  const items = getStockItems();
  const idx = items.findIndex((i) => i.id === item.id);
  const withTimestamp = { ...item, updatedAt: Date.now() };
  if (idx >= 0) items[idx] = withTimestamp;
  else items.push(withTimestamp);
  writeJSON(STOCK_ITEMS_KEY, items);
  return withTimestamp;
}

// { tombstone: false } is for js/cloudBackup.js's applyRemoteDeletion only,
// replaying a deletion that already happened on another device -- same
// reasoning as deleteCard's option above.
export function deleteStockItem(id, { tombstone = true } = {}) {
  writeJSON(STOCK_ITEMS_KEY, getStockItems().filter((i) => i.id !== id));
  if (tombstone) recordTombstone("stockItems", id);
}

export function createEmptyStockItem() {
  return {
    id: uid(),
    createdAt: Date.now(),
    icon: "box",
    type: "",
    name: "",
    link: "",
    spec: "",
    replaceEveryValue: 3,
    replaceEveryUnit: "months",
    lastBought: new Date().toISOString().slice(0, 10),
    remindEnabled: false,
  };
}

export function getStockSort() {
  return localStorage.getItem(STOCK_SORT_KEY) || "restock";
}

export function setStockSort(mode) {
  localStorage.setItem(STOCK_SORT_KEY, mode);
}

const RESTOCK_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // re-ask 3 days after "Later"

export function dismissRestockBanner() {
  localStorage.setItem(RESTOCK_BANNER_DISMISSED_KEY, String(Date.now()));
}

// dueCount is passed in rather than computed here since the caller already
// needs the actual due items (for the banner's text), and the date math
// for "is this due" lives in stock.js, not storage.js.
export function shouldShowRestockBanner(dueCount) {
  if (!dueCount) return false;
  const dismissedAt = Number(localStorage.getItem(RESTOCK_BANNER_DISMISSED_KEY));
  if (dismissedAt && Date.now() - dismissedAt < RESTOCK_SNOOZE_MS) return false;
  return true;
}

// ---- Export / import ----

function referencedBoards(cards) {
  const ids = new Set();
  for (const card of cards) for (const id of card.boardIds) ids.add(id);
  return getBoards().filter((b) => ids.has(b.id));
}

// Exports inline each card's actual image bytes as a data: URI (resolving
// any idb: reference back out of IndexedDB first) so an exported file is
// fully self-contained and portable — it doesn't depend on this device's
// IndexedDB to be useful on another device or after a reinstall.
async function inlineImages(cards) {
  return Promise.all(
    cards.map(async (card) => {
      if (card.image?.startsWith(IDB_PREFIX)) {
        const blob = await getImage(card.image.slice(IDB_PREFIX.length));
        if (blob) return { ...card, image: await blobToDataUrl(blob) };
      }
      return card;
    })
  );
}

export async function exportBackupData() {
  return {
    type: "backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: await inlineImages(getCards()),
    boards: getBoards().filter((b) => !b.isSystem),
    measurements: getMeasurements(),
    sizePrefs: getSizePrefs(),
    measurementNotes: getMeasurementNotes(),
    checklists: getChecklists(),
    stockItems: getStockItems(),
    theme: getThemePref(),
    unit: getUnit(),
    homeTitle: getHomeTitle(),
  };
}

export async function exportCardData(card) {
  return {
    type: "card",
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: await inlineImages([card]),
    boards: referencedBoards([card]).filter((b) => !b.isSystem),
  };
}

export async function exportBoardData(board) {
  const cards = getCardsForBoard(board.id);
  return {
    type: "board",
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: await inlineImages(cards),
    boards: board.isSystem ? [] : [board],
  };
}

function importChecklists(data) {
  const importedChecklists = Array.isArray(data.checklists) ? data.checklists : [];
  if (importedChecklists.length) {
    const newLists = importedChecklists.map((l) => ({
      ...l,
      id: uid(),
      createdAt: Date.now(),
      items: (l.items || []).map((item) => ({ ...item, id: uid() })),
    }));
    writeJSON(CHECKLISTS_KEY, [...getChecklists(), ...newLists]);
  }
  return importedChecklists.length;
}

// All export shapes carry the same { cards, boards } structure (plus
// optional top-level measurements/checklists arrays), so one import path
// handles a single card, a single board, a single checklist, or a full
// backup alike. Always merges (adds new entries) rather than replacing
// anything, so a bad or repeated import can't destroy existing data —
// boards merge by name (system Wishlist maps straight to the local
// Wishlist), cards/measurements/checklists are always added as new.
export async function importData(data) {
  if (!data || !["backup", "card", "board", "checklist"].includes(data.type)) {
    throw new Error("That doesn't look like a My Closet export file.");
  }

  if (data.type === "checklist") {
    const checklistCount = importChecklists(data);
    return { cardCount: 0, boardCount: 0, measurementCount: 0, checklistCount };
  }

  if (!Array.isArray(data.cards)) {
    throw new Error("That doesn't look like a My Closet export file.");
  }

  const importedBoards = Array.isArray(data.boards) ? data.boards : [];
  const oldIdToLocalId = new Map([[WISHLIST_BOARD_ID, WISHLIST_BOARD_ID]]);
  for (const board of importedBoards) {
    const local = upsertBoardByName(board.name, board.isSystem);
    oldIdToLocalId.set(board.id, local.id);
  }

  // An imported card's image is a plain data: URI (inlined at export time,
  // see inlineImages above) — move it straight into IndexedDB rather than
  // leaving it sitting in localStorage, so importing a backup doesn't
  // immediately blow past the same quota this whole store exists to avoid.
  const newCards = await Promise.all(
    data.cards.map(async (c) => {
      const id = uid();
      let image = c.image;
      if (typeof image === "string" && image.startsWith("data:")) {
        try {
          await putImage(id, await dataUrlToBlob(image));
          image = IDB_PREFIX + id;
        } catch {
          // Couldn't decode/store it — fall back to keeping the raw
          // data: URI so the card still imports with its image intact.
        }
      }
      return {
        ...c,
        id,
        image,
        createdAt: Date.now(),
        boardIds: (c.boardIds || []).map((bid) => oldIdToLocalId.get(bid)).filter(Boolean),
      };
    })
  );
  writeJSON(CARDS_KEY, [...getCards(), ...newCards]);

  const importedMeasurements = Array.isArray(data.measurements) ? data.measurements : [];
  if (importedMeasurements.length) {
    const existing = readJSON(MEASUREMENTS_KEY, []);
    const remapped = importedMeasurements.map((m) => ({ ...m, id: uid() }));
    writeJSON(MEASUREMENTS_KEY, [...existing, ...remapped]);
  }

  // Size preferences and the general measurement notes are single blobs
  // rather than lists, so a straight "add as new" doesn't apply — fill in
  // only what's missing locally instead of overwriting anything you've
  // already filled in yourself.
  if (data.sizePrefs && typeof data.sizePrefs === "object") {
    const current = getSizePrefs();
    const merged = { ...current };
    for (const [key, value] of Object.entries(data.sizePrefs)) {
      if (!merged[key] && value) merged[key] = value;
    }
    setSizePrefs(merged);
  }
  if (data.measurementNotes) {
    const current = getMeasurementNotes();
    setMeasurementNotes(current ? `${current}\n\n${data.measurementNotes}` : data.measurementNotes);
  }

  const checklistCount = importChecklists(data);

  const importedStockItems = Array.isArray(data.stockItems) ? data.stockItems : [];
  if (importedStockItems.length) {
    const newStockItems = importedStockItems.map((i) => ({ ...i, id: uid(), createdAt: Date.now() }));
    writeJSON(STOCK_ITEMS_KEY, [...getStockItems(), ...newStockItems]);
  }

  // Theme, unit, and home title are single current-state settings, not
  // lists, so a full backup restore applies them directly rather than
  // merging -- that's what "restore my backup" means for a device's
  // preferences. Only present on a full backup (not a single card/board/
  // checklist share), and only fields actually in the file are touched.
  let preferencesApplied = false;
  if (data.type === "backup") {
    if (data.theme) setThemePref(data.theme);
    if (data.unit) setUnit(data.unit);
    if (data.homeTitle) setHomeTitle(data.homeTitle);
    preferencesApplied = Boolean(data.theme || data.unit || data.homeTitle);
  }

  return {
    cardCount: newCards.length,
    boardCount: importedBoards.length,
    measurementCount: importedMeasurements.length,
    checklistCount,
    stockItemCount: importedStockItems.length,
    preferencesApplied,
  };
}

// ---- Preferences ----

// Bumped by every setter below whose value is part of the Cloud Backup
// prefs bundle (see getPrefsSnapshot/applyPrefsSnapshot near the bottom of
// this section) -- gives that bundle a real "last changed" timestamp for
// last-write-wins, the same role createdAt/updatedAt plays for content
// records, without needing to touch every call site individually.
const PREFS_UPDATED_AT_KEY = "mc_prefs_updated_at_v1";

function bumpPrefsUpdatedAt() {
  localStorage.setItem(PREFS_UPDATED_AT_KEY, new Date().toISOString());
}

export function getThemePref() {
  return readJSON(THEME_KEY, {});
}

export function setThemePref(pref) {
  writeJSON(THEME_KEY, pref);
  bumpPrefsUpdatedAt();
}

export function getUnit() {
  return localStorage.getItem(UNIT_KEY) || "cm";
}

export function setUnit(unit) {
  localStorage.setItem(UNIT_KEY, unit);
  bumpPrefsUpdatedAt();
}

export function getHomeTitle() {
  return localStorage.getItem(HOME_TITLE_KEY) || "My Closet";
}

export function setHomeTitle(value) {
  const trimmed = (value || "").trim();
  if (trimmed) localStorage.setItem(HOME_TITLE_KEY, trimmed);
  else localStorage.removeItem(HOME_TITLE_KEY);
  bumpPrefsUpdatedAt();
}

// ---- Cloud Backup prefs sync ----
//
// Theme, unit, home title, size prefs, and measurement notes are also part
// of a local backup file (see exportBackupData/importData above) -- bundled
// the same way into a single Cloud Backup record (store: "prefs") so a
// device that pulls from Cloud Backup gets these back too, not just its
// cards. Single-blob values rather than id-keyed lists, so like theme/unit/
// homeTitle they travel as one last-write-wins record rather than their own
// syncable store. See js/cloudBackup.js's pushAll/pullChanges for where
// this record travels.
export function getPrefsSnapshot() {
  return {
    theme: getThemePref(),
    unit: getUnit(),
    homeTitle: getHomeTitle(),
    sizePrefs: getSizePrefs(),
    measurementNotes: getMeasurementNotes(),
  };
}

export function getPrefsUpdatedAt() {
  return localStorage.getItem(PREFS_UPDATED_AT_KEY) || null;
}

// Applied from a Cloud Backup pull -- unlike the setters above, stamps
// PREFS_UPDATED_AT_KEY with the record's own updatedAt (not "now") so this
// device's next push doesn't immediately re-send what it just received as
// if it were a fresh local edit.
export function applyPrefsSnapshot(prefs, updatedAt) {
  if (!prefs) return;
  if (prefs.theme) writeJSON(THEME_KEY, prefs.theme);
  if (prefs.unit) localStorage.setItem(UNIT_KEY, prefs.unit);
  if (prefs.homeTitle) {
    const trimmed = String(prefs.homeTitle).trim();
    if (trimmed) localStorage.setItem(HOME_TITLE_KEY, trimmed);
  }
  if (prefs.sizePrefs && typeof prefs.sizePrefs === "object") writeJSON(SIZE_PREFS_KEY, prefs.sizePrefs);
  if (typeof prefs.measurementNotes === "string") localStorage.setItem(MEASUREMENT_NOTES_KEY, prefs.measurementNotes);
  if (updatedAt) localStorage.setItem(PREFS_UPDATED_AT_KEY, updatedAt);
}

export function getLastSeenVersion() {
  return readJSON(LAST_SEEN_VERSION_KEY, null);
}

export function setLastSeenVersion(version) {
  writeJSON(LAST_SEEN_VERSION_KEY, version);
}

const BACKUP_REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks
const BACKUP_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // re-ask 3 days after "Later"

function getFirstOpenAt() {
  let v = Number(localStorage.getItem(FIRST_OPEN_KEY));
  if (!v) {
    v = Date.now();
    localStorage.setItem(FIRST_OPEN_KEY, String(v));
  }
  return v;
}

export function markBackedUp() {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  localStorage.removeItem(BACKUP_BANNER_DISMISSED_KEY);
}

export function dismissBackupBanner() {
  localStorage.setItem(BACKUP_BANNER_DISMISSED_KEY, String(Date.now()));
}

// Nudges toward exporting a backup every ~2 weeks, since all data lives only
// on this device. Tied to the last time a real export happened (or, if
// never, since first open) -- not to when the banner was last shown -- so
// dismissing with "Later" doesn't quietly reset the clock without an actual
// backup having happened.
export function shouldShowBackupBanner() {
  if (getCards().length === 0) return false;

  const lastBackupAt = Number(localStorage.getItem(LAST_BACKUP_KEY)) || getFirstOpenAt();
  if (Date.now() - lastBackupAt < BACKUP_REMIND_AFTER_MS) return false;

  const dismissedAt = Number(localStorage.getItem(BACKUP_BANNER_DISMISSED_KEY));
  if (dismissedAt && Date.now() - dismissedAt < BACKUP_SNOOZE_MS) return false;

  return true;
}

const STORAGE_WARNING_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // same 2-week cadence as the backup nudge

export function dismissStorageWarningBanner() {
  localStorage.setItem(STORAGE_WARNING_DISMISSED_KEY, String(Date.now()));
}

// Warns once local storage crosses 80% of the device's quota for this app,
// since finding out via a QuotaExceededError mid-upload or mid-sync is a
// much worse time than a quiet heads-up on Home. Best-effort: silently
// skipped wherever navigator.storage.estimate() isn't supported.
export async function shouldShowStorageWarning() {
  const usage = await getStorageUsage();
  if (!usage || usage.ratio < 0.8) return false;

  const dismissedAt = Number(localStorage.getItem(STORAGE_WARNING_DISMISSED_KEY));
  if (dismissedAt && Date.now() - dismissedAt < STORAGE_WARNING_SNOOZE_MS) return false;

  return true;
}

// One-time cleanup for anyone who saved photos before this store existed —
// their images are sitting in localStorage as huge inline data: URIs, which
// is exactly what fills up the quota. Moves each into IndexedDB and rewrites
// the card to reference it instead. Runs once (gated by a flag) and skips
// any card it can't process rather than letting one bad image block startup.
// Cheap, synchronous check for whether the migration below actually has
// anything to do — lets the caller (migrationNotice.js) decide whether to
// say anything, without needing to await the migration itself first.
export function hasLegacyImages() {
  return getCards().some((c) => typeof c.image === "string" && c.image.startsWith("data:"));
}

export async function migrateImagesToIndexedDB() {
  if (localStorage.getItem(IMAGES_MIGRATED_KEY) === "true") return;
  const cards = getCards();
  let changed = false;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (typeof card.image === "string" && card.image.startsWith("data:")) {
      try {
        await putImage(card.id, await dataUrlToBlob(card.image));
        cards[i] = { ...card, image: IDB_PREFIX + card.id };
        changed = true;
      } catch {
        // Leave this one as-is and keep going with the rest.
      }
    }
  }
  if (changed) writeJSON(CARDS_KEY, cards);
  localStorage.setItem(IMAGES_MIGRATED_KEY, "true");
}

// ---- Cloud Backup rejoin ----

// How many syncable content records exist on this device -- shown in the
// "Add this app" join flow (see settingsMenu.js) so someone reconnecting a
// device to a Cloud Backup project that's already backed up elsewhere can
// see, before they sync, whether this device has its own local items that
// would otherwise get pushed up as brand-new duplicates of what's already
// there. isSystem boards are never counted -- see ensureWishlistBoard.
export function getSyncableLocalContentCount() {
  return (
    getCards().length +
    getBoards().filter((b) => !b.isSystem).length +
    getChecklists().length +
    getMeasurements().length +
    getStockItems().length
  );
}

// Wipes every syncable content store (cards, boards, checklists,
// measurements, stock items) on this device only -- no tombstones recorded,
// since the point isn't to delete anything from the cloud, just to stop
// this device's own already-covered local copies from being pushed back up
// as new duplicate records the next time it syncs (Cloud Backup matches by
// record id, not content, so two independently-created copies of the same
// physical item never merge into one on their own). Used only from the
// "Add this app" join flow when reconnecting to a project that already has
// this data -- a Cloud Backup pull right after this repopulates everything
// from there. Preferences (theme/unit/etc.) are left alone; those come back
// from the same pull via the "prefs" record either way.
export async function clearLocalContentForRejoin() {
  for (const card of getCards()) {
    if (card.image?.startsWith(IDB_PREFIX)) {
      await deleteImage(card.image.slice(IDB_PREFIX.length)).catch(() => {});
    }
  }
  writeJSON(CARDS_KEY, []);
  writeJSON(BOARDS_KEY, []);
  writeJSON(CHECKLISTS_KEY, []);
  writeJSON(MEASUREMENTS_KEY, []);
  writeJSON(STOCK_ITEMS_KEY, []);
  writeJSON(TOMBSTONES_KEY, []);
}

export function getOnboardingSeen() {
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === "true";
}

export function setOnboardingSeen() {
  localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
}

export { uid };
