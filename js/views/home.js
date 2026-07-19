import { getCards, getHomeTitle, exportBackupData, getBackupNoticeSeen, setBackupNoticeSeen } from "../storage.js";
import { createPinNode } from "../pin.js";
import { renderTabbar } from "../tabbar.js";
import { renderMasonry } from "../masonry.js";
import { openSaveChoice } from "../save.js";
import { openCardDetail } from "../cardDetail.js";
import { openSettingsMenu } from "../settingsMenu.js";
import { openSheet } from "../sheet.js";
import { shareOrDownload } from "../share.js";

export function renderHome(root, nav) {
  const tpl = document.getElementById("tpl-home");
  root.replaceChildren(tpl.content.cloneNode(true));
  renderTabbar(root, nav, "home");

  document.getElementById("home-title").textContent = getHomeTitle();
  document.getElementById("add-btn").addEventListener("click", () => openSaveChoice(nav, renderList));
  document.getElementById("settings-btn").addEventListener("click", () => openSettingsMenu(nav, renderList));

  renderList();
  maybeShowBackupImprovedNotice();

  // One-time notice after the backup fix that added theme/unit/home title to
  // the export -- a fresh install has nothing worth re-backing up, so it's
  // marked seen silently instead of greeting a new user with it.
  function maybeShowBackupImprovedNotice() {
    if (getBackupNoticeSeen()) return;
    setBackupNoticeSeen();
    if (getCards().length === 0) return;

    const sheet = openSheet("tpl-backup-improved");
    sheet.el.querySelector(".backup-improved-later-btn").addEventListener("click", () => sheet.close());
    sheet.el.querySelector(".backup-improved-export-btn").addEventListener("click", async () => {
      const data = exportBackupData();
      const stamp = new Date().toISOString().slice(0, 10);
      await shareOrDownload(`my-closet-backup-${stamp}.json`, JSON.stringify(data, null, 2));
      sheet.close();
    });
  }

  function renderList() {
    const grid = document.getElementById("home-grid");
    const cards = getCards().sort((a, b) => b.createdAt - a.createdAt);
    if (cards.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Nothing saved yet. Tap + to save your first link or photo.";
      grid.replaceChildren(empty);
      return;
    }
    renderMasonry(grid, cards, (card) => createPinNode(card, (c) => openCardDetail(nav, c, renderList)));
  }
}
