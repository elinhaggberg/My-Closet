import { getChecklists, createChecklist } from "../storage.js";
import { renderTabbar } from "../tabbar.js";
import { openSheet } from "../sheet.js";

export function renderLists(root, nav) {
  const tpl = document.getElementById("tpl-lists");
  root.replaceChildren(tpl.content.cloneNode(true));
  renderTabbar(root, nav, "lists");

  document.getElementById("add-list-btn").addEventListener("click", openCreate);

  renderGrid();

  function renderGrid() {
    const grid = document.getElementById("lists-grid");
    const lists = getChecklists().sort((a, b) => b.createdAt - a.createdAt);
    if (lists.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No lists yet. Start one for things you're looking to buy.";
      grid.replaceChildren(empty);
      return;
    }
    grid.replaceChildren(...lists.map(renderTile));
  }

  function renderTile(list) {
    const tileTpl = document.getElementById("tpl-list-tile");
    const node = tileTpl.content.cloneNode(true);
    const btn = node.querySelector(".list-tile");
    node.querySelector(".board-tile-title").textContent = list.name;
    const done = list.items.filter((i) => i.checked).length;
    const total = list.items.length;
    node.querySelector(".board-tile-meta").textContent = total === 0 ? "Empty" : `${done}/${total} done`;
    btn.addEventListener("click", () => nav.toList(list.id));
    return node;
  }

  function openCreate() {
    const sheet = openSheet("tpl-board-create");
    sheet.el.querySelector("#board-create-heading").textContent = "New list";
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    const form = sheet.el.querySelector("#board-create-form");
    form.querySelector('input[name="name"]').placeholder = "e.g. Things to look for";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) return;
      const list = createChecklist(name);
      sheet.close();
      nav.toList(list.id);
    });
  }
}
