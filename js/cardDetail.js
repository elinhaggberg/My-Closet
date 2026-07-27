import { getCard, saveCard, deleteCard, exportCardData, WISHLIST_BOARD_ID, makeWishlistFields } from "./storage.js";
import { openSheet } from "./sheet.js";
import { shareOrDownload, filenameFor } from "./share.js";
import { formatPrice, hostnameFor } from "./util.js";
import { renderSizeBox } from "./sizeBox.js";
import { renderBoardChips } from "./boardChips.js";
import { openCardEditor } from "./save.js";
import { resolveImageSrc } from "./imageStore.js";

export function openCardDetail(nav, cardRef, refresh) {
  const card = getCard(cardRef.id) || cardRef;
  const sheet = openSheet("tpl-card-detail");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

  const img = el.querySelector("#detail-image");
  if (card.image) {
    img.alt = card.title || "";
    resolveImageSrc(card.image).then((src) => {
      if (src) {
        img.src = src;
        img.classList.remove("hidden");
      }
    });
  }

  el.querySelector("#detail-title").textContent = card.title || "Untitled";

  const priceEl = el.querySelector("#detail-price");
  if (card.price) {
    priceEl.textContent = formatPrice(card.price, card.currency);
    priceEl.classList.remove("hidden");
  }

  const linkEl = el.querySelector("#detail-link");
  if (card.url) {
    linkEl.href = card.url;
    el.querySelector("#detail-link-text").textContent = card.siteName || hostnameFor(card.url);
    linkEl.classList.remove("hidden");
  }

  const noteEl = el.querySelector("#detail-note");
  if (card.note) {
    noteEl.textContent = card.note;
    noteEl.classList.remove("hidden");
  }

  const wishlistToggle = el.querySelector("#detail-wishlist-toggle");
  const wishlistToggleLabel = wishlistToggle.querySelector(".wishlist-toggle-label");
  wishlistToggle.classList.toggle("active", !!card.wishlist);
  wishlistToggleLabel.textContent = card.wishlist ? "In your wishlist" : "Add to wishlist";
  wishlistToggle.addEventListener("click", async () => {
    if (card.wishlist) {
      card.wishlist = null;
      card.boardIds = card.boardIds.filter((id) => id !== WISHLIST_BOARD_ID);
    } else {
      card.wishlist = makeWishlistFields();
      if (!card.boardIds.includes(WISHLIST_BOARD_ID)) card.boardIds.push(WISHLIST_BOARD_ID);
    }
    await saveCard(card);
    refresh();
    sheet.close();
    openCardDetail(nav, card, refresh);
  });

  if (card.wishlist) {
    renderSizeBox(el.querySelector("#detail-size-box"), card.wishlist.category, card.wishlist.garment);
  }

  renderBoardChips(el.querySelector("#detail-board-chips"), {
    selectedIds: card.boardIds,
    onToggle: async (boardId) => {
      const idx = card.boardIds.indexOf(boardId);
      if (idx >= 0) card.boardIds.splice(idx, 1);
      else card.boardIds.push(boardId);
      await saveCard(card);
      refresh();
    },
  });

  el.querySelector("#detail-edit-btn").addEventListener("click", () => {
    sheet.close();
    openCardEditor(nav, { card, isNew: false, refresh });
  });

  el.querySelector("#detail-share-btn").addEventListener("click", async () => {
    const data = await exportCardData(card);
    await shareOrDownload(filenameFor(card.title), JSON.stringify(data, null, 2));
  });

  el.querySelector("#detail-delete-btn").addEventListener("click", () => {
    const confirmSheet = openSheet("tpl-confirm-delete");
    confirmSheet.el.querySelector(".confirm-message").textContent = `Delete "${card.title || "this item"}"? This can't be undone.`;
    confirmSheet.el.querySelector(".cancel-btn").addEventListener("click", () => confirmSheet.close());
    confirmSheet.el.querySelector(".confirm-btn").addEventListener("click", async () => {
      await deleteCard(card.id);
      confirmSheet.close();
      sheet.close();
      refresh();
    });
  });
}
