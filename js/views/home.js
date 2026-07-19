import {
  getCards,
  getHomeTitle,
  exportBackupData,
  markBackedUp,
  dismissBackupBanner,
  shouldShowBackupBanner,
} from "../storage.js";
import { createPinNode } from "../pin.js";
import { renderTabbar } from "../tabbar.js";
import { renderMasonry } from "../masonry.js";
import { openSaveChoice } from "../save.js";
import { openCardDetail } from "../cardDetail.js";
import { openSettingsMenu } from "../settingsMenu.js";
import { shareOrDownload } from "../share.js";

export function renderHome(root, nav) {
  const tpl = document.getElementById("tpl-home");
  root.replaceChildren(tpl.content.cloneNode(true));
  renderTabbar(root, nav, "home");

  document.getElementById("home-title").textContent = getHomeTitle();
  document.getElementById("add-btn").addEventListener("click", () => openSaveChoice(nav, renderList));
  document.getElementById("settings-btn").addEventListener("click", () => openSettingsMenu(nav, renderList));

  renderList();

  const banner = document.getElementById("backup-banner");
  if (shouldShowBackupBanner()) {
    banner.classList.remove("hidden");
    banner.querySelector("#backup-now-btn").addEventListener("click", async () => {
      const data = exportBackupData();
      const stamp = new Date().toISOString().slice(0, 10);
      await shareOrDownload(`my-closet-backup-${stamp}.json`, JSON.stringify(data, null, 2));
      markBackedUp();
      banner.classList.add("hidden");
    });
    banner.querySelector("#backup-dismiss-btn").addEventListener("click", () => {
      dismissBackupBanner();
      banner.classList.add("hidden");
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
