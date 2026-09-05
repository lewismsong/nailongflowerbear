requireAuthenticatedUser();

const franceDatabase = initializeFirebaseDatabase();
const franceRef = franceDatabase.ref("berlin");

// the plan so far, written into the shared itinerary once, then freely editable
const DEFAULT_PLANS = {}; // no seeded plan yet, dates are still up in the air

// write the defaults exactly once (a flag in the database guards against re-seeding,
// so nothing you edit or delete later will ever come back on its own)
function seedDefaultsOnce() {
  franceRef.child("_seeded").transaction(
    (already) => (already ? undefined : true),
    (error, committed) => {
      if (error || !committed) return;
      franceRef.update(DEFAULT_PLANS).catch((seedError) => {
        console.error("itinerary seed failed:", seedError);
        showFranceError("couldn't load the starter plans, check the firebase rules");
      });
    }
  );
}

const daysList = document.getElementById("days");
const franceCount = document.getElementById("france-count");
const franceError = document.getElementById("france-error");
const pendingDaySaves = new Map();
const dayNotes = new Map(); // day key to editable notes element
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function showFranceError(message) {
  franceError.textContent = message;
}


const SHANGHAI_DAY_COUNT = 10; // placeholder days until we pick real dates

function tripDays() {
  return Array.from({ length: SHANGHAI_DAY_COUNT }, (unused, index) => index + 1);
}

function renderCountdown() {
  franceCount.textContent = "🥨";
}

// the dates line is shared and editable, since shanghai has no fixed dates yet
const tripDates = document.getElementById("trip-dates");
const tripDatesRef = franceRef.child("_dates");
let tripDatesTimer = null;

function saveTripDates() {
  const text = tripDates.innerText.replace(/\u00a0/g, " ").trim();
  const write = text ? tripDatesRef.set(text) : tripDatesRef.remove();
  write.catch((error) => {
    console.error("trip dates save failed:", error);
    showFranceError("couldn't save the dates, check your connection");
  });
}

tripDates.addEventListener("input", () => {
  if (tripDatesTimer) clearTimeout(tripDatesTimer);
  tripDatesTimer = setTimeout(saveTripDates, 400);
});

tripDates.addEventListener("blur", () => {
  if (tripDatesTimer) clearTimeout(tripDatesTimer);
  saveTripDates();
});

tripDates.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    tripDates.blur();
  }
});

tripDatesRef.on("value", (snapshot) => {
  if (document.activeElement === tripDates) return; // don't yank the cursor mid-edit
  const text = typeof snapshot.val() === "string" ? snapshot.val() : "";
  if (tripDates.innerText !== text) tripDates.innerText = text;
});

const itineraryToggle = document.getElementById("itinerary-toggle");
const itineraryToggleLabel = document.getElementById("itinerary-toggle-label");

function setItineraryExpanded(expanded) {
  daysList.hidden = !expanded;
  itineraryToggle.setAttribute("aria-expanded", String(expanded));
  itineraryToggleLabel.textContent = expanded ? "collapse" : "show itinerary";
}

itineraryToggle.addEventListener("click", () => {
  setItineraryExpanded(itineraryToggle.getAttribute("aria-expanded") !== "true");
});

function buildDays() {
  const frag = document.createDocumentFragment();
  tripDays().forEach((dayNumber, index) => {
    const key = "day-" + dayNumber;

    const item = document.createElement("li");
    item.className = "day-card";
    item.dataset.key = key;

    const head = document.createElement("div");
    head.className = "day-head";

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = "day " + (index + 1);

    head.append(number);

    const notes = document.createElement("div");
    notes.className = "day-notes";
    notes.contentEditable = "true";
    notes.dataset.placeholder = "ideas for this day, tap to write";
    notes.setAttribute("role", "textbox");
    notes.setAttribute("aria-label", "plans for day " + dayNumber);
    notes.setAttribute("spellcheck", "true");
    notes.addEventListener("input", () => scheduleDaySave(key, notes));
    notes.addEventListener("blur", () => flushDaySave(key, notes));

    dayNotes.set(key, notes);
    item.append(head, notes);
    frag.appendChild(item);
  });
  daysList.replaceChildren(frag);
}

function scheduleDaySave(key, notesElement) {
  const previousTimer = pendingDaySaves.get(key);
  if (previousTimer) clearTimeout(previousTimer);
  const timer = setTimeout(() => saveDay(key, notesElement), 400);
  pendingDaySaves.set(key, timer);
}

function flushDaySave(key, notesElement) {
  const timer = pendingDaySaves.get(key);
  if (timer) clearTimeout(timer);
  pendingDaySaves.delete(key);
  saveDay(key, notesElement);
}

function saveDay(key, notesElement) {
  pendingDaySaves.delete(key);
  const text = notesElement.innerText.replace(/\u00a0/g, " ").trimEnd();
  const reference = franceRef.child(key);
  const write = text.trim() ? reference.set(text) : reference.remove();
  write
    .then(() => showFranceError(""))
    .catch((error) => {
      console.error("itinerary save failed:", error);
      showFranceError("couldn't save that day, check your connection");
    });
}

// firebase: shared value subscription, both devices plan the same trip, live
franceRef.on("value", (snapshot) => {
  const value = snapshot.val() || {};
  dayNotes.forEach((notesElement, key) => {
    if (document.activeElement === notesElement) return; // don't yank the cursor mid-edit
    const text = typeof value[key] === "string" ? value[key] : "";
    if (notesElement.innerText !== text) notesElement.innerText = text;
  });
}, (error) => {
  console.error("itinerary subscription failed:", error);
  showFranceError("can't reach the itinerary, check the connection (or the firebase rules)");
});


// reservations for trains, hotels, and restaurants are shared live
const RESERVATION_TYPES = ["train", "hotel", "restaurant"];
const resvRef = franceRef.child("_resv");
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
      showFranceError("couldn't delete that: check your connection");
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
  showFranceError("can't reach the reservations: check the connection");
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
    const type = form.dataset.type;
    const title = form.elements.title.value.trim();
    if (!title || !RESERVATION_TYPES.includes(type)) return;
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
        showFranceError("");
      })
      .catch((error) => {
        console.error("reservation save failed:", error);
        showFranceError("couldn't save that: check your connection");
      });
  });
});

buildDays();
renderCountdown();
seedDefaultsOnce();
setInterval(renderCountdown, 60 * 1000);
