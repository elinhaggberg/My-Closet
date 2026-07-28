import { getStockItem, saveStockItem, deleteStockItem } from "./storage.js";
import { openSheet } from "./sheet.js";
import { openStockItemEditor } from "./stockItemEditor.js";
import { stockIconFor } from "./stockIcons.js";
import { nextRestockDate, isDue, daysUntil, unitLabel } from "./stock.js";
import { buildIcsEvent, googleCalendarLink } from "./ics.js";
import { shareOrDownloadBlob, filenameFor } from "./share.js";
import { formatDate } from "./util.js";
import { openRemindConfirmSheet } from "./remindConfirm.js";

export function openStockItemDetail(nav, itemRef, refresh) {
  const item = getStockItem(itemRef.id) || itemRef;
  const sheet = openSheet("tpl-stock-item-detail");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

  el.querySelector("#stock-detail-icon").innerHTML = stockIconFor(item.icon).svg;
  el.querySelector("#stock-detail-name").textContent = item.name || "Untitled";
  el.querySelector("#stock-detail-type").textContent = item.type || "";

  const specEl = el.querySelector("#stock-detail-spec");
  if (item.spec) {
    specEl.textContent = item.spec;
    specEl.classList.remove("hidden");
  }

  const linkEl = el.querySelector("#stock-detail-link");
  if (item.link) {
    linkEl.href = item.link;
    el.querySelector("#stock-detail-link-text").textContent = item.link;
    linkEl.classList.remove("hidden");
  }

  renderRestockBox();
  function renderRestockBox() {
    const box = el.querySelector("#stock-detail-restock-box");
    const next = nextRestockDate(item);
    const lines = [
      `<div>Replace every <strong>${item.replaceEveryValue} ${unitLabel(item.replaceEveryUnit, item.replaceEveryValue)}</strong></div>`,
      `<div>Last bought: ${item.lastBought ? formatDate(item.lastBought) : "Not set"}</div>`,
    ];
    if (next) {
      const overdue = isDue(item);
      const days = daysUntil(next);
      const soon = !overdue && days <= 7;
      const cls = overdue ? "overdue" : soon ? "soon" : "";
      const label = overdue
        ? `Due now (${formatDate(next)})`
        : soon
        ? `Due in ${days} day${days === 1 ? "" : "s"} (${formatDate(next)})`
        : formatDate(next);
      lines.push(`<div>Next restock: <span class="stock-restock-next ${cls}">${label}</span></div>`);
    } else {
      lines.push(`<div>Next restock: set a "last bought" date to calculate this</div>`);
    }
    box.innerHTML = lines.join("");
  }

  const remindToggle = el.querySelector("#stock-detail-remind-toggle");
  remindToggle.classList.toggle("active", item.remindEnabled);
  remindToggle.addEventListener("click", () => {
    item.remindEnabled = !item.remindEnabled;
    remindToggle.classList.toggle("active", item.remindEnabled);
    saveStockItem(item);
    refresh();
    if (item.remindEnabled) openRemindConfirmSheet(item);
  });

  const icsBtn = el.querySelector("#stock-detail-ics-btn");
  const gcalBtn = el.querySelector("#stock-detail-gcal-btn");
  const next = nextRestockDate(item);
  if (!next) {
    icsBtn.disabled = true;
    gcalBtn.disabled = true;
  } else {
    const eventDetails = {
      title: `Restock: ${item.name || "item"}`,
      date: next,
      description: item.spec ? `${item.type || ""} — ${item.spec}`.trim() : item.type || "",
    };
    icsBtn.addEventListener("click", async () => {
      const blob = new Blob([buildIcsEvent(eventDetails)], { type: "text/calendar" });
      await shareOrDownloadBlob(filenameFor(item.name, "ics"), blob);
    });
    gcalBtn.addEventListener("click", () => {
      window.open(googleCalendarLink(eventDetails), "_blank", "noopener");
    });
  }

  el.querySelector("#stock-detail-edit-btn").addEventListener("click", () => {
    sheet.close();
    openStockItemEditor(nav, { item, isNew: false, refresh });
  });

  el.querySelector("#stock-detail-delete-btn").addEventListener("click", () => {
    const confirmSheet = openSheet("tpl-confirm-delete");
    confirmSheet.el.querySelector(".confirm-message").textContent = `Delete "${item.name || "this item"}"? This can't be undone.`;
    confirmSheet.el.querySelector(".cancel-btn").addEventListener("click", () => confirmSheet.close());
    confirmSheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
      deleteStockItem(item.id);
      confirmSheet.close();
      sheet.close();
      refresh();
    });
  });
}
