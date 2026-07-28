import { getStockItems, getStockSort, setStockSort, deleteStockItem } from "../storage.js";
import { stockIconFor } from "../stockIcons.js";
import { nextRestockDate, isDue, daysUntil } from "../stock.js";
import { openStockItemEditor } from "../stockItemEditor.js";
import { openStockItemDetail } from "../stockItemDetail.js";
import { openSheet } from "../sheet.js";

export function renderStockItems(root, nav) {
  const tpl = document.getElementById("tpl-stock-items");
  root.replaceChildren(tpl.content.cloneNode(true));
  root.querySelector(".back-btn").addEventListener("click", () => nav.toHome());

  document.getElementById("stock-add-btn").addEventListener("click", () => {
    openStockItemEditor(nav, { isNew: true, refresh: renderList });
  });

  const sortSegmented = document.getElementById("stock-sort-segmented");
  function renderSortActive() {
    const mode = getStockSort();
    sortSegmented.querySelectorAll(".segmented-option").forEach((b) => b.classList.toggle("active", b.dataset.sort === mode));
  }
  sortSegmented.querySelectorAll(".segmented-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      setStockSort(btn.dataset.sort);
      renderSortActive();
      renderList();
    });
  });
  renderSortActive();

  renderList();

  function sortedItems() {
    const items = getStockItems();
    const mode = getStockSort();
    if (mode === "name") {
      return items.sort((a, b) => a.name.localeCompare(b.name));
    }
    // "restock due" — items with a known next-restock date soonest first;
    // items with no last-bought date yet (so nothing to calculate) sort
    // last, since there's nothing actionable about them yet.
    return items.sort((a, b) => {
      const na = nextRestockDate(a);
      const nb = nextRestockDate(b);
      if (na && nb) return na.localeCompare(nb);
      if (na) return -1;
      if (nb) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  function renderList() {
    const list = document.getElementById("stock-list");
    const items = sortedItems();
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No stock items yet. Add the everyday things you buy on repeat.";
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...items.map(renderRow));
  }

  function renderRow(item) {
    const rowTpl = document.getElementById("tpl-stock-row");
    const node = rowTpl.content.cloneNode(true);
    const row = node.querySelector(".stock-row");

    node.querySelector(".stock-row-icon").innerHTML = stockIconFor(item.icon).svg;
    node.querySelector(".stock-row-name").textContent = item.name || "Untitled";
    node.querySelector(".stock-row-meta").textContent = item.type || "";

    const dueEl = node.querySelector(".stock-row-due");
    const next = nextRestockDate(item);
    if (next) {
      const overdue = isDue(item);
      const days = daysUntil(next);
      const soon = !overdue && days <= 7;
      dueEl.textContent = overdue ? "Due now" : soon ? `${days}d` : "OK";
      dueEl.classList.remove("hidden");
      dueEl.classList.add(overdue ? "overdue" : soon ? "soon" : "ok");
    }

    row.addEventListener("click", () => openStockItemDetail(nav, item, renderList));
    node.querySelector(".stock-row-edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openStockItemEditor(nav, { item, isNew: false, refresh: renderList });
    });
    node.querySelector(".stock-row-delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const confirmSheet = openSheet("tpl-confirm-delete");
      confirmSheet.el.querySelector(".confirm-message").textContent = `Delete "${item.name || "this item"}"? This can't be undone.`;
      confirmSheet.el.querySelector(".cancel-btn").addEventListener("click", () => confirmSheet.close());
      confirmSheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
        deleteStockItem(item.id);
        confirmSheet.close();
        renderList();
      });
    });

    return node;
  }
}
