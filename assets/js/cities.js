const CITY_SEARCH_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const CITY_SEARCH_DELAY = 350;
const cityForm = document.getElementById("city-search-form");
const cityInput = document.getElementById("city-search");
const cityResults = document.getElementById("city-results");
const citySearchStatus = document.getElementById("city-search-status");
const addCityButton = document.getElementById("add-city");
const worldMap = document.getElementById("world-map");
const worldCount = document.getElementById("world-count");
const visitsList = document.getElementById("visits-list");
const visitsEmpty = document.getElementById("visits-empty");
const visitsError = document.getElementById("visits-error");

let visits = [];
let visitsRef = null;
let databaseReady = false;
let selectedCity = null;
let editingVisitId = null;
let searchTimer = null;
let searchRequest = null;
let mapPaths = new Map();

function countryFlag(countryCode) {
  if (!/^[A-Z]{2}$/.test(countryCode)) return "🌍";
  return String.fromCodePoint(...countryCode.split("").map((letter) => 127397 + letter.charCodeAt(0)));
}

function setSearchStatus(message, isError = false) {
  citySearchStatus.textContent = message;
  citySearchStatus.classList.toggle("error", isError);
}

function setVisitsError(message) {
  visitsError.textContent = message;
}

function closeResults() {
  cityResults.hidden = true;
  cityInput.setAttribute("aria-expanded", "false");
}

function openResults() {
  cityResults.hidden = false;
  cityInput.setAttribute("aria-expanded", "true");
}

function updateAddButton() {
  addCityButton.disabled = !selectedCity || !databaseReady;
}

function cityLocationLabel(city) {
  return [city.admin1, city.country].filter(Boolean).join(", ");
}

function chooseCity(city) {
  selectedCity = city;
  cityInput.value = city.name + ", " + city.country;
  closeResults();
  updateAddButton();
  setSearchStatus(countryFlag(city.country_code) + " " + cityLocationLabel(city));
}

function renderSearchResults(results) {
  const cityMatches = results
    .filter((result) => result.country_code && result.country && result.feature_code?.startsWith("P"))
    .slice(0, 7);

  if (cityMatches.length === 0) {
    cityResults.replaceChildren();
    closeResults();
    setSearchStatus("no cities found — try another spelling");
    return;
  }

  const resultItems = cityMatches.map((city, index) => {
    const item = document.createElement("li");
    item.setAttribute("role", "presentation");

    const button = document.createElement("button");
    button.className = "city-result";
    button.type = "button";
    button.id = "city-result-" + index;
    button.setAttribute("role", "option");

    const flag = document.createElement("span");
    flag.className = "city-result-flag";
    flag.textContent = countryFlag(city.country_code);
    flag.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "city-result-copy";
    const name = document.createElement("span");
    name.className = "city-result-name";
    name.textContent = city.name;
    const place = document.createElement("span");
    place.className = "city-result-place";
    place.textContent = cityLocationLabel(city);
    copy.append(name, place);
    button.append(flag, copy);
    button.addEventListener("click", () => chooseCity(city));
    item.appendChild(button);
    return item;
  });

  cityResults.replaceChildren(...resultItems);
  openResults();
  setSearchStatus("choose a city from the list");
}

async function searchCities(query) {
  searchRequest?.abort();
  searchRequest = new AbortController();
  setSearchStatus("looking for cities...");

  const parameters = new URLSearchParams({ name: query, count: "10", language: "en", format: "json" });
  try {
    const response = await fetch(CITY_SEARCH_ENDPOINT + "?" + parameters, { signal: searchRequest.signal });
    if (!response.ok) throw new Error("city search returned " + response.status);
    const data = await response.json();
    renderSearchResults(Array.isArray(data.results) ? data.results : []);
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("city search failed:", error);
    closeResults();
    setSearchStatus("city search is unavailable — check your connection and try again", true);
  }
}

