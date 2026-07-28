import { createEmptyStockItem, saveStockItem } from "./storage.js";
import { openSheet } from "./sheet.js";
import { STOCK_ICONS } from "./stockIcons.js";
import { REPLACE_UNITS } from "./stock.js";
import { openRemindConfirmSheet } from "./remindConfirm.js";

export function openStockItemEditor(nav, { item, isNew, refresh }) {
  const draft = { ...(item || createEmptyStockItem()) };

  const sheet = openSheet("tpl-stock-item-editor");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
  el.querySelector("#stock-editor-heading").textContent = isNew ? "Add stock item" : "Edit stock item";

  // Wired up front so a problem in any of the widget setup below (icon
  // picker, unit segmented, etc.) can't take the Save button down with it —
  // same reasoning as the card editor's Save button (see save.js).
  const saveErrorEl = el.querySelector("#stock-editor-save-error");
  el.querySelector("#stock-editor-save-btn").addEventListener("click", () => {
    if (!draft.name.trim()) {
      saveErrorEl.textContent = "Give it a name so you can find it again.";
      saveErrorEl.classList.remove("hidden");
      return;
    }
    try {
      saveStockItem(draft);
    } catch {
      saveErrorEl.textContent = "Couldn't save. Please try again.";
      saveErrorEl.classList.remove("hidden");
      return;
    }
    sheet.close();
    refresh();
  });

  const iconPicker = el.querySelector("#stock-editor-icon-picker");
  iconPicker.replaceChildren(
    ...STOCK_ICONS.map((icon) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-picker-btn" + (icon.id === draft.icon ? " active" : "");
      btn.title = icon.label;
      btn.innerHTML = icon.svg;
      btn.addEventListener("click", () => {
        draft.icon = icon.id;
        iconPicker.querySelectorAll(".icon-picker-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
      return btn;
    })
  );

  const typeInput = el.querySelector("#stock-editor-type");
  typeInput.value = draft.type || "";
  typeInput.addEventListener("input", () => (draft.type = typeInput.value));

  const nameInput = el.querySelector("#stock-editor-name");
  nameInput.value = draft.name || "";
  nameInput.addEventListener("input", () => (draft.name = nameInput.value));

  const linkInput = el.querySelector("#stock-editor-link");
  linkInput.value = draft.link || "";
  linkInput.addEventListener("input", () => (draft.link = linkInput.value.trim()));

  const specInput = el.querySelector("#stock-editor-spec");
  specInput.value = draft.spec || "";
  specInput.addEventListener("input", () => (draft.spec = specInput.value));

  const replaceValueInput = el.querySelector("#stock-editor-replace-value");
  replaceValueInput.value = draft.replaceEveryValue ?? 3;
  replaceValueInput.addEventListener("input", () => {
    draft.replaceEveryValue = replaceValueInput.value === "" ? "" : Number(replaceValueInput.value);
  });

  const unitSegmented = el.querySelector("#stock-editor-replace-unit");
  unitSegmented.replaceChildren(
    ...REPLACE_UNITS.map((unit) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "segmented-option" + (unit.id === draft.replaceEveryUnit ? " active" : "");
      btn.textContent = unit.label;
      btn.addEventListener("click", () => {
        draft.replaceEveryUnit = unit.id;
        unitSegmented.querySelectorAll(".segmented-option").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
      return btn;
    })
  );

  const lastBoughtInput = el.querySelector("#stock-editor-last-bought");
  lastBoughtInput.value = draft.lastBought || "";
  lastBoughtInput.addEventListener("input", () => (draft.lastBought = lastBoughtInput.value));

  const remindToggle = el.querySelector("#stock-editor-remind-toggle");
  function renderRemindToggle() {
    remindToggle.classList.toggle("active", draft.remindEnabled);
  }
  renderRemindToggle();
  remindToggle.addEventListener("click", () => {
    draft.remindEnabled = !draft.remindEnabled;
    renderRemindToggle();
    if (draft.remindEnabled) openRemindConfirmSheet(draft);
  });
}
