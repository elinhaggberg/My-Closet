import { getChecklist, saveChecklist, makeChecklistItem } from "../storage.js";
import { toggleChecklistItemChecked } from "../util.js";
import { enableDragReorder, forceTeardownActiveDrag } from "../dragReorder.js";

function stripEmptyItems(items) {
  return items
    .map((item) => ({ ...item, text: item.text.trim(), children: stripEmptyItems(item.children || []) }))
    .filter((item) => item.text.length > 0 || item.children.length > 0);
}

export function renderChecklistEdit(root, nav, listId) {
  const source = getChecklist(listId);
  if (!source) {
    nav.toLists();
    return;
  }
  const list = structuredClone(source);
  list.items = list.items.map((item) => ({ children: [], ...item }));

  if (list.items.length === 0) {
    list.items.push(makeChecklistItem());
  } else {
    // Editing a saved list opens with a trailing empty item, so it's
    // obvious you can just start typing to add another step instead of
    // hunting for an explicit "add" action.
    const last = list.items[list.items.length - 1];
    if (last.text.trim() !== "" || last.children.length > 0) {
      list.items.push(makeChecklistItem());
    }
  }

  const tpl = document.getElementById("tpl-checklist-edit");
  root.replaceChildren(tpl.content.cloneNode(true));
  root.querySelector(".back-btn").addEventListener("click", () => nav.toList(list.id));

  const titleInput = root.querySelector("#checklist-edit-title-input");
  titleInput.value = list.name;
  titleInput.addEventListener("input", () => {
    list.name = titleInput.value;
  });

  root.querySelector(".save-list-btn").addEventListener("click", () => {
    list.name = titleInput.value.trim() || "Untitled list";
    list.items = stripEmptyItems(list.items);
    saveChecklist(list);
    nav.toList(list.id);
  });

  const listEl = root.querySelector("#checklist-edit-item-list");

  function ensureAtLeastOneItem() {
    if (list.items.length === 0) list.items.push(makeChecklistItem());
  }

  function renderItems(focusId) {
    forceTeardownActiveDrag();
    ensureAtLeastOneItem();
    const groups = list.items.map((item) => createTopLevelGroup(item));
    listEl.replaceChildren(...groups);
    if (focusId) {
      const input = listEl.querySelector(`[data-id="${focusId}"] .todo-item-text`);
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }
  }

  function createTopLevelGroup(item) {
    const group = document.createElement("div");
    group.className = "todo-item-group";
    group.dataset.id = item.id;

    const row = createItemRow(item, list.items, { onEnter: (idx) => insertAfter(list.items, idx, item.id), onRemove: () => removeItem(list.items, item.id) });

    // Nesting is an explicit, visible action — an item can become a child of
    // whatever's directly above it, as long as it isn't itself already a
    // parent (no grandchildren) and there's something above it to nest under.
    const itemIdx = list.items.findIndex((i) => i.id === item.id);
    if (itemIdx > 0 && item.children.length === 0) {
      const indentBtn = row.querySelector(".indent-btn");
      indentBtn.classList.remove("hidden");
      indentBtn.addEventListener("click", () => nestUnderPrevious(item));
    }

    group.appendChild(row);

    if (item.children.length > 0) {
      const childrenEl = document.createElement("div");
      childrenEl.className = "todo-children";
      item.children.forEach((child) => {
        const childRow = createItemRow(child, item.children, {
          onEnter: (idx) => insertAfter(item.children, idx, child.id),
          onRemove: () => removeItem(item.children, child.id),
          isChild: true,
        });
        childRow.querySelector(".unnest-btn").classList.remove("hidden");
        childRow.querySelector(".unnest-btn").addEventListener("click", () => unnestItem(item, child.id));
        enableDragReorder(childRow, childRow.querySelector(".drag-handle"), childrenEl, (order) => {
          item.children.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        });
        childrenEl.appendChild(childRow);
      });
      group.appendChild(childrenEl);
    }

    // Drag here is pure reordering — nesting is handled by the explicit
    // indent/un-nest buttons instead, so a drag can never surprise someone
    // by nesting an item when they only meant to move it up or down.
    enableDragReorder(group, row.querySelector(".drag-handle"), listEl, (order) => {
      list.items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    });

    return group;
  }

  function createItemRow(item, ownerArray, { onEnter, onRemove, isChild = false } = {}) {
    const frag = document.getElementById("tpl-checklist-item").content.cloneNode(true);
    const row = frag.querySelector(".todo-item");
    row.dataset.id = item.id;
    if (isChild) row.classList.add("nested");

    const checkbox = row.querySelector(".todo-checkbox");
    checkbox.classList.toggle("checked", item.checked);
    checkbox.addEventListener("click", () => {
      // A full re-render since checking a parent/last child can change more
      // than one row's checkbox at once.
      toggleChecklistItemChecked(list, item.id);
      renderItems();
    });

    const input = row.querySelector(".todo-item-text");
    input.value = item.text;
    input.addEventListener("input", () => {
      item.text = input.value;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const idx = ownerArray.findIndex((i) => i.id === item.id);
        onEnter(idx);
      } else if (e.key === "Backspace" && input.selectionStart === 0 && input.selectionEnd === 0 && ownerArray.length > 1) {
        e.preventDefault();
        const idx = ownerArray.findIndex((i) => i.id === item.id);
        const prevId = idx > 0 ? ownerArray[idx - 1].id : null;
        onRemove();
        renderItems(prevId);
      }
    });

    row.querySelector(".remove-btn").addEventListener("click", () => {
      if (ownerArray.length <= 1 && !isChild) return; // keep at least one top-level row
      onRemove();
      renderItems();
    });

    return row;
  }

  function insertAfter(array, idx, afterId) {
    const realIdx = array.findIndex((i) => i.id === afterId);
    const fresh = makeChecklistItem();
    array.splice(realIdx + 1, 0, fresh);
    renderItems(fresh.id);
  }

  function removeItem(array, id) {
    const idx = array.findIndex((i) => i.id === id);
    if (idx >= 0) array.splice(idx, 1);
  }

  function nestUnderPrevious(item) {
    const idx = list.items.findIndex((i) => i.id === item.id);
    if (idx <= 0) return;
    const prev = list.items[idx - 1];
    const [removed] = list.items.splice(idx, 1);
    prev.children.push({ id: removed.id, text: removed.text, checked: removed.checked, children: [] });
    renderItems();
  }

  function unnestItem(parent, childId) {
    const idx = parent.children.findIndex((c) => c.id === childId);
    if (idx < 0) return;
    const [child] = parent.children.splice(idx, 1);
    const parentIdx = list.items.findIndex((i) => i.id === parent.id);
    list.items.splice(parentIdx + 1, 0, { id: child.id, text: child.text, checked: child.checked, children: [] });
    renderItems();
  }

  renderItems();
}
