import { getBoard, getCardsForBoard, deleteBoard, renameBoard, exportBoardData, WISHLIST_BOARD_ID } from "../storage.js";
import { renderTabbar } from "../tabbar.js";
import { createPinNode } from "../pin.js";
import { renderMasonry } from "../masonry.js";
import { openSaveChoice } from "../save.js";
import { openCardDetail } from "../cardDetail.js";
import { openSheet } from "../sheet.js";
import { shareOrDownload, shareOrDownloadBlob, filenameFor } from "../share.js";
import { buildCollageBlob } from "../collage.js";

export function renderBoard(root, nav, boardId) {
  const board = getBoard(boardId);
  if (!board) {
    nav.toBoards();
    return;
  }

  const isWishlist = board.id === WISHLIST_BOARD_ID;
  const tpl = document.getElementById("tpl-board");
  root.replaceChildren(tpl.content.cloneNode(true));
  renderTabbar(root, nav, "boards");

  document.getElementById("board-title").textContent = board.name;
  root.querySelector(".back-btn").addEventListener("click", () => nav.toBoards());

  const menuBtn = document.getElementById("board-menu-btn");
  menuBtn.classList.remove("hidden");
  menuBtn.addEventListener("click", openBoardMenu);

  document.getElementById("add-to-board-btn").addEventListener("click", () => openSaveChoice(nav, renderList, board.id));

  renderList();

  function renderList() {
    const grid = document.getElementById("board-grid");
    const cards = getCardsForBoard(board.id);
    if (cards.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = isWishlist ? "Nothing in your wishlist yet." : "Nothing saved to this board yet.";
      grid.replaceChildren(empty);
      return;
    }
    renderMasonry(grid, cards, (card) => createPinNode(card, (c) => openCardDetail(nav, c, renderList)));
  }

  function openBoardMenu() {
    const sheet = openSheet("tpl-board-menu");
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

    const renameBtn = sheet.el.querySelector("#rename-board-btn");
    const deleteBtn = sheet.el.querySelector("#delete-board-btn");
    if (isWishlist) {
      renameBtn.classList.add("hidden");
      deleteBtn.classList.add("hidden");
    } else {
      renameBtn.addEventListener("click", () => {
        sheet.close();
        openRename();
      });
      deleteBtn.addEventListener("click", () => {
        sheet.close();
        confirmDeleteBoard();
      });
    }

    sheet.el.querySelector("#export-board-btn").addEventListener("click", async () => {
      const data = exportBoardData(board);
      await shareOrDownload(filenameFor(board.name), JSON.stringify(data, null, 2));
      sheet.close();
    });

    const imageBtn = sheet.el.querySelector("#export-image-btn");
    const imageBtnLabel = imageBtn.querySelector("span");
    imageBtn.addEventListener("click", async () => {
      imageBtn.disabled = true;
      imageBtnLabel.textContent = "Generating…";
      try {
        const blob = await buildCollageBlob(getCardsForBoard(board.id));
        await shareOrDownloadBlob(filenameFor(board.name, "png"), blob);
        sheet.close();
      } catch (err) {
        imageBtnLabel.textContent = err.message || "Couldn't create the collage.";
        imageBtn.disabled = false;
      }
    });
  }

  function openRename() {
    const sheet = openSheet("tpl-board-create");
    sheet.el.querySelector("#board-create-heading").textContent = "Rename board";
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    const form = sheet.el.querySelector("#board-create-form");
    form.name.value = board.name;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) return;
      renameBoard(board.id, name);
      document.getElementById("board-title").textContent = name;
      sheet.close();
    });
  }

  function confirmDeleteBoard() {
    const sheet = openSheet("tpl-confirm-delete");
    sheet.el.querySelector(".confirm-message").textContent = `Delete "${board.name}"? Saved items stay on your device but leave this board. This can't be undone.`;
    sheet.el.querySelector(".cancel-btn").addEventListener("click", () => sheet.close());
    sheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
      deleteBoard(board.id);
      sheet.close();
      nav.toBoards();
    });
  }
}