function updateMap() {
  const visitedCountries = new Set(visits.map((visit) => visit.countryCode.toLowerCase()));
  for (const [countryCode, path] of mapPaths) {
    path.classList.toggle("visited", visitedCountries.has(countryCode));
  }
  worldCount.textContent = visits.length + (visits.length === 1 ? " city" : " cities")
    + " · " + visitedCountries.size + (visitedCountries.size === 1 ? " country" : " countries");
}

function normalizeStoredDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return value + "-01";
  return "";
}

function formatVisitDate(value) {
  const normalizedDate = normalizeStoredDate(value);
  if (!normalizedDate) return "";
  const [year, month, day] = normalizedDate.split("-");
  return day + "/" + month + "/" + year;
}

function parseVisitDate(value) {
  if (!value.trim()) return "";
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year)
      || date.getUTCMonth() !== Number(month) - 1
      || date.getUTCDate() !== Number(day)) return null;
  return year + "-" + month + "-" + day;
}

function formatDateInput(event) {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
  event.target.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean)
    .join("/");
}

async function loadWorldMap() {
  try {
    const response = await fetch("assets/data/world.svg");
    if (!response.ok) throw new Error("map returned " + response.status);
    const markup = await response.text();
    const documentResult = new DOMParser().parseFromString(markup, "image/svg+xml");
    if (documentResult.querySelector("parsererror")) throw new Error("map data is invalid");
    const svg = documentResult.documentElement;
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    mapPaths = new Map();
    svg.querySelectorAll("path[id]").forEach((path) => {
      const countryCode = path.id.toLowerCase();
      const name = path.getAttribute("name");
      if (name && !path.querySelector("title")) {
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = name;
        path.prepend(title);
      }
      mapPaths.set(countryCode, path);
    });
    worldMap.replaceChildren(svg);
    updateMap();
  } catch (error) {
    console.error("world map failed to load:", error);
    const message = document.createElement("p");
    message.className = "map-loading";
    message.textContent = "couldn't draw the map — refresh to try again";
    worldMap.replaceChildren(message);
  }
}

async function updateVisitDates(visit, startInput, endInput) {
  const visitFrom = parseVisitDate(startInput.value);
  const visitTo = parseVisitDate(endInput.value);
  startInput.setAttribute("aria-invalid", String(visitFrom === null));
  endInput.setAttribute("aria-invalid", String(visitTo === null));
  if (visitFrom === null || visitTo === null) {
    setVisitsError("use dd/mm/yyyy for visit dates");
    return false;
  }
  if (visitFrom && visitTo && visitFrom > visitTo) {
    setVisitsError("the end of a visit can't be before its start");
    return false;
  }

  try {
    await visitsRef.child(visit.id).update({ visitFrom, visitTo });
    visit.visitFrom = visitFrom;
    visit.visitTo = visitTo;
    setVisitsError("");
    return true;
  } catch (error) {
    console.error("visit dates failed to save:", error);
    setVisitsError("couldn't save those dates — check your connection and try again");
    startInput.value = formatVisitDate(visit.visitFrom);
    endInput.value = formatVisitDate(visit.visitTo);
    return false;
  }
}

function visitDateLabel(visit) {
  const visitFrom = formatVisitDate(visit.visitFrom);
  const visitTo = formatVisitDate(visit.visitTo);
  if (visitFrom && visitTo) return visitFrom === visitTo ? visitFrom : visitFrom + " – " + visitTo;
  if (visitFrom) return "from " + visitFrom;
  if (visitTo) return "until " + visitTo;
  return "dates not added";
}

