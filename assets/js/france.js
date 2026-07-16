firebase.initializeApp(firebaseConfig);
const franceRef = firebase.database().ref("france");

const daysList = document.getElementById("days");
const franceCount = document.getElementById("france-count");
const franceError = document.getElementById("france-error");
const pendingDaySaves = new Map();
const dayNotes = new Map(); // dayKey -> contentEditable element

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
  const daysUntil = Math.round((FRANCE_DATE - today) / 86400000);
  if (daysUntil > 1) franceCount.textContent = daysUntil + " days to go";
  else if (daysUntil === 1) franceCount.textContent = "tomorrow!!";
  else if (today <= FRANCE_END) franceCount.textContent = "day " + (1 - daysUntil) + " 🥖";
  else franceCount.textContent = "we'll always have france";
}

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
    notes.dataset.placeholder = "nothing planned yet — tap to write";
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
      showFranceError("couldn't save that day — check your connection");
    });
}

// firebase: shared value subscription — both devices plan the same trip, live
franceRef.on("value", (snapshot) => {
  const value = snapshot.val() || {};
  dayNotes.forEach((notesElement, key) => {
    if (document.activeElement === notesElement) return; // don't yank the cursor mid-edit
    const text = typeof value[key] === "string" ? value[key] : "";
    if (notesElement.innerText !== text) notesElement.innerText = text;
  });
}, (error) => {
  console.error("itinerary subscription failed:", error);
  showFranceError("can't reach the itinerary — check the connection (or the firebase rules)");
});

buildDays();
renderCountdown();
setInterval(renderCountdown, 60 * 1000);
