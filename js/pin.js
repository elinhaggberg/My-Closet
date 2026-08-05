import { formatPrice, hostnameFor } from "./util.js";
import { computeSizeRecommendation } from "./sizing.js";
import { getLatestMeasurement } from "./storage.js";
import { lazyLoadImage } from "./lazyImage.js";
import { ICON_CHECK, ICON_WARNING, ICON_IMAGE } from "./icons.js";

// Builds one Pinterest-style grid tile from the shared <template id="tpl-pin-card">.
export function createPinNode(card, onOpen) {
  const tpl = document.getElementById("tpl-pin-card");
  const node = tpl.content.cloneNode(true);
  const article = node.querySelector(".pin");
  const img = node.querySelector(".pin-media");
  const placeholder = node.querySelector(".pin-media-placeholder");

  if (card.image) {
    img.alt = card.title || "";
    // lazyLoadImage defers the actual resolve (an IndexedDB read for a
    // local upload) until the card scrolls near the viewport, but still
    // shows the image element immediately with its aspect-ratio reserved
    // (see style.css) -- otherwise masonry.js's column-balancing
    // measurement runs before any image has rendered and badly misjudges
    // which column is shortest. Falls back to the placeholder only if
    // resolution fails.
    lazyLoadImage(img, card.image, () => {
      img.classList.add("hidden");
      placeholder.innerHTML = ICON_IMAGE;
      placeholder.classList.remove("hidden");
    });
  } else {
    placeholder.innerHTML = ICON_IMAGE;
    placeholder.classList.remove("hidden");
  }

  // No title means this was saved as purely inspirational — no "Untitled"
  // filler text, just the image filling the whole card (see .pin-untitled).
  article.classList.toggle("pin-untitled", !card.title);
  node.querySelector(".pin-title").textContent = card.title || "";

  const priceEl = node.querySelector(".pin-price");
  if (card.price) {
    priceEl.textContent = formatPrice(card.price, card.currency);
    priceEl.classList.remove("hidden");
  }

  const sourceEl = node.querySelector(".pin-source");
  const source = card.siteName || hostnameFor(card.url);
  if (source) {
    sourceEl.textContent = source;
    sourceEl.classList.remove("hidden");
  }

  if (card.wishlist) {
    const body = getLatestMeasurement()?.values || {};
    const result = computeSizeRecommendation(card.wishlist.category, card.wishlist.garment, body);
    if (result) {
      const badge = node.querySelector(".pin-badge");
      badge.classList.remove("hidden");
      badge.classList.add(result.overallTag);
      const label = result.overallTag === "bad" ? "Runs small" : result.overallTag === "warn" ? "Runs big" : "True to size";
      badge.innerHTML = `${result.overallTag === "good" ? ICON_CHECK : ICON_WARNING}<span>${label}</span>`;
    }
  }

  article.addEventListener("click", () => onOpen(card));
  return node;
}
