requireAuthenticatedUser();

const tripDatabase = initializeFirebaseDatabase();
const tripRef = tripDatabase.ref("toronto");

const daysList = document.getElementById("days");
const tripCount = document.getElementById("france-count");
const tripError = document.getElementById("france-error");
const pendingDaySaves = new Map();
const dayNotes = new Map(); // day key to editable notes element

function showTripError(message) {
  tripError.textContent = message;
}


const TRIP_DAY_COUNT = 10; // placeholder days until we pick real dates

function tripDays() {
  return Array.from({ length: TRIP_DAY_COUNT }, (unused, index) => index + 1);
}

function renderCountdown() {
  tripCount.textContent = "🍁";
}

// the dates line is shared and editable, until this trip has fixed dates
const tripDates = document.getElementById("trip-dates");
const tripDatesRef = tripRef.child("_dates");
let tripDatesTimer = null;

function saveTripDates() {
  const text = tripDates.innerText.replace(/\u00a0/g, " ").trim();
  const write = text ? tripDatesRef.set(text) : tripDatesRef.remove();
  write.catch((error) => {
    console.error("trip dates save failed:", error);
    showTripError("couldn't save the dates, check your connection");
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
  const reference = tripRef.child(key);
  const write = text.trim() ? reference.set(text) : reference.remove();
  write
    .then(() => showTripError(""))
    .catch((error) => {
      console.error("itinerary save failed:", error);
      showTripError("couldn't save that day, check your connection");
    });
}

// firebase: shared value subscription, both devices plan the same trip, live
tripRef.on("value", (snapshot) => {
  const value = snapshot.val() || {};
  dayNotes.forEach((notesElement, key) => {
    if (document.activeElement === notesElement) return; // don't yank the cursor mid-edit
    const text = typeof value[key] === "string" ? value[key] : "";
    if (notesElement.innerText !== text) notesElement.innerText = text;
  });
}, (error) => {
  console.error("itinerary subscription failed:", error);
  showTripError("can't reach the itinerary, check the connection (or the firebase rules)");
});


// Reservation forms use the shared editor.
initializeTripReservations(tripRef, showTripError);

buildDays();
renderCountdown();