function createVisitDateEditor(visit) {
  const editor = document.createElement("div");
  editor.className = "visit-date-editor";

  const fields = document.createElement("div");
  fields.className = "visit-date-fields";
  const startInput = document.createElement("input");
  startInput.type = "text";
  startInput.inputMode = "numeric";
  startInput.maxLength = 10;
  startInput.placeholder = "dd/mm/yyyy";
  startInput.autocomplete = "off";
  startInput.value = formatVisitDate(visit.visitFrom);
  startInput.setAttribute("aria-label", visit.city + " visit start");
  const separator = document.createElement("span");
  separator.textContent = "to";
  const endInput = document.createElement("input");
  endInput.type = "text";
  endInput.inputMode = "numeric";
  endInput.maxLength = 10;
  endInput.placeholder = "dd/mm/yyyy";
  endInput.autocomplete = "off";
  endInput.value = formatVisitDate(visit.visitTo);
  endInput.setAttribute("aria-label", visit.city + " visit end");
  startInput.addEventListener("input", formatDateInput);
  endInput.addEventListener("input", formatDateInput);
  fields.append(startInput, separator, endInput);

  const actions = document.createElement("div");
  actions.className = "visit-date-actions";
  const cancelButton = document.createElement("button");
  cancelButton.className = "visit-date-cancel";
  cancelButton.type = "button";
  cancelButton.textContent = "cancel";
  cancelButton.addEventListener("click", () => {
    editingVisitId = null;
    setVisitsError("");
    renderVisits();
  });
  const saveButton = document.createElement("button");
  saveButton.className = "visit-date-save";
  saveButton.type = "button";
  saveButton.textContent = "save";
  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    if (await updateVisitDates(visit, startInput, endInput)) {
      editingVisitId = null;
      renderVisits();
    } else {
      saveButton.disabled = false;
    }
  });
  actions.append(cancelButton, saveButton);
  editor.append(fields, actions);
  return editor;
}

function createVisitItem(visit) {
  const item = document.createElement("li");
  item.className = "visit-item";
  item.dataset.visitId = visit.id;

  const flag = document.createElement("span");
  flag.className = "visit-flag";
  flag.textContent = countryFlag(visit.countryCode);
  flag.setAttribute("aria-hidden", "true");

  const place = document.createElement("div");
  place.className = "visit-place";
  const city = document.createElement("span");
  city.className = "visit-city";
  city.textContent = visit.city;
  const country = document.createElement("span");
  country.className = "visit-country";
  country.textContent = visit.country;
  place.append(city, country);

  const itemActions = document.createElement("div");
  itemActions.className = "visit-actions";
  const editButton = document.createElement("button");
  editButton.className = "visit-edit";
  editButton.type = "button";
  editButton.textContent = "✎";
  editButton.setAttribute("aria-label", "edit visit dates for " + visit.city);
  editButton.addEventListener("click", () => {
    editingVisitId = visit.id;
    setVisitsError("");
    renderVisits();
  });

  const removeButton = document.createElement("button");
  removeButton.className = "visit-delete";
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "remove " + visit.city);
  removeButton.addEventListener("click", async () => {
    if (!window.confirm("remove " + visit.city + " from the map?")) return;
    try {
      if (editingVisitId === visit.id) editingVisitId = null;
      await visitsRef.child(visit.id).remove();
      setVisitsError("");
    } catch (error) {
      console.error("city removal failed:", error);
      setVisitsError("couldn't remove that city — check your connection and try again");
    }
  });
  itemActions.append(editButton, removeButton);

  const dates = editingVisitId === visit.id
    ? createVisitDateEditor(visit)
    : document.createElement("div");
  if (editingVisitId !== visit.id) {
    dates.className = "visit-date-label";
    dates.textContent = visitDateLabel(visit);
  }

  item.append(flag, place, itemActions, dates);
  return item;
}

function renderVisits() {
  visitsList.replaceChildren(...visits.map(createVisitItem));
  visitsEmpty.classList.toggle("hidden", visits.length > 0);
  updateMap();
  visitsList.querySelector(".visit-date-editor input")?.focus();
}

