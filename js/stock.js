// Pure date math for Stock items — kept separate from storage.js the same
// way sizing.js is, so the "how long until I need this again" logic isn't
// tangled up with CRUD/localStorage concerns.

export const REPLACE_UNITS = [
  { id: "days", label: "days", labelOne: "day" },
  { id: "weeks", label: "weeks", labelOne: "week" },
  { id: "months", label: "months", labelOne: "month" },
  { id: "years", label: "years", labelOne: "year" },
];

export function unitLabel(unit, value) {
  const def = REPLACE_UNITS.find((u) => u.id === unit) || REPLACE_UNITS[2];
  return Number(value) === 1 ? def.labelOne : def.label;
}

// Both in and out are "YYYY-MM-DD" strings (plain date, no time), matching
// the <input type="date"> convention already used for measurements.
export function addToDate(dateStr, value, unit) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const n = Number(value) || 0;
  switch (unit) {
    case "days":
      date.setUTCDate(date.getUTCDate() + n);
      break;
    case "weeks":
      date.setUTCDate(date.getUTCDate() + n * 7);
      break;
    case "years":
      date.setUTCFullYear(date.getUTCFullYear() + n);
      break;
    default:
      date.setUTCMonth(date.getUTCMonth() + n);
  }
  return date.toISOString().slice(0, 10);
}

// Null when there's not enough info yet (no "last bought" date on record) —
// callers should treat that as "unknown", not "never due".
export function nextRestockDate(item) {
  if (!item.lastBought || !item.replaceEveryValue) return null;
  return addToDate(item.lastBought, item.replaceEveryValue, item.replaceEveryUnit);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function isDue(item) {
  const next = nextRestockDate(item);
  return !!next && next <= todayStr();
}

export function daysUntil(dateStr) {
  const today = new Date(todayStr() + "T00:00:00Z");
  const target = new Date(dateStr + "T00:00:00Z");
  return Math.round((target - today) / 86400000);
}
