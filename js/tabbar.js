import { ICON_HOME, ICON_BOARDS, ICON_CHECKLIST } from "./icons.js";

// Rendered fresh into #app after every route's replaceChildren() call, since
// #app's content is fully replaced on navigation. Position is fixed via CSS
// so DOM order relative to the page content underneath doesn't matter.
export function renderTabbar(root, nav, active) {
  const bar = document.createElement("div");
  bar.className = "tabbar";
  bar.innerHTML = `<div class="tabbar-inner">
    <button type="button" class="tab-btn" data-tab="home">${ICON_HOME}<span>Home</span></button>
    <button type="button" class="tab-btn" data-tab="boards">${ICON_BOARDS}<span>Boards</span></button>
    <button type="button" class="tab-btn" data-tab="lists">${ICON_CHECKLIST}<span>Lists</span></button>
  </div>`;
  bar.querySelectorAll(".tab-btn").forEach((btn) => {
    if (btn.dataset.tab === active) btn.classList.add("active");
    btn.addEventListener("click", () => {
      if (btn.dataset.tab === "home") nav.toHome();
      else if (btn.dataset.tab === "boards") nav.toBoards();
      else nav.toLists();
    });
  });
  root.appendChild(bar);
}