function subscribeToVisits() {
  visitsRef.on("value", (snapshot) => {
    databaseReady = true;
    updateAddButton();
    const value = snapshot.val() || {};
    visits = Object.entries(value)
      .map(([id, visit]) => visit && typeof visit === "object" ? { id, ...visit } : null)
      .filter((visit) => visit && typeof visit.city === "string" && /^[A-Z]{2}$/.test(visit.countryCode))
      .map((visit) => ({
        id: visit.id,
        cityId: String(visit.cityId || ""),
        city: visit.city.trim(),
        country: String(visit.country || "").trim(),
        countryCode: visit.countryCode,
        visitFrom: normalizeStoredDate(visit.visitFrom),
        visitTo: normalizeStoredDate(visit.visitTo),
        createdAt: Number(visit.createdAt) || 0,
      }))
      .sort((first, second) => {
        const firstVisitDate = first.visitTo || first.visitFrom;
        const secondVisitDate = second.visitTo || second.visitFrom;
        if (firstVisitDate && secondVisitDate && firstVisitDate !== secondVisitDate) {
          return secondVisitDate.localeCompare(firstVisitDate);
        }
        if (firstVisitDate !== secondVisitDate) return firstVisitDate ? -1 : 1;
        return second.createdAt - first.createdAt || first.city.localeCompare(second.city);
      });
    renderVisits();
    setVisitsError("");
  }, (error) => {
    databaseReady = false;
    updateAddButton();
    console.error("visited cities subscription failed:", error);
    setVisitsError("Firebase is blocking visitedCities — allow read/write for that path, then refresh");
  });
}

cityInput.addEventListener("input", () => {
  selectedCity = null;
  updateAddButton();
  window.clearTimeout(searchTimer);
  const query = cityInput.value.trim();
  if (query.length < 2) {
    searchRequest?.abort();
    closeResults();
    setSearchStatus(query ? "type at least 2 letters" : "");
    return;
  }
  searchTimer = window.setTimeout(() => searchCities(query), CITY_SEARCH_DELAY);
});

cityInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && !cityResults.hidden) {
    event.preventDefault();
    cityResults.querySelector("button")?.focus();
  } else if (event.key === "Escape") {
    closeResults();
  }
});

cityResults.addEventListener("keydown", (event) => {
  const buttons = [...cityResults.querySelectorAll("button")];
  const activeIndex = buttons.indexOf(document.activeElement);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    buttons[(activeIndex + 1) % buttons.length]?.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (activeIndex <= 0) cityInput.focus();
    else buttons[activeIndex - 1].focus();
  } else if (event.key === "Escape") {
    closeResults();
    cityInput.focus();
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".city-combobox")) closeResults();
});

cityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedCity) {
    setSearchStatus("choose a city from the search results first", true);
    return;
  }
  if (!databaseReady) {
    setSearchStatus("Firebase access is blocked — update the visitedCities rules first", true);
    return;
  }
  if (visits.some((visit) => visit.cityId === String(selectedCity.id))) {
    setSearchStatus(selectedCity.name + " is already on our map", true);
    return;
  }

  addCityButton.disabled = true;
  try {
    await visitsRef.push({
      cityId: String(selectedCity.id),
      city: selectedCity.name,
      country: selectedCity.country,
      countryCode: selectedCity.country_code,
      admin1: selectedCity.admin1 || "",
      latitude: Number(selectedCity.latitude),
      longitude: Number(selectedCity.longitude),
      visitFrom: "",
      visitTo: "",
      addedBy: localStorage.getItem("ily:name") || "unknown",
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    });
    cityInput.value = "";
    selectedCity = null;
    setSearchStatus("city added ✨");
  } catch (error) {
    console.error("city creation failed:", error);
    setSearchStatus("couldn't add that city — check your connection and Firebase rules", true);
  } finally {
    updateAddButton();
  }
});

loadWorldMap();
renderVisits();

if (firebaseConfig.databaseURL) {
  try {
    firebase.initializeApp(firebaseConfig);
    visitsRef = firebase.database().ref("visitedCities");
    subscribeToVisits();
  } catch (error) {
    console.error("firebase initialization failed:", error);
    setVisitsError("couldn't connect to the travel database");
  }
} else {
  setVisitsError("Firebase isn't configured yet");
}

updateAddButton();
