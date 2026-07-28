import { openSheet } from "./sheet.js";
import { nextRestockDate } from "./stock.js";
import { buildIcsEvent, googleCalendarLink } from "./ics.js";
import { shareOrDownloadBlob, filenameFor } from "./share.js";

// Shown the moment "Remind me" gets switched on (editor or detail — see
// stockItemEditor.js / stockItemDetail.js), since a silent toggle flip
// isn't enough explanation for what it actually does. Takes a plain
// {name, type, spec, replaceEveryValue, replaceEveryUnit, lastBought}
// shape rather than a persisted item, so it also works from the editor's
// in-progress draft before anything's been saved.
export function openRemindConfirmSheet(itemLike) {
  const sheet = openSheet("tpl-remind-confirm");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
  el.querySelector("#remind-confirm-got-it-btn").addEventListener("click", () => sheet.close());

  const next = nextRestockDate(itemLike);
  const calendarActions = el.querySelector("#remind-confirm-calendar-actions");
  const noDateNote = el.querySelector("#remind-confirm-no-date-note");
  if (!next) {
    calendarActions.classList.add("hidden");
    noDateNote.classList.remove("hidden");
    return;
  }

  const eventDetails = {
    title: `Restock: ${itemLike.name || "item"}`,
    date: next,
    description: itemLike.spec ? `${itemLike.type || ""} — ${itemLike.spec}`.trim() : itemLike.type || "",
  };
  el.querySelector("#remind-confirm-ics-btn").addEventListener("click", async () => {
    const blob = new Blob([buildIcsEvent(eventDetails)], { type: "text/calendar" });
    await shareOrDownloadBlob(filenameFor(itemLike.name, "ics"), blob);
  });
  el.querySelector("#remind-confirm-gcal-btn").addEventListener("click", () => {
    window.open(googleCalendarLink(eventDetails), "_blank", "noopener");
  });
}
