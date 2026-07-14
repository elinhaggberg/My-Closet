import { getMeasurements, saveMeasurement, deleteMeasurement, createEmptyMeasurement, getLatestMeasurement, getUnit } from "../storage.js";
import { DIMENSIONS } from "../sizing.js";
import { formatDate } from "../util.js";
import { openSheet } from "../sheet.js";

export function renderMeasurements(root, nav) {
  const tpl = document.getElementById("tpl-measurements");
  root.replaceChildren(tpl.content.cloneNode(true));
  root.querySelector(".back-btn").addEventListener("click", () => nav.toHome());

  const unit = getUnit();
  const form = document.getElementById("measurement-form");
  form.date.value = new Date().toISOString().slice(0, 10);

  const latest = getLatestMeasurement();
  const inputs = {};
  const fieldsContainer = document.getElementById("measurement-value-fields");
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

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const entry = createEmptyMeasurement();
    entry.date = form.date.value || entry.date;
    entry.note = form.note.value.trim();
    entry.values = {};
    for (const dim of DIMENSIONS) {
      const v = inputs[dim.key].value;
      if (v !== "") entry.values[dim.key] = Number(v);
    }
    saveMeasurement(entry);
    form.note.value = "";
    renderHistory();
  });

  renderHistory();

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
    const parts = DIMENSIONS.filter((d) => entry.values?.[d.key] != null).map((d) => `${d.label}: ${entry.values[d.key]}${unit}`);
    values.textContent = parts.length ? parts.join(" · ") : "No values";

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
        renderHistory();
      });
    });
    actions.appendChild(delBtn);

    div.append(date, values, actions);
    return div;
  }
}
