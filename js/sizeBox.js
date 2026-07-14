import { computeSizeRecommendation } from "./sizing.js";
import { getLatestMeasurement, getUnit } from "./storage.js";
import { ICON_CHECK, ICON_WARNING } from "./icons.js";

// Renders into `container` synchronously — used both as a live preview
// while editing a wishlist item's garment measurements, and as a read-only
// summary on the card detail sheet.
export function renderSizeBox(container, categoryId, garment) {
  const unit = getUnit();
  const body = getLatestMeasurement()?.values || {};
  const hasAnyBody = Object.keys(body).length > 0;

  if (!hasAnyBody) {
    container.innerHTML =
      '<div class="size-box"><p class="size-empty">Log your body measurements in Settings → Measurements to see a size comparison here.</p></div>';
    return;
  }

  const result = computeSizeRecommendation(categoryId, garment, body);
  if (!result) {
    container.innerHTML = `<div class="size-box"><p class="size-empty">Fill in the garment's own measurements above to compare against your latest body measurements (in ${unit}).</p></div>`;
    return;
  }

  const icon = result.overallTag === "bad" || result.overallTag === "warn" ? ICON_WARNING : ICON_CHECK;
  const rowsHtml = result.rows
    .map(
      (r) => `
      <div class="size-dim-row">
        <span class="size-dim-label">${r.label}</span>
        <span class="size-dim-value">${r.garment}${unit} vs ${r.body}${unit}</span>
        <span class="size-dim-tag ${r.tag}">${r.text}</span>
      </div>`
    )
    .join("");

  container.innerHTML = `
    <div class="size-box">
      <p class="size-verdict ${result.overallTag}">${icon}<span>${result.overallText}</span></p>
      <p class="size-hint">${result.category.label} vs. your latest measurements</p>
      <div class="size-dims">${rowsHtml}</div>
    </div>`;
}
