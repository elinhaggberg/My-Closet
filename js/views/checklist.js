import { getChecklist, saveChecklist, deleteChecklist, exportChecklistData } from "../storage.js";
import { openSheet } from "../sheet.js";
import { shareOrDownload, filenameFor } from "../share.js";
import { checklistMeta, toggleChecklistItemChecked } from "../util.js";

export function renderChecklist(root, nav, listId) {
  const list = getChecklist(listId);
  if (!list) {
    nav.toLists();
    return;
  }

  const tpl = document.getElementById("tpl-checklist");
  root.replaceChildren(tpl.content.cloneNode(true));
  root.querySelector(".back-btn").addEventListener("click", () => nav.toLists());
  document.getElementById("checklist-title").textContent = list.name;
  document.getElementById("checklist-edit-btn").addEventListener("click", () => nav.toListEdit(list.id));
  document.getElementById("checklist-menu-btn").addEventListener("click", openMenu);

  renderHeader();
  renderItems();

  function renderHeader() {
    document.getElementById("checklist-meta").textContent = checklistMeta(list);
  }

  function renderItems() {
    const container = document.getElementById("checklist-items");
    if (list.items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No items yet. Tap edit to add some.";
      container.replaceChildren(empty);
      return;
    }
    const rows = [];
    for (const item of list.items) {
      rows.push(createRow(item));
      for (const child of item.children || []) {
        rows.push(createRow(child, true));
      }
    }
    container.replaceChildren(...rows);
  }

  function createRow(item, isChild = false) {
    const row = document.createElement("div");
    row.className = "todo-checklist-row";
    if (isChild) row.classList.add("nested");
    row.classList.toggle("checked", item.checked);
    row.addEventListener("click", () => toggleItem(item.id));

    const checkbox = document.createElement("button");
    checkbox.type = "button";
    checkbox.className = "todo-checkbox";
    checkbox.classList.toggle("checked", item.checked);
    checkbox.setAttribute("aria-label", "Toggle checked");
    checkbox.innerHTML =
      '<svg class="icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>';

    const text = document.createElement("span");
    text.className = "todo-item-label";
    text.textContent = item.text;

    row.append(checkbox, text);
    return row;
  }

  function toggleItem(id) {
    toggleChecklistItemChecked(list, id);
    saveChecklist(list);
    renderHeader();
    renderItems();
  }

  function openMenu() {
    const sheet = openSheet("tpl-list-menu");
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    sheet.el.querySelector("#rename-list-btn").addEventListener("click", () => {
      sheet.close();
      openRename();
    });
    sheet.el.querySelector("#export-list-btn").addEventListener("click", async () => {
      const data = exportChecklistData(list);
      await shareOrDownload(filenameFor(list.name), JSON.stringify(data, null, 2));
      sheet.close();
    });
    sheet.el.querySelector("#delete-list-btn").addEventListener("click", () => {
      sheet.close();
      confirmDelete();
    });
  }

  function openRename() {
    const sheet = openSheet("tpl-board-create");
    sheet.el.querySelector("#board-create-heading").textContent = "Rename list";
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    const form = sheet.el.querySelector("#board-create-form");
    form.name.value = list.name;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) return;
      list.name = name;
      saveChecklist(list);
      document.getElementById("checklist-title").textContent = name;
      sheet.close();
    });
  }

  function confirmDelete() {
    const sheet = openSheet("tpl-confirm-delete");
    sheet.el.querySelector(".confirm-message").textContent = `Delete "${list.name}"? This can't be undone.`;
    sheet.el.querySelector(".cancel-btn").addEventListener("click", () => sheet.close());
    sheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
      deleteChecklist(list.id);
      sheet.close();
      nav.toLists();
    });
  }
}
