export function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function hostnameFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function formatPrice(price, currency) {
  if (price == null || price === "") return "";
  const n = Number(price);
  if (Number.isNaN(n)) return String(price);
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
    } catch {
      return `${n} ${currency}`;
    }
  }
  return String(n);
}

// ---- Checklists ----

// Flattens a list's items (top-level + one level of children) into a single
// array — used to count progress.
function flattenChecklistItems(list) {
  const flat = [];
  for (const item of list.items) {
    flat.push(item);
    for (const child of item.children || []) {
      flat.push(child);
    }
  }
  return flat;
}

export function checklistCounts(list) {
  const flat = flattenChecklistItems(list);
  const total = flat.length;
  const checked = flat.filter((i) => i.checked).length;
  return { checked, total };
}

export function checklistMeta(list) {
  const { checked, total } = checklistCounts(list);
  if (total === 0) return "No items yet";
  return `${checked}/${total} checked`;
}

// Toggles one item's checked state and cascades the natural consequences:
// checking a parent checks all its children (marking the whole group done);
// checking the last remaining unchecked child checks the parent (the group
// is now done); either direction also runs in reverse on uncheck, since a
// parent's checked state is only ever true when the group actually is.
export function toggleChecklistItemChecked(list, itemId) {
  let target = null;
  let parent = null;
  for (const item of list.items) {
    if (item.id === itemId) {
      target = item;
      break;
    }
    const child = (item.children || []).find((c) => c.id === itemId);
    if (child) {
      target = child;
      parent = item;
      break;
    }
  }
  if (!target) return;

  const nextValue = !target.checked;
  target.checked = nextValue;

  if (!parent) {
    for (const child of target.children || []) {
      child.checked = nextValue;
    }
  } else if (nextValue && parent.children.length > 0 && parent.children.every((c) => c.checked) && !parent.checked) {
    parent.checked = true;
  } else if (!nextValue && parent.checked) {
    parent.checked = false;
  }
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
