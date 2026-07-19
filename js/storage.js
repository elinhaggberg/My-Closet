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
const FIRST_OPEN_KEY = "mc_first_open_at_v1";

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
  const board = { id: uid(), name: name.trim(), isSystem: false, createdAt: Date.now() };
  boards.push(board);
  writeJSON(BOARDS_KEY, boards);
  return board;
}

export function renameBoard(id, name) {
  const boards = getBoards();
  const idx = boards.findIndex((b) => b.id === id);
  if (idx < 0 || boards[idx].isSystem) return null;
  boards[idx] = { ...boards[idx], name: name.trim() };
  writeJSON(BOARDS_KEY, boards);
  return boards[idx];
}

export function deleteBoard(id) {
  const board = getBoard(id);
  if (!board || board.isSystem) return;
  writeJSON(BOARDS_KEY, getBoards().filter((b) => b.id !== id));
  const cards = getCards();
  for (const card of cards) {
    if (card.boardIds.includes(id)) {
      saveCard({ ...card, boardIds: card.boardIds.filter((b) => b !== id) });
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

export function saveCard(card) {
  const cards = getCards();
  const idx = cards.findIndex((c) => c.id === card.id);
  const withTimestamp = { ...card, updatedAt: Date.now() };
  if (idx >= 0) cards[idx] = withTimestamp;
  else cards.push(withTimestamp);
  writeJSON(CARDS_KEY, cards);
  return withTimestamp;
}

export function deleteCard(id) {
  writeJSON(CARDS_KEY, getCards().filter((c) => c.id !== id));
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
  const idx = all.findIndex((m) => m.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  writeJSON(MEASUREMENTS_KEY, all);
  return entry;
}

export function deleteMeasurement(id) {
  writeJSON(MEASUREMENTS_KEY, readJSON(MEASUREMENTS_KEY, []).filter((m) => m.id !== id));
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
}

export function getMeasurementNotes() {
  return localStorage.getItem(MEASUREMENT_NOTES_KEY) || "";
}

export function setMeasurementNotes(text) {
  localStorage.setItem(MEASUREMENT_NOTES_KEY, text);
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
  const list = { id: uid(), name: name.trim(), createdAt: Date.now(), items: [] };
  lists.push(list);
  writeJSON(CHECKLISTS_KEY, lists);
  return list;
}

export function saveChecklist(list) {
  const lists = getChecklists();
  const idx = lists.findIndex((l) => l.id === list.id);
  if (idx >= 0) lists[idx] = list;
  else lists.push(list);
  writeJSON(CHECKLISTS_KEY, lists);
  return list;
}

export function deleteChecklist(id) {
  writeJSON(CHECKLISTS_KEY, getChecklists().filter((l) => l.id !== id));
}

export function exportChecklistData(list) {
  return {
    type: "checklist",
    version: 1,
    exportedAt: new Date().toISOString(),
    checklists: [list],
  };
}

// ---- Export / import ----

function referencedBoards(cards) {
  const ids = new Set();
  for (const card of cards) for (const id of card.boardIds) ids.add(id);
  return getBoards().filter((b) => ids.has(b.id));
}

export function exportBackupData() {
  return {
    type: "backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: getCards(),
    boards: getBoards().filter((b) => !b.isSystem),
    measurements: getMeasurements(),
    sizePrefs: getSizePrefs(),
    measurementNotes: getMeasurementNotes(),
    checklists: getChecklists(),
    theme: getThemePref(),
    unit: getUnit(),
    homeTitle: getHomeTitle(),
  };
}

export function exportCardData(card) {
  return {
    type: "card",
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: [card],
    boards: referencedBoards([card]).filter((b) => !b.isSystem),
  };
}

export function exportBoardData(board) {
  const cards = getCardsForBoard(board.id);
  return {
    type: "board",
    version: 1,
    exportedAt: new Date().toISOString(),
    cards,
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
export function importData(data) {
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

  const newCards = data.cards.map((c) => ({
    ...c,
    id: uid(),
    createdAt: Date.now(),
    boardIds: (c.boardIds || []).map((id) => oldIdToLocalId.get(id)).filter(Boolean),
  }));
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
    preferencesApplied,
  };
}

// ---- Preferences ----

export function getThemePref() {
  return readJSON(THEME_KEY, {});
}

export function setThemePref(pref) {
  writeJSON(THEME_KEY, pref);
}

export function getUnit() {
  return localStorage.getItem(UNIT_KEY) || "cm";
}

export function setUnit(unit) {
  localStorage.setItem(UNIT_KEY, unit);
}

export function getHomeTitle() {
  return localStorage.getItem(HOME_TITLE_KEY) || "My Closet";
}

export function setHomeTitle(value) {
  const trimmed = (value || "").trim();
  if (trimmed) localStorage.setItem(HOME_TITLE_KEY, trimmed);
  else localStorage.removeItem(HOME_TITLE_KEY);
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

export { uid };
