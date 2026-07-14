import { getBoards, createBoard } from "./storage.js";
import { openSheet } from "./sheet.js";

// Shared by the save/edit sheet and the card-detail sheet, so a card's board
// membership can be edited the same way from either place. Only ordinary
// (non-system) boards are listed here — the built-in Wishlist board has its
// own dedicated toggle wherever this is used, to avoid two controls for the
// same thing.
export function renderBoardChips(container, { selectedIds, onToggle }) {
  function draw() {
    const boards = getBoards()
      .filter((b) => !b.isSystem)
      .sort((a, b) => a.name.localeCompare(b.name));
    const chips = boards.map((board) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "board-chip" + (selectedIds.includes(board.id) ? " active" : "");
      chip.textContent = board.name;
      chip.addEventListener("click", () => {
        onToggle(board.id);
        draw();
      });
      return chip;
    });

    const newChip = document.createElement("button");
    newChip.type = "button";
    newChip.className = "board-chip new-chip";
    newChip.textContent = "+ New board";
    newChip.addEventListener("click", openCreate);

    container.replaceChildren(...chips, newChip);
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
      onToggle(board.id);
      sheet.close();
      draw();
    });
  }

  draw();
}
