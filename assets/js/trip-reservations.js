function initializeTripReservations(tripRef, showError) {
  "use strict";
const pendingForms = new WeakSet();
const RESERVATION_TYPES = ["train", "hotel", "restaurant"];
const resvRef = tripRef.child("_resv");
let reservations = {};

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createExternalLink(className, text, href) {
  const link = createTextElement("a", className, text);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener";
  return link;
}

function createResvCard(type, id, entry) {
  const item = document.createElement("li");
  item.className = "resv-card";

  const body = document.createElement("div");
  body.className = "resv-body";

  const title = createTextElement("div", "resv-name", entry.title);
  body.appendChild(title);

  if (entry.when) {
    const when = createTextElement("div", "resv-when", entry.when);
    body.appendChild(when);
  }
  if (entry.address) {
    const address = createExternalLink(
      "resv-addr",
      "📍 " + entry.address,
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(entry.address)
    );
    body.appendChild(address);
  }
  if (entry.code) {
    const code = createTextElement("div", "resv-code", entry.code);
    body.appendChild(code);
  }

  const actions = document.createElement("div");
  actions.className = "resv-actions";

  const editButton = document.createElement("button");
  editButton.className = "resv-edit";
  editButton.type = "button";
  editButton.textContent = "✎";
  editButton.setAttribute("aria-label", "edit reservation");
  editButton.addEventListener("click", () => startReservationEdit(type, id, entry));

  const removeButton = document.createElement("button");
  removeButton.className = "resv-delete";
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "delete reservation");
  removeButton.addEventListener("click", () => {
    if (editingReservation.type === type && editingReservation.id === id) clearReservationEdit();
    resvRef.child(type).child(id).remove().catch((error) => {
      console.error("reservation delete failed:", error);
      showError("couldn't delete that: check your connection");
    });
  });

  actions.append(editButton, removeButton);
  item.append(body, actions);
  return item;
}

function normalizeReservation(id, entry) {
  if (!entry || typeof entry.title !== "string" || !entry.title.trim()) return null;
  return {
    id,
    title: entry.title.trim(),
    when: entry.when || "",
    address: entry.address || "",
    code: entry.code || "",
    at: Number(entry.at) || 0,
  };
}

function renderReservations() {
  for (const type of RESERVATION_TYPES) {
    const list = document.getElementById("resv-" + type);
    if (!list) continue;
    const entries = Object.entries(reservations[type] || {})
      .map(([id, entry]) => normalizeReservation(id, entry))
      .filter(Boolean)
      .sort((first, second) => first.at - second.at);
    list.replaceChildren(...entries.map((entry) => createResvCard(type, entry.id, entry)));
  }
}

resvRef.on("value", (snapshot) => {
  reservations = snapshot.val() || {};
  renderReservations();
}, (error) => {
  console.error("reservations subscription failed:", error);
  showError("can't reach the reservations: check the connection");
});

function setReservationFormExpanded(column, expanded) {
  const form = column.querySelector(".resv-form");
  const toggle = column.querySelector(".resv-toggle");
  const type = column.dataset.type;
  form.hidden = !expanded;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.setAttribute("aria-label", expanded ? "close " + type + " reservation form" : "add " + type + " reservation");
  if (expanded) form.elements.title.focus();
}

let editingReservation = { type: null, id: null };

function submitLabelFor(type) {
  return type === "train" ? "add train/bus" : "add " + type;
}

function startReservationEdit(type, id, entry) {
  const column = document.querySelector('.resv-col[data-type="' + type + '"]');
  if (!column) return;
  const form = column.querySelector(".resv-form");
  editingReservation = { type, id };
  form.elements.title.value = entry.title || "";
  form.elements.when.value = entry.when || "";
  form.elements.address.value = entry.address || "";
  form.elements.code.value = entry.code || "";
  form.querySelector(".resv-add").textContent = "save changes";
  setReservationFormExpanded(column, true);
}

function clearReservationEdit() {
  if (!editingReservation.type) return;
  const column = document.querySelector('.resv-col[data-type="' + editingReservation.type + '"]');
  if (column) {
    const form = column.querySelector(".resv-form");
    form.querySelector(".resv-add").textContent = submitLabelFor(editingReservation.type);
  }
  editingReservation = { type: null, id: null };
}

document.querySelectorAll(".resv-col").forEach((column) => {
  const toggle = column.querySelector(".resv-toggle");
  const cancel = column.querySelector(".resv-cancel");
  const form = column.querySelector(".resv-form");

  toggle.addEventListener("click", () => {
    setReservationFormExpanded(column, toggle.getAttribute("aria-expanded") !== "true");
  });

  cancel.addEventListener("click", () => {
    form.reset();
    clearReservationEdit();
    setReservationFormExpanded(column, false);
    toggle.focus();
  });
});

document.querySelectorAll(".resv-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (pendingForms.has(form)) return;
    const type = form.dataset.type;
    const title = form.elements.title.value.trim();
    if (!title || !RESERVATION_TYPES.includes(type)) return;
    pendingForms.add(form);
    const submit = form.querySelector(".resv-add");
    submit.disabled = true;
    const fields = {
      title,
      when: form.elements.when.value.trim(),
      address: form.elements.address.value.trim(),
      code: form.elements.code.value.trim(),
    };
    const isEdit = editingReservation.type === type && editingReservation.id;
    const write = isEdit
      ? resvRef.child(type).child(editingReservation.id).update(fields)
      : resvRef.child(type).push({ ...fields, at: firebase.database.ServerValue.TIMESTAMP });
    write
      .then(() => {
        form.reset();
        clearReservationEdit();
        setReservationFormExpanded(form.closest(".resv-col"), false);
        showError("");
      })
      .catch((error) => {
        console.error("reservation save failed:", error);
        showError("couldn't save that: check your connection");
      })
      .finally(() => { pendingForms.delete(form); submit.disabled = false; });
  });
});
}
