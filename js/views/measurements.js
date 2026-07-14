import {
  getMeasurements,
  saveMeasurement,
  deleteMeasurement,
  createEmptyMeasurement,
  getLatestMeasurement,
  getUnit,
  getSizePrefs,
  setSizePrefs,
  getMeasurementNotes,
  setMeasurementNotes,
} from "../storage.js";
import { DIMENSIONS, SIZE_PREF_CATEGORIES } from "../sizing.js";
import { formatDate, escapeHtml } from "../util.js";
import { openSheet } from "../sheet.js";
import { ICON_PEN } from "../icons.js";

// Values are numbers and our own dimension labels, so this is always safe
// to use as plain text (textContent) or, escaped, as innerHTML.
function formatValuesLine(values, unit) {
  const parts = DIMENSIONS.filter((d) => values?.[d.key] != null).map((d) => `${d.label}: ${values[d.key]}${unit}`);
  return parts.length ? parts.join(" · ") : "No values";
}

function renderTableRows(pairs) {
  return pairs.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
}

export function renderMeasurements(root, nav) {
  const tpl = document.getElementById("tpl-measurements");
  root.replaceChildren(tpl.content.cloneNode(true));
  root.querySelector(".back-btn").addEventListener("click", () => nav.toHome());

  const unit = getUnit();
  document.getElementById("measurements-edit-btn").addEventListener("click", () => openEditSheet(renderAll));

  renderAll();

  function renderAll() {
    renderOverview();
    renderHistory();
  }

  function renderOverview() {
    const container = document.getElementById("measurements-overview");
    const latest = getLatestMeasurement();
    const sizePrefs = getSizePrefs();
    const notes = getMeasurementNotes();
    const filledPrefs = SIZE_PREF_CATEGORIES.filter((c) => sizePrefs[c.id]);

    if (!latest && filledPrefs.length === 0 && !notes) {
      const inlinePen = ICON_PEN.replace('class="icon"', 'class="icon icon-inline"');
      container.innerHTML = `<p class="empty-state" style="margin-top:8px;">Press ${inlinePen} to add your measurements and preferred sizes.</p>`;
      return;
    }

    const sections = [];
    const filledDims = latest ? DIMENSIONS.filter((d) => latest.values?.[d.key] != null) : [];

    if (latest && filledDims.length > 0) {
      const rows = renderTableRows(filledDims.map((d) => [d.label, `${latest.values[d.key]} ${unit}`]));
      sections.push(`
        <p class="card-detail-section-label">Latest measurements</p>
        <p class="measure-history-date">${escapeHtml(formatDate(latest.date))}</p>
        <div class="measure-table-card"><table class="measure-table"><tbody>${rows}</tbody></table></div>
      `);
    }

    if (filledPrefs.length > 0) {
      const rows = renderTableRows(filledPrefs.map((c) => [c.label, sizePrefs[c.id]]));
      sections.push(`
        <p class="card-detail-section-label">Size preferences</p>
        <div class="measure-table-card"><table class="measure-table"><tbody>${rows}</tbody></table></div>
      `);
    }

    if (notes) {
      sections.push(`
        <p class="card-detail-section-label">Notes</p>
        <p class="card-detail-note">${escapeHtml(notes)}</p>
      `);
    }

    container.innerHTML = sections.join("");
  }

  function renderHistory() {
    const list = document.getElementById("measure-history");
    const all = getMeasurements();
    if (all.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No measurements logged yet.";
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...all.map(renderHistoryItem));
  }

  function renderHistoryItem(entry) {
    const div = document.createElement("div");
    div.className = "measure-history-item";

    const date = document.createElement("p");
    date.className = "measure-history-date";
    date.textContent = formatDate(entry.date);

    const values = document.createElement("p");
    values.className = "measure-history-values";
    values.textContent = formatValuesLine(entry.values, unit);

    const actions = document.createElement("div");
    actions.className = "measure-history-actions";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-btn delete-btn";
    delBtn.setAttribute("aria-label", "Delete snapshot");
    delBtn.innerHTML =
      '<svg class="icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false"><path d="M136.7 5.9C141.1-7.2 153.3-16 167.1-16l113.9 0c13.8 0 26 8.8 30.4 21.9L320 32 416 32c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 8.7-26.1zM32 144l384 0 0 304c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-304zm88 64c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24z"/></svg>';
    delBtn.addEventListener("click", () => {
      const sheet = openSheet("tpl-confirm-delete");
      sheet.el.querySelector(".confirm-message").textContent = `Delete the ${formatDate(entry.date)} snapshot? This can't be undone.`;
      sheet.el.querySelector(".cancel-btn").addEventListener("click", () => sheet.close());
      sheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
        deleteMeasurement(entry.id);
        sheet.close();
        renderAll();
      });
    });
    actions.appendChild(delBtn);

    div.append(date, values, actions);
    return div;
  }
}

function openEditSheet(onSaved) {
  const sheet = openSheet("tpl-measurements-edit");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

  const unit = getUnit();
  const form = el.querySelector("#measurement-edit-form");
  form.date.value = new Date().toISOString().slice(0, 10);

  const latest = getLatestMeasurement();
  const inputs = {};
  const fieldsContainer = el.querySelector("#measurement-value-fields");
  fieldsContainer.replaceChildren(
    ...DIMENSIONS.map((dim) => {
      const label = document.createElement("label");
      label.className = "field";
      const span = document.createElement("span");
      span.textContent = `${dim.label} (${unit})`;
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.1";
      input.min = "0";
      input.name = dim.key;
      if (latest?.values?.[dim.key] != null) input.value = latest.values[dim.key];
      label.append(span, input);
      inputs[dim.key] = input;
      return label;
    })
  );

  const sizePrefs = getSizePrefs();
  const prefInputs = {};
  const prefFieldsContainer = el.querySelector("#size-pref-fields");
  prefFieldsContainer.replaceChildren(
    ...SIZE_PREF_CATEGORIES.map((cat) => {
      const label = document.createElement("label");
      label.className = "field";
      const span = document.createElement("span");
      span.textContent = cat.label;
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 20;
      input.placeholder = "e.g. M";
      input.value = sizePrefs[cat.id] || "";
      label.append(span, input);
      prefInputs[cat.id] = input;
      return label;
    })
  );

  form.generalNote.value = getMeasurementNotes();

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const entry = createEmptyMeasurement();
    entry.date = form.date.value || entry.date;
    entry.note = form.snapshotNote.value.trim();
    entry.values = {};
    for (const dim of DIMENSIONS) {
      const v = inputs[dim.key].value;
      if (v !== "") entry.values[dim.key] = Number(v);
    }
    saveMeasurement(entry);

    const newPrefs = {};
    for (const cat of SIZE_PREF_CATEGORIES) {
      const v = prefInputs[cat.id].value.trim();
      if (v) newPrefs[cat.id] = v;
    }
    setSizePrefs(newPrefs);

    setMeasurementNotes(form.generalNote.value.trim());

    sheet.close();
    onSaved();
  });
}
