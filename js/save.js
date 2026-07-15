import { createEmptyCard, saveCard, getUnit, WISHLIST_BOARD_ID, makeWishlistFields } from "./storage.js";
import { openSheet } from "./sheet.js";
import { renderBoardChips } from "./boardChips.js";
import { renderSizeBox } from "./sizeBox.js";
import { readAndResizeImage } from "./photo.js";
import { CATEGORIES, categoryFor, dimLabel } from "./sizing.js";
import { hostnameFor } from "./util.js";

export function openSaveChoice(nav, refresh, presetBoardId) {
  const sheet = openSheet("tpl-save-choice");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

  el.querySelector("#choice-link").addEventListener("click", () => {
    sheet.close();
    const card = createEmptyCard();
    card.kind = "link";
    openCardEditor(nav, { card, isNew: true, refresh, presetBoardId });
  });

  el.querySelector("#choice-photo").addEventListener("click", () => {
    sheet.close();
    const card = createEmptyCard();
    card.kind = "photo";
    card.image = "";
    openCardEditor(nav, { card, isNew: true, refresh, presetBoardId });
  });
}

export function openCardEditor(nav, { card, isNew, refresh, presetBoardId, autoFetch }) {
  const draft = { ...card, boardIds: [...card.boardIds] };
  let wishlistActive = !!draft.wishlist || draft.boardIds.includes(WISHLIST_BOARD_ID);
  let priceActive = !!draft.price;
  const wishlistDraft = draft.wishlist
    ? { category: draft.wishlist.category, garment: { ...draft.wishlist.garment } }
    : makeWishlistFields();

  if (presetBoardId && presetBoardId !== WISHLIST_BOARD_ID && !draft.boardIds.includes(presetBoardId)) {
    draft.boardIds.push(presetBoardId);
  }
  if (presetBoardId === WISHLIST_BOARD_ID) wishlistActive = true;

  const sheet = openSheet("tpl-card-editor");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
  el.querySelector("#editor-heading").textContent = isNew ? "Save" : "Edit";

  const titleInput = el.querySelector("#editor-title");
  const priceInput = el.querySelector("#editor-price");
  const currencyInput = el.querySelector("#editor-currency");
  const priceToggle = el.querySelector("#editor-price-toggle");
  const priceBlock = el.querySelector("#editor-price-block");
  function renderPriceToggle() {
    priceToggle.classList.toggle("active", priceActive);
    priceBlock.classList.toggle("hidden", !priceActive);
  }

  // One shared image picker regardless of how the card was started — a
  // fetched link and a manual photo both just set draft.image, so a card
  // can get its picture from either source (or have it swapped after the
  // fact), rather than being locked into whichever you picked first.
  const dropEl = el.querySelector("#photo-drop");
  const previewWrap = el.querySelector("#photo-preview-wrap");
  const previewImg = el.querySelector("#photo-preview-img");
  const cameraInput = el.querySelector("#camera-input");
  const libraryInput = el.querySelector("#library-input");

  function renderImagePreview() {
    if (draft.image) {
      previewImg.src = draft.image;
      dropEl.classList.add("hidden");
      previewWrap.classList.remove("hidden");
    } else {
      previewWrap.classList.add("hidden");
      dropEl.classList.remove("hidden");
    }
  }
  renderImagePreview();

  el.querySelector("#photo-camera-btn").addEventListener("click", () => cameraInput.click());
  el.querySelector("#photo-library-btn").addEventListener("click", () => libraryInput.click());

  async function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    try {
      draft.image = await readAndResizeImage(file);
      renderImagePreview();
    } catch {
      // Unreadable file — leave the drop control as-is so they can retry.
    }
  }
  cameraInput.addEventListener("change", () => handleFile(cameraInput));
  libraryInput.addEventListener("change", () => handleFile(libraryInput));

  el.querySelector("#photo-clear-btn").addEventListener("click", () => {
    draft.image = "";
    renderImagePreview();
  });

  const urlInput = el.querySelector("#editor-url-input");
  urlInput.value = draft.url || "";
  urlInput.addEventListener("input", () => {
    draft.url = urlInput.value.trim();
  });

  const fetchBtn = el.querySelector("#editor-fetch-btn");
  const msgEl = el.querySelector("#editor-fetch-message");
  async function runFetch() {
    const url = urlInput.value.trim();
    if (!url) return;
    msgEl.classList.remove("error", "hidden");
    msgEl.textContent = "Fetching…";
    fetchBtn.disabled = true;
    try {
      const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      draft.url = url;
      if (data.title) draft.title = data.title;
      if (data.image) draft.image = data.image;
      if (data.price) draft.price = data.price;
      if (data.currency) draft.currency = data.currency;
      draft.siteName = data.siteName || hostnameFor(url);
      titleInput.value = draft.title || "";
      priceInput.value = draft.price || "";
      currencyInput.value = draft.currency || "";
      if (data.price) {
        priceActive = true;
        renderPriceToggle();
      }
      renderImagePreview();
      if (data.error) {
        msgEl.textContent = `${data.error} You can still fill in the details yourself, or add your own photo below.`;
        msgEl.classList.add("error");
      } else if (data.notice) {
        msgEl.textContent = `${data.notice} You can add your own photo below instead.`;
      } else {
        msgEl.textContent = "Got it — details filled in below.";
      }
    } catch {
      msgEl.textContent = "Couldn't fetch that link. You can still fill in the details yourself.";
      msgEl.classList.add("error");
    } finally {
      fetchBtn.disabled = false;
    }
  }
  fetchBtn.addEventListener("click", runFetch);
  // Lets an incoming share (from the iOS Shortcut / Android share_target
  // flow — see app.js) skip straight to "fetching" instead of making you
  // tap Fetch yourself right after sharing a link into the app.
  if (autoFetch && draft.url) runFetch();

  titleInput.value = draft.title || "";
  titleInput.addEventListener("input", () => {
    draft.title = titleInput.value;
  });
  priceInput.value = draft.price || "";
  priceInput.addEventListener("input", () => {
    draft.price = priceInput.value;
  });
  currencyInput.value = draft.currency || "";
  currencyInput.addEventListener("input", () => {
    draft.currency = currencyInput.value;
  });
  renderPriceToggle();
  priceToggle.addEventListener("click", () => {
    priceActive = !priceActive;
    renderPriceToggle();
  });

  const noteInput = el.querySelector("#editor-note");
  noteInput.value = draft.note || "";
  noteInput.addEventListener("input", () => {
    draft.note = noteInput.value;
  });

  renderBoardChips(el.querySelector("#editor-board-chips"), {
    selectedIds: draft.boardIds,
    onToggle: (boardId) => {
      const idx = draft.boardIds.indexOf(boardId);
      if (idx >= 0) draft.boardIds.splice(idx, 1);
      else draft.boardIds.push(boardId);
    },
  });

  const wishlistToggle = el.querySelector("#editor-wishlist-toggle");
  const wishlistBlock = el.querySelector("#editor-wishlist-block");
  const categorySegmented = el.querySelector("#editor-category-segmented");
  const garmentFieldsEl = el.querySelector("#editor-garment-fields");
  const sizePreviewEl = document.createElement("div");
  wishlistBlock.appendChild(sizePreviewEl);

  const wishlistToggleLabel = wishlistToggle.querySelector(".wishlist-toggle-label");
  function renderWishlistToggle() {
    wishlistToggle.classList.toggle("active", wishlistActive);
    wishlistToggleLabel.textContent = wishlistActive ? "In your wishlist" : "Add to wishlist";
  }
  renderWishlistToggle();
  wishlistBlock.classList.toggle("hidden", !wishlistActive);
  wishlistToggle.addEventListener("click", () => {
    wishlistActive = !wishlistActive;
    renderWishlistToggle();
    wishlistBlock.classList.toggle("hidden", !wishlistActive);
  });

  categorySegmented.replaceChildren(
    ...CATEGORIES.map((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "segmented-option" + (wishlistDraft.category === cat.id ? " active" : "");
      btn.textContent = cat.label;
      btn.addEventListener("click", () => {
        wishlistDraft.category = cat.id;
        categorySegmented.querySelectorAll(".segmented-option").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderGarmentFields();
      });
      return btn;
    })
  );

  function renderGarmentFields() {
    const category = categoryFor(wishlistDraft.category);
    const unit = getUnit();
    garmentFieldsEl.replaceChildren(
      ...category.dims.map((key) => {
        const label = document.createElement("label");
        label.className = "field";
        const span = document.createElement("span");
        span.textContent = `${dimLabel(key)} (${unit})`;
        const input = document.createElement("input");
        input.type = "number";
        input.step = "0.1";
        input.min = "0";
        input.value = wishlistDraft.garment[key] ?? "";
        input.addEventListener("input", () => {
          wishlistDraft.garment[key] = input.value === "" ? undefined : Number(input.value);
          updateSizePreview();
        });
        label.append(span, input);
        return label;
      })
    );
    updateSizePreview();
  }
  function updateSizePreview() {
    renderSizeBox(sizePreviewEl, wishlistDraft.category, wishlistDraft.garment);
  }
  renderGarmentFields();

  el.querySelector("#editor-save-btn").addEventListener("click", () => {
    const finalCard = {
      ...draft,
      title: draft.title?.trim() || (draft.url ? hostnameFor(draft.url) : "Untitled"),
      price: priceActive ? draft.price : "",
      currency: priceActive ? draft.currency : "",
      wishlist: wishlistActive ? { category: wishlistDraft.category, garment: wishlistDraft.garment } : null,
      boardIds: wishlistActive
        ? [...new Set([...draft.boardIds, WISHLIST_BOARD_ID])]
        : draft.boardIds.filter((id) => id !== WISHLIST_BOARD_ID),
    };
    saveCard(finalCard);
    sheet.close();
    refresh();
  });
}
