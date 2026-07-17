firebase.initializeApp(firebaseConfig);
const franceRef = firebase.database().ref("france");

// the plan so far, written into the shared itinerary once, then freely editable
const DEFAULT_PLANS = {
  "2026-08-13": "✈️ lewis lands: CDG terminal 1, free CDGVAL shuttle to terminal 3 / roissypôle\n✈️ khali lands: terminal 2 (2F/2G), CDGVAL to roissypôle, or follow RER B « gare routière » signs\n12:00pm: meet at roissypôle bus station (9517 gare d'argenteuil, RER B)\n2:00pm: check into paris 🏨 hôtel alexandrine opéra, 10 rue de moscou, 75008 (€317, aug 13-16)\nexpedia.com/Paris-Hotels-Alexandrine-Opera.h1382741.Hotel-Information",
  "2026-08-14": "montmartre day 🎨\n12:00-2:00pm: reservation at bouillon pigalle\nmetro 9th → 2nd: pigalle station → madeleine station\n(waiting on zam's recos)",
  "2026-08-15": "bakery run 🥐, bring croissants + drinks for the garden\nmorning: luxembourg garden (9th → 6th: saint-lazare → rennes)\nchez alain miam miam (9th → 11th: europe station → temple station)\nluxembourg garden → eiffel tower: bus 82\nor: walk to CGOTA montigny → beauchamp",
  "2026-08-16": "morning flixbus to lyon 🚌 (~6h, €42)\n4:25pm: arrive in lyon\n5:00pm: check into airbnb 🏠 41 rue seguin, 69002 lyon (€332, aug 16-20)\n(lidl closes 12pm on sundays, grocery run moves to monday)",
  "2026-08-17": "stay at home with baby 🐻",
  "2026-08-18": "parc de la tête d'or 🦁",
  "2026-08-19": "day-trip day, flixbus to annecy (khali's pick, €40, ~1h20)",
  "2026-08-20": "stay at home with baby (tentative)",
  "2026-08-21": "9:00-10:00am: check out of airbnb\n11:26am-12:27pm: train to lyon saint-exupéry (TGV inoui/TER → rhônexpress)\n1:02-3:10pm: train to toulon\ntoulon → cassis: 3:28→4:02 or 3:58→4:32 (⚠️ still to book: lyon→toulon + toulon→cassis, depart ~3:30pm)\nto airbnb: 4:38→4:52 or 5:08→5:22 (bus M371)\ngrocery shopping 🐄",
  "2026-08-24": "cannes fireworks festival 🎆, 10pm\nfestival-pyrotechnique-cannes.com/en/program/august-24-fireworks",
  "2026-08-25": "10:45am-1:30pm: bus to marseille (saint-charles)\n5:04-8:26pm: train to paris gare de lyon\n8:30-9:00pm: RER D vepa: villiers-le-bel - gonesse - arnouville",
};

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

function dayKeyOf(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

function tripDays() {
  const days = [];
  const cursor = new Date(FRANCE_DATE.getFullYear(), FRANCE_DATE.getMonth(), FRANCE_DATE.getDate());
  while (cursor <= FRANCE_END) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function renderCountdown() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntil = Math.round((FRANCE_DATE - today) / MILLISECONDS_PER_DAY);
  if (daysUntil > 1) franceCount.textContent = daysUntil + " days to go";
  else if (daysUntil === 1) franceCount.textContent = "tomorrow!!";
  else if (today <= FRANCE_END) franceCount.textContent = "day " + (1 - daysUntil) + " 🥖";
  else franceCount.textContent = "we'll always have france";
}

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
  tripDays().forEach((date, index) => {
    const key = dayKeyOf(date);

    const item = document.createElement("li");
    item.className = "day-card";
    item.dataset.key = key;

    const head = document.createElement("div");
    head.className = "day-head";

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = "day " + (index + 1);

    const label = document.createElement("span");
    label.className = "day-date";
    label.textContent = date
      .toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      .toLowerCase();

    head.append(number, label);

    const notes = document.createElement("div");
    notes.className = "day-notes";
    notes.contentEditable = "true";
    notes.dataset.placeholder = "nothing planned yet, tap to write";
    notes.setAttribute("role", "textbox");
    notes.setAttribute("aria-label", "plans for " + label.textContent);
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
  if (entry.link) {
    const href = /^https?:\/\//i.test(entry.link) ? entry.link : "https://" + entry.link;
    const link = createExternalLink("resv-link", "📎 open pdf / link", href);
    body.appendChild(link);
  }
  if (entry.code) {
    const code = createTextElement("div", "resv-code", entry.code);
    body.appendChild(code);
  }

  const removeButton = document.createElement("button");
  removeButton.className = "resv-delete";
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "delete reservation");
  removeButton.addEventListener("click", () => {
    resvRef.child(type).child(id).remove().catch((error) => {
      console.error("reservation delete failed:", error);
      showFranceError("couldn't delete that: check your connection");
    });
  });

  item.append(body, removeButton);
  return item;
}

function normalizeReservation(id, entry) {
  if (!entry || typeof entry.title !== "string" || !entry.title.trim()) return null;
  return {
    id,
    title: entry.title.trim(),
    when: entry.when || "",
    address: entry.address || "",
    link: entry.link || "",
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

document.querySelectorAll(".resv-col").forEach((column) => {
  const toggle = column.querySelector(".resv-toggle");
  const cancel = column.querySelector(".resv-cancel");
  const form = column.querySelector(".resv-form");

  toggle.addEventListener("click", () => {
    setReservationFormExpanded(column, toggle.getAttribute("aria-expanded") !== "true");
  });

  cancel.addEventListener("click", () => {
    form.reset();
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
    resvRef
      .child(type)
      .push({
        title,
        when: form.elements.when.value.trim(),
        address: form.elements.address.value.trim(),
        link: form.elements.link.value.trim(),
        code: form.elements.code.value.trim(),
        at: firebase.database.ServerValue.TIMESTAMP,
      })
      .then(() => {
        form.reset();
        setReservationFormExpanded(form.closest(".resv-col"), false);
        showFranceError("");
      })
      .catch((error) => {
        console.error("reservation add failed:", error);
        showFranceError("couldn't add that: check your connection");
      });
  });
});

buildDays();
renderCountdown();
seedDefaultsOnce();
setInterval(renderCountdown, 60 * 1000);
