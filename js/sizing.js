// Compares a garment's own measurements against your latest body snapshot
// and turns the differences into a plain-language size recommendation.
// Everything here assumes both sides were entered in the same unit (the
// app enforces a single global unit, so no conversion happens).

export const DIMENSIONS = [
  { key: "bust", label: "Bust/chest" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "shoulderWidth", label: "Shoulder" },
  { key: "sleeveLength", label: "Sleeve" },
  { key: "inseam", label: "Inseam" },
  { key: "footLength", label: "Foot length" },
];

export const CATEGORIES = [
  { id: "top", label: "Top", dims: ["bust", "shoulderWidth", "sleeveLength"] },
  { id: "bottom", label: "Bottom", dims: ["waist", "hips", "inseam"] },
  { id: "dress", label: "Dress", dims: ["bust", "waist", "hips"] },
  { id: "outerwear", label: "Outerwear", dims: ["bust", "shoulderWidth"] },
  { id: "shoes", label: "Shoes", dims: ["footLength"] },
];

// The categories shown in "my current size preferences" — a plain memory
// aid on the Measurements page. Bra size has no numeric body dimension to
// compare against, so it's only meaningful here, not as a wishlist garment
// category (CATEGORIES, below), which drives the actual sizing comparison.
export const SIZE_PREF_CATEGORIES = [
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "dress", label: "Dress" },
  { id: "outerwear", label: "Outerwear" },
  { id: "shoes", label: "Shoes" },
  { id: "bra", label: "Bra size" },
];

export function dimLabel(key) {
  return DIMENSIONS.find((d) => d.key === key)?.label || key;
}

export function categoryFor(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}

function classifyEase(key, ease) {
  if (key === "footLength") {
    if (ease < 0) return { tag: "bad", text: "Shorter than your foot" };
    if (ease < 1) return { tag: "good", text: "Snug" };
    if (ease <= 2.5) return { tag: "good", text: "True to size" };
    return { tag: "warn", text: "Roomy" };
  }
  if (ease < 0) return { tag: "bad", text: "Tighter than you" };
  if (ease < 4) return { tag: "good", text: "Snug fit" };
  if (ease < 12) return { tag: "good", text: "Comfortable ease" };
  if (ease < 20) return { tag: "warn", text: "Relaxed fit" };
  return { tag: "warn", text: "Oversized" };
}

// Returns null when there isn't enough data (no garment measurements filled
// in, or no body measurement logged yet for any of the relevant dimensions).
export function computeSizeRecommendation(categoryId, garment, body) {
  const category = categoryFor(categoryId);
  const rows = [];

  for (const key of category.dims) {
    const g = Number(garment?.[key]);
    const b = Number(body?.[key]);
    if (!garment?.[key] || Number.isNaN(g) || !body?.[key] || Number.isNaN(b)) continue;
    const ease = g - b;
    const { tag, text } = classifyEase(key, ease);
    rows.push({ key, label: dimLabel(key), garment: g, body: b, ease, tag, text });
  }

  if (rows.length === 0) return null;

  let overallTag = "good";
  if (rows.some((r) => r.tag === "bad")) overallTag = "bad";
  else if (rows.some((r) => r.tag === "warn")) overallTag = "warn";

  const overallText =
    overallTag === "bad"
      ? "Likely runs small — consider sizing up"
      : overallTag === "warn"
      ? "Runs generous / relaxed fit"
      : "Should fit true to size";

  return { category, rows, overallTag, overallText };
}
