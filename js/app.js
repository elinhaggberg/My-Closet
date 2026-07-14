import { renderHome } from "./views/home.js";
import { renderBoards } from "./views/boards.js";
import { renderBoard } from "./views/board.js";
import { renderMeasurements } from "./views/measurements.js";
import { renderLists } from "./views/lists.js";
import { renderChecklist } from "./views/checklist.js";
import { applyTheme } from "./theme.js";

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
    default:
      renderHome(root, nav);
  }
}

window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
