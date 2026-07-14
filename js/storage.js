const CARDS_KEY = "mc_cards_v1";
const BOARDS_KEY = "mc_boards_v1";
const MEASUREMENTS_KEY = "mc_measurements_v1";
const THEME_KEY = "mc_theme_v1";
const UNIT_KEY = "mc_unit_v1";

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

// All export shapes carry the same { cards, boards } structure (plus an
// optional top-level measurements array), so one import path handles a
// single card, a single board, or a full backup alike. Always merges (adds
// new entries) rather than replacing anything, so a bad or repeated import
// can't destroy existing data — boards merge by name (system Wishlist maps
// straight to the local Wishlist), cards and measurements are always added
// as new.
export function importData(data) {
  if (!data || !["backup", "card", "board"].includes(data.type) || !Array.isArray(data.cards)) {
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

  return { cardCount: newCards.length, boardCount: importedBoards.length, measurementCount: importedMeasurements.length };
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

export { uid };
