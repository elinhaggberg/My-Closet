import { getBoards, getCardsForBoard, createBoard } from "../storage.js";
import { renderTabbar } from "../tabbar.js";
import { openSheet } from "../sheet.js";

export function renderBoards(root, nav) {
  const tpl = document.getElementById("tpl-boards");
  root.replaceChildren(tpl.content.cloneNode(true));
  renderTabbar(root, nav, "boards");

  document.getElementById("add-board-btn").addEventListener("click", openCreate);

  renderList();

  function renderList() {
    const grid = document.getElementById("boards-grid");
    const boards = getBoards()
      .filter((b) => !b.isSystem)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (boards.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No boards yet. Create one to start a moodboard.";
      grid.replaceChildren(empty);
      return;
    }
    grid.replaceChildren(...boards.map(renderTile));
  }

  function renderTile(board) {
    const tileTpl = document.getElementById("tpl-board-tile");
    const node = tileTpl.content.cloneNode(true);
    const btn = node.querySelector(".board-tile");
    const cover = node.querySelector(".board-cover");
    const cards = getCardsForBoard(board.id);
    const images = cards.filter((c) => c.image).slice(0, 4);

    if (images.length > 0) {
      cover.replaceChildren(
        ...images.map((c) => {
          const img = document.createElement("img");
          img.src = c.image;
          img.alt = "";
          return img;
        })
      );
    } else {
      cover.className = "board-cover-empty";
      cover.innerHTML =
        '<svg class="icon icon-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M4 17l5-6 4 4 3-3 5 6"/></svg>';
    }

    node.querySelector(".board-tile-title").textContent = board.name;
    const count = cards.length;
    node.querySelector(".board-tile-meta").textContent = `${count} item${count !== 1 ? "s" : ""}`;
    btn.addEventListener("click", () => nav.toBoard(board.id));
    return node;
  }

  function openCreate() {
    const sheet = openSheet("tpl-board-create");
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    const form = sheet.el.querySelector("#board-create-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) return;
      const board = createBoard(name);
      sheet.close();
      nav.toBoard(board.id);
    });
  }
}
