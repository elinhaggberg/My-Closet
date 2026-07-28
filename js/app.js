import { renderHome } from "./views/home.js";
import { renderBoards } from "./views/boards.js";
import { renderBoard } from "./views/board.js";
import { renderMeasurements } from "./views/measurements.js";
import { renderLists } from "./views/lists.js";
import { renderChecklist } from "./views/checklist.js";
import { renderStockItems } from "./views/stockItems.js";
import { applyTheme } from "./theme.js";
import { createEmptyCard, migrateImagesToIndexedDB } from "./storage.js";
import { openCardEditor } from "./save.js";
import { checkWhatsNew } from "./whatsNew.js";
import { checkOnboarding } from "./onboarding.js";
import { checkMigrationNotice } from "./migrationNotice.js";

applyTheme();

const root = document.getElementById("app");

const nav = {
  toHome: () => {
    location.hash = "#/home";
  },
  toBoards: () => {
    location.hash = "#/boards";
  },
  toBoard: (id) => {
    location.hash = `#/board/${encodeURIComponent(id)}`;
  },
  toMeasurements: () => {
    location.hash = "#/measurements";
  },
  toLists: () => {
    location.hash = "#/lists";
  },
  toList: (id) => {
    location.hash = `#/list/${encodeURIComponent(id)}`;
  },
  toStock: () => {
    location.hash = "#/stock";
  },
};

function route() {
  const hash = location.hash || "#/home";
  const match = hash.match(/^#\/([a-z]+)(?:\/(.+))?$/);
  const view = match ? match[1] : "home";
  const param = match && match[2] ? decodeURIComponent(match[2]) : null;

  switch (view) {
    case "boards":
      renderBoards(root, nav);
      break;
    case "board":
      if (!param) {
        nav.toBoards();
        return;
      }
      renderBoard(root, nav, param);
      break;
    case "measurements":
      renderMeasurements(root, nav);
      break;
    case "lists":
      renderLists(root, nav);
      break;
    case "list":
      if (!param) {
        nav.toLists();
        return;
      }
      renderChecklist(root, nav, param);
      break;
    case "stock":
      renderStockItems(root, nav);
      break;
    default:
      renderHome(root, nav);
  }
}

// Handles a link shared into the app from the OS Share Sheet — the
// Android share_target manifest entry and the iOS Shortcut workaround
// (there's no Web Share Target support in Safari) both land here the same
// way: a URL in the ?url= or ?text= query param on a plain page load, no
// hash. Opens straight into the save flow with a fetch already kicked off,
// instead of dropping you on Home with nothing.
function handleIncomingShare() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("url") || params.get("text") || "";
  const match = raw.match(/https?:\/\/\S+/);
  if (!match) return;

  history.replaceState(null, "", location.pathname + location.hash);

  const card = createEmptyCard();
  card.kind = "link";
  card.url = match[0];
  openCardEditor(nav, { card, isNew: true, refresh: route, autoFetch: true });
}

window.addEventListener("hashchange", route);

// Anyone who saved photos before IndexedDB storage existed has them sitting
// in localStorage as huge inline images — move those out before the first
// render so the app isn't showing (and re-writing) oversized data any
// longer than it has to. checkMigrationNotice reads the current (pre-
// migration) data to decide whether to say anything, so it must run first;
// the migration itself is a no-op after the first run either way, and
// doesn't wait on the notice being read — it's just explaining what's
// already happening in the background.
const migrationNotice = checkMigrationNotice();
migrateImagesToIndexedDB().finally(() => {
  route();
  handleIncomingShare();
});

// Held until the migration notice (if any) has actually been dismissed, so
// a second one-time sheet can't stack on top of it before it's been read.
migrationNotice.then(() => {
  checkOnboarding();
  checkWhatsNew();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
