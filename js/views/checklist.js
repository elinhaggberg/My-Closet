import { getChecklist, saveChecklist, deleteChecklist, exportChecklistData, uid } from "../storage.js";
import { openSheet } from "../sheet.js";
import { shareOrDownload, filenameFor } from "../share.js";

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
  document.getElementById("checklist-menu-btn").addEventListener("click", openMenu);

  const addForm = document.getElementById("add-item-form");
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = addForm.text.value.trim();
    if (!text) return;
    list.items.push({ id: uid(), text, checked: false });
    saveChecklist(list);
    addForm.reset();
    renderItems();
  });

  renderItems();

  function renderItems() {
    const container = document.getElementById("checklist-items");
    if (list.items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No items yet. Add the first one below.";
      container.replaceChildren(empty);
      return;
    }
    container.replaceChildren(...list.items.map(renderItem));
  }

  function renderItem(item) {
    const row = document.createElement("label");
    row.className = "list-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "list-item-checkbox";
    checkbox.checked = item.checked;
    checkbox.addEventListener("change", () => {
      item.checked = checkbox.checked;
      saveChecklist(list);
      renderItems();
    });

    const text = document.createElement("span");
    text.className = "list-item-text";
    text.textContent = item.text;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-btn remove-btn";
    removeBtn.setAttribute("aria-label", "Remove item");
    removeBtn.innerHTML =
      '<svg class="icon" viewBox="0 0 384 512" aria-hidden="true" focusable="false"><path d="M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z"/></svg>';
    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      list.items = list.items.filter((i) => i.id !== item.id);
      saveChecklist(list);
      renderItems();
    });

    row.append(checkbox, text, removeBtn);
    return row;
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
