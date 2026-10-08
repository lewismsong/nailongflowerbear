function initializeTripTextField(element, reference, showError, { fallback = "", trimEnd = false } = {}) {
  const SAVE_DELAY_MS = 400;
  const normalize = (text) => trimEnd ? text.replace(/\u00a0/g, " ").trimEnd() : text.replace(/\u00a0/g, " ").trim();
  let savedText = normalize(element.innerText);
  let remoteText = savedText;
  let dirty = false;
  let timer = null;
  let pendingText = null;
  let saveVersion = 0;

  function save() {
    clearTimeout(timer);
    timer = null;
    if (!dirty) {
      if (element.innerText !== remoteText) element.innerText = remoteText;
      return;
    }
    const text = normalize(element.innerText);
    if (text === pendingText) return;
    if (pendingText === null && text === savedText) {
      dirty = false;
      return;
    }
    pendingText = text;
    const version = ++saveVersion;
    const write = text.trim() ? reference.set(text) : reference.remove();
    write.then(() => {
      if (version !== saveVersion) return;
      pendingText = null;
      savedText = text;
      dirty = normalize(element.innerText) !== text;
      showError("");
    }).catch((error) => {
      if (version === saveVersion) pendingText = null;
      console.error("trip text save failed:", error);
      showError("couldn't save the trip text, check your connection");
    });
  }

  element.addEventListener("input", () => {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  });
  element.addEventListener("blur", save);
  reference.on("value", (snapshot) => {
    const value = snapshot.val();
    remoteText = typeof value === "string" && value.trim() ? normalize(value) : fallback;
    // preserve unsaved edits and the cursor while receiving remote changes.
    if (dirty || document.activeElement === element) return;
    savedText = remoteText;
    if (element.innerText !== remoteText) element.innerText = remoteText;
  }, (error) => {
    console.error("trip text subscription failed:", error);
    showError("can't reach the itinerary, check your connection and Firebase rules");
  });
}

function initializeTripDates(reference, showError, fallback = "") {
  const element = document.getElementById("trip-dates");
  initializeTripTextField(element, reference.child("_dates"), showError, { fallback });
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    element.blur();
  });
}

function initializeTripItinerary(reference, days, showError, placeholder = "ideas for this day, tap to write") {
  const list = document.getElementById("days");
  const toggle = document.getElementById("itinerary-toggle");
  const toggleLabel = document.getElementById("itinerary-toggle-label");
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") !== "true";
    list.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggleLabel.textContent = expanded ? "collapse" : "show itinerary";
  });

  const fragment = document.createDocumentFragment();
  days.forEach(({ key, label = "" }, index) => {
    const item = document.createElement("li");
    item.className = "day-card";
    item.dataset.key = key;
    const head = document.createElement("div");
    head.className = "day-head";
    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = "day " + (index + 1);
    head.append(number);
    if (label) {
      const date = document.createElement("span");
      date.className = "day-date";
      date.textContent = label;
      head.append(date);
    }
    const notes = document.createElement("div");
    notes.className = "day-notes";
    notes.contentEditable = "true";
    notes.dataset.placeholder = placeholder;
    notes.setAttribute("role", "textbox");
    notes.setAttribute("aria-label", "plans for " + (label || "day " + (index + 1)));
    notes.setAttribute("spellcheck", "true");
    item.append(head, notes);
    fragment.append(item);
    initializeTripTextField(notes, reference.child(key), showError, { trimEnd: true });
  });
  list.replaceChildren(fragment);
}
