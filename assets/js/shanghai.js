requireAuthenticatedUser();

const tripDatabase = initializeFirebaseDatabase();
const tripRef = tripDatabase.ref("shanghai");

const daysList = document.getElementById("days");
const tripCount = document.getElementById("france-count");
const tripError = document.getElementById("france-error");
const pendingDaySaves = new Map();
const dayNotes = new Map(); // day key to editable notes element

function showTripError(message) {
  tripError.textContent = message;
}


const TRIP_DAY_COUNT = window.shanghaiTrip.dayCount;

function tripDays() {
  return Array.from({ length: TRIP_DAY_COUNT }, (unused, index) => index + 1);
}

function renderCountdown() {
  tripCount.textContent = window.shanghaiTrip.countdown();
}
document.getElementById('trip-dates').textContent = window.shanghaiTrip.label;

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

    const label = document.createElement('span');
    label.className = 'day-date';
    label.textContent = window.shanghaiTrip.dateForDay(index).toLocaleDateString('en-US', {
      timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric'
    }).toLowerCase();
    head.append(number, label);

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

function addChongqingBookingsOnce() {
  return tripRef.transaction((current) => {
    const trip = current || {};
    if (trip._chongqingBookings20261005) return;
    const additions = {
      "day-14": "✈️ Shanghai (SHA) → Chongqing (CKG)\nThu 3 Dec 2026 · 16:05–19:05 (China time)\nBooked via Booking.com.\n🏨 ARISTON AIRESTON HOTEL — 3–7 Dec, 4 nights.\nCheck-in available after 15:00 on 3 Dec; arrive after the flight and transfer.\nHotel booked via BOOKING.COM.",
      "day-15": "📍 Chongqing\n🏨 Staying at ARISTON AIRESTON HOTEL — booked via BOOKING.COM.",
      "day-16": "📍 Chongqing\n🏨 Staying at ARISTON AIRESTON HOTEL — booked via BOOKING.COM.",
      "day-17": "📍 Chongqing\n🏨 Staying at ARISTON AIRESTON HOTEL — booked via BOOKING.COM.",
      "day-18": "🏨 Check out of ARISTON AIRESTON HOTEL by 12:00 on Mon 7 Dec 2026.\nHotel booked via BOOKING.COM.\n✈️ Chongqing (CKG) → Shanghai (SHA)\nMon 7 Dec 2026 · 20:10–22:25 (China time)\nBooked via Booking.com."
    };
    for (const [key, notes] of Object.entries(additions)) {
      const existing = typeof trip[key] === "string" ? trip[key].trimEnd() : "";
      trip[key] = existing ? existing + "\n\n" + notes : notes;
    }
    trip._resv = trip._resv || {};
    trip._resv.hotel = trip._resv.hotel || {};
    if (!trip._resv.hotel["chongqing-ariston-20261203"]) {
      trip._resv.hotel["chongqing-ariston-20261203"] = {
        title: "ARISTON AIRESTON HOTEL · booked via BOOKING.COM",
        when: "Chongqing · 3 Dec 2026 after 15:00 → 7 Dec 2026 at 12:00 · 4 nights · China time",
        address: "", code: "", at: 1791158400000
      };
    }
    trip._chongqingBookings20261005 = true;
    return trip;
  }).catch((error) => {
    console.error("Chongqing booking update failed:", error);
    showTripError("couldn't add the Chongqing bookings — refresh to try again");
  });
}

buildDays();
renderCountdown();
addChongqingBookingsOnce();
setInterval(renderCountdown, 60000);

