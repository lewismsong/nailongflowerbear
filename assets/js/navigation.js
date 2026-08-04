const bearTabs = [
  { id: "home", label: "misses", href: "index.html", icon: "🤍" },
  { id: "todo", label: "our list", href: "todo.html", image: "assets/images/bears.jpg" },
  { id: "coinflip", label: "coinflip", href: "coinflip.html?v=5", image: "assets/images/bear-with-flower.png" },
  { id: "cities", label: "world map", href: "cities.html", image: "assets/images/bears-sitting-lake.png" },
];

function createBearTab(tab, currentTab) {
  const element = tab.href ? document.createElement("a") : document.createElement("button");
  element.className = "bear-tab";

  if (tab.href) element.href = tab.href;
  else {
    element.type = "button";
    element.title = "coming soon";
  }

  if (tab.id === currentTab) {
    element.classList.add("active");
    element.setAttribute("aria-current", "page");
  }

  if (tab.image) {
    const image = document.createElement("img");
    image.className = "bear-tab-image";
    image.src = tab.image;
    image.alt = "";
    element.appendChild(image);
  } else {
    const icon = document.createElement("span");
    icon.className = "bear-tab-icon";
    icon.textContent = tab.icon;
    icon.setAttribute("aria-hidden", "true");
    element.appendChild(icon);
  }

  const label = document.createElement("span");
  label.className = "bear-tab-label";
  label.textContent = tab.label;
  element.appendChild(label);
  return element;
}

class BearTabNavigation extends HTMLElement {
  connectedCallback() {
    if (this.firstChild) return;

    const navigation = document.createElement("nav");
    navigation.className = "bear-tab-bar";
    navigation.setAttribute("aria-label", "main navigation");
    const currentTab = this.getAttribute("current");

    for (const tab of bearTabs) navigation.appendChild(createBearTab(tab, currentTab));

    const brand = document.createElement("p");
    brand.className = "trademark bear-tab-brand";
    brand.textContent = "lewiskhalico™";
    this.append(navigation, brand);
  }
}

customElements.define("bear-tab-nav", BearTabNavigation);

const PIXEL_CAT_START_KEY = "ily:pixelCatStartedAt";
const PIXEL_CAT_POSITION_KEY = "ily:pixelCatPosition";
const PIXEL_HOUSE_POSITION_KEY = "ily:pixelHousePosition";
const PIXEL_CAT_SLEEP_KEY = "ily:pixelCatSleep";
const PIXEL_CAT_SPEED = 22;
const PIXEL_CAT_HOME_SPEED = 72;
const PIXEL_CAT_EDGE = 8;
const PIXEL_CAT_SAVE_INTERVAL = 500;
const PIXEL_CAT_MIN_SLEEP_DELAY = 30000;
const PIXEL_CAT_MAX_SLEEP_DELAY = 90000;
const PIXEL_CAT_MIN_SLEEP_DURATION = 16000;
const PIXEL_CAT_MAX_SLEEP_DURATION = 32000;
const PIXEL_HEART_COLORS = ["#E86A85", "#FF8FA5", "#FFC94D"];
const PIXEL_CAT_BEHAVIORS = [
  { name: "walking", duration: 7000 },
  { name: "idle", duration: 3200 },
  { name: "walking", duration: 5400 },
  { name: "sitting", duration: 4800 },
  { name: "rolling", duration: 3600 },
  { name: "idle", duration: 1800 },
  { name: "walking", duration: 8400 },
  { name: "playing", duration: 3000 },
  { name: "idle", duration: 5200 },
];
const PIXEL_CAT_CYCLE_DURATION = PIXEL_CAT_BEHAVIORS.reduce(
  (total, behavior) => total + behavior.duration,
  0,
);
const PIXEL_CAT_WALKING_DURATION = PIXEL_CAT_BEHAVIORS.reduce(
  (total, behavior) => total + (behavior.name === "walking" ? behavior.duration : 0),
  0,
);
const PIXEL_CAT_MARKUP = `
  <span class="pixel-cat-direction" aria-hidden="true">
    <span class="pixel-cat-sprite"></span>
  </span>`;
const PIXEL_HOUSE_MARKUP = `
  <span class="pixel-house-zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></span>
  <img class="pixel-house-image" src="assets/images/cat-house.png" alt="" draggable="false" />`;
const PIXEL_HEART_MARKUP = `
  <svg viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true">
    <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" />
  </svg>`;

function pixelCatStartedAt() {
  try {
    const storedValue = Number(localStorage.getItem(PIXEL_CAT_START_KEY));
    if (Number.isFinite(storedValue) && storedValue > 0) return storedValue;
    const startedAt = Date.now();
    localStorage.setItem(PIXEL_CAT_START_KEY, String(startedAt));
    return startedAt;
  } catch (error) {
    console.warn("pixel cat position persistence is unavailable:", error);
    return Date.now();
  }
}

function loadPixelCatPosition() {
  try {
    const storedPosition = JSON.parse(localStorage.getItem(PIXEL_CAT_POSITION_KEY));
    if (!Number.isFinite(storedPosition?.x) || !Number.isFinite(storedPosition?.bottom)) return null;
    return {
      x: storedPosition.x,
      bottom: storedPosition.bottom,
      direction: storedPosition.direction === -1 ? -1 : 1,
    };
  } catch (error) {
    console.warn("pixel cat position could not be loaded:", error);
    return null;
  }
}

function savePixelCatPosition(position) {
  try {
    localStorage.setItem(PIXEL_CAT_POSITION_KEY, JSON.stringify(position));
  } catch (error) {
    console.warn("pixel cat position could not be saved:", error);
  }
}

function loadPixelHousePosition() {
  try {
    const storedPosition = JSON.parse(localStorage.getItem(PIXEL_HOUSE_POSITION_KEY));
    if (!Number.isFinite(storedPosition?.x) || !Number.isFinite(storedPosition?.bottom)) return null;
    return { x: storedPosition.x, bottom: storedPosition.bottom };
  } catch (error) {
    console.warn("pixel house position could not be loaded:", error);
    return null;
  }
}

function savePixelHousePosition(position) {
  try {
    localStorage.setItem(PIXEL_HOUSE_POSITION_KEY, JSON.stringify(position));
  } catch (error) {
    console.warn("pixel house position could not be saved:", error);
  }
}

function loadPixelCatSleep() {
  try {
    const storedSleep = JSON.parse(localStorage.getItem(PIXEL_CAT_SLEEP_KEY));
    return {
      nextSleepAt: Number.isFinite(storedSleep?.nextSleepAt) ? storedSleep.nextSleepAt : 0,
      sleepUntil: Number.isFinite(storedSleep?.sleepUntil) ? storedSleep.sleepUntil : 0,
    };
  } catch (error) {
    console.warn("pixel cat sleep state could not be loaded:", error);
    return { nextSleepAt: 0, sleepUntil: 0 };
  }
}

function savePixelCatSleep(sleepState) {
  try {
    localStorage.setItem(PIXEL_CAT_SLEEP_KEY, JSON.stringify(sleepState));
  } catch (error) {
    console.warn("pixel cat sleep state could not be saved:", error);
  }
}

function randomDuration(minimum, maximum) {
  return Math.round(minimum + Math.random() * (maximum - minimum));
}

function getPixelCatBehavior(elapsedTime) {
  const completedCycles = Math.floor(elapsedTime / PIXEL_CAT_CYCLE_DURATION);
  let cycleTime = elapsedTime % PIXEL_CAT_CYCLE_DURATION;
  let totalWalkingTime = completedCycles * PIXEL_CAT_WALKING_DURATION;

  for (const behavior of PIXEL_CAT_BEHAVIORS) {
    if (cycleTime <= behavior.duration) {
      if (behavior.name === "walking") totalWalkingTime += cycleTime;
      return { name: behavior.name, walkingTime: totalWalkingTime };
    }

    if (behavior.name === "walking") totalWalkingTime += behavior.duration;
    cycleTime -= behavior.duration;
  }

  return { name: "idle", walkingTime: totalWalkingTime };
}

function releasePixelHearts(cat) {
  const catBounds = cat.getBoundingClientRect();
  const centerX = catBounds.left + catBounds.width / 2;
  const top = catBounds.top + 8;

  for (let index = 0; index < 7; index++) {
    const heart = document.createElement("span");
    heart.className = "pixel-cat-heart";
    heart.innerHTML = PIXEL_HEART_MARKUP;
    heart.style.left = centerX + "px";
    heart.style.top = top + "px";
    heart.style.setProperty("--heart-color", PIXEL_HEART_COLORS[index % PIXEL_HEART_COLORS.length]);
    heart.style.setProperty("--heart-drift", ((index - 3) * 12 + (Math.random() - 0.5) * 10) + "px");
    heart.style.setProperty("--heart-delay", index * 0.045 + "s");
    document.body.appendChild(heart);
    heart.addEventListener("animationend", () => heart.remove(), { once: true });
    setTimeout(() => heart.remove(), 2200);
  }

  cat.classList.remove("loved");
  requestAnimationFrame(() => cat.classList.add("loved"));
  setTimeout(() => cat.classList.remove("loved"), 550);
}

function initializePixelCompanions() {
  if (document.querySelector(".pixel-cat, .pixel-house")) return;

  const house = document.createElement("button");
  house.className = "pixel-house";
  house.type = "button";
  house.setAttribute("aria-label", "drag the pixel house or select it to make it shake");
  house.innerHTML = PIXEL_HOUSE_MARKUP;

  const cat = document.createElement("button");
  cat.className = "pixel-cat";
  cat.type = "button";
  cat.setAttribute("aria-label", "drag the pixel cat or select it to send some love");
  cat.innerHTML = PIXEL_CAT_MARKUP;
  document.body.append(house, cat);

  const startedAt = pixelCatStartedAt();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const storedPosition = loadPixelCatPosition();
  const storedHousePosition = loadPixelHousePosition();
  const storedSleep = loadPixelCatSleep();
  const initialBehavior = getPixelCatBehavior(Date.now() - startedAt);
  const initialMaximumX = Math.max(PIXEL_CAT_EDGE, window.innerWidth - cat.offsetWidth - PIXEL_CAT_EDGE);
  const initialTravelWidth = initialMaximumX - PIXEL_CAT_EDGE;
  const initialCycleWidth = initialTravelWidth * 2;
  const initialDistance = (initialBehavior.walkingTime / 1000) * PIXEL_CAT_SPEED;
  const initialCyclePosition = initialCycleWidth > 0 ? initialDistance % initialCycleWidth : 0;
  let direction = storedPosition?.direction ?? (initialCyclePosition <= initialTravelWidth ? 1 : -1);
  let x = storedPosition?.x ?? (direction === 1
    ? PIXEL_CAT_EDGE + initialCyclePosition
    : initialMaximumX - (initialCyclePosition - initialTravelWidth));
  let bottom = storedPosition?.bottom ?? PIXEL_CAT_EDGE;
  let houseX = storedHousePosition?.x
    ?? Math.max(PIXEL_CAT_EDGE, window.innerWidth - house.offsetWidth - 18);
  let houseBottom = storedHousePosition?.bottom ?? PIXEL_CAT_EDGE;
  let sleepState = storedSleep.sleepUntil > Date.now() ? "sleeping" : "awake";
  let sleepUntil = sleepState === "sleeping" ? storedSleep.sleepUntil : 0;
  let nextSleepAt = storedSleep.nextSleepAt > Date.now()
    ? storedSleep.nextSleepAt
    : Date.now() + randomDuration(PIXEL_CAT_MIN_SLEEP_DELAY, PIXEL_CAT_MAX_SLEEP_DELAY);
  let wakeTapCount = 0;
  let previousBehavior = "";
  let previousFrameTime = performance.now();
  let lastSavedAt = 0;
  let positionChanged = true;
  let activePointerId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragged = false;
  let suppressClick = false;
  let housePointerId = null;
  let houseDragOffsetX = 0;
  let houseDragOffsetY = 0;
  let houseDragStartX = 0;
  let houseDragStartY = 0;
  let houseDragged = false;
  let suppressHouseClick = false;

  function clampPosition() {
    const previousX = x;
    const previousBottom = bottom;
    const maximumX = Math.max(PIXEL_CAT_EDGE, window.innerWidth - cat.offsetWidth - PIXEL_CAT_EDGE);
    const maximumBottom = Math.max(PIXEL_CAT_EDGE, window.innerHeight - cat.offsetHeight - PIXEL_CAT_EDGE);
    x = Math.min(Math.max(x, PIXEL_CAT_EDGE), maximumX);
    bottom = Math.min(Math.max(bottom, PIXEL_CAT_EDGE), maximumBottom);
    positionChanged ||= x !== previousX || bottom !== previousBottom;
    return maximumX;
  }

  function renderPosition() {
    cat.style.left = x + "px";
    cat.style.bottom = bottom + "px";
    cat.style.setProperty("--cat-direction", String(direction));
  }

  function clampHousePosition() {
    const maximumX = Math.max(PIXEL_CAT_EDGE, window.innerWidth - house.offsetWidth - PIXEL_CAT_EDGE);
    const maximumBottom = Math.max(PIXEL_CAT_EDGE, window.innerHeight - house.offsetHeight - PIXEL_CAT_EDGE);
    houseX = Math.min(Math.max(houseX, PIXEL_CAT_EDGE), maximumX);
    houseBottom = Math.min(Math.max(houseBottom, PIXEL_CAT_EDGE), maximumBottom);
  }

  function renderHousePosition() {
    house.style.left = houseX + "px";
    house.style.bottom = houseBottom + "px";
  }

  function persistHousePosition() {
    savePixelHousePosition({ x: houseX, bottom: houseBottom });
  }

  function persistPosition() {
    savePixelCatPosition({ x, bottom, direction });
    positionChanged = false;
  }

  function scheduleNextSleep() {
    sleepState = "awake";
    sleepUntil = 0;
    nextSleepAt = Date.now() + randomDuration(PIXEL_CAT_MIN_SLEEP_DELAY, PIXEL_CAT_MAX_SLEEP_DELAY);
    savePixelCatSleep({ nextSleepAt, sleepUntil: 0 });
  }

  function enterHouse() {
    sleepState = "sleeping";
    sleepUntil = Date.now() + randomDuration(PIXEL_CAT_MIN_SLEEP_DURATION, PIXEL_CAT_MAX_SLEEP_DURATION);
    wakeTapCount = 0;
    cat.classList.add("in-house");
    house.classList.add("sleeping");
    house.setAttribute("aria-label", "the pixel cat is sleeping; select the house twice to wake it or drag the house");
    savePixelCatSleep({ nextSleepAt: 0, sleepUntil });
  }

  function wakeCat() {
    if (sleepState !== "sleeping") return;
    house.classList.remove("sleeping");
    cat.classList.remove("in-house");
    house.setAttribute("aria-label", "drag the pixel house or select it to make it shake");
    wakeTapCount = 0;
    x = houseX + house.offsetWidth * 0.72 - cat.offsetWidth / 2;
    bottom = houseBottom;
    direction = 1;
    positionChanged = true;
    clampPosition();
    renderPosition();
    persistPosition();
    scheduleNextSleep();
  }

  function shakeHouse() {
    house.classList.remove("shaking");
    requestAnimationFrame(() => house.classList.add("shaking"));
  }

  function isCatOverHouse() {
    const catBounds = cat.getBoundingClientRect();
    const houseBounds = house.getBoundingClientRect();
    const catCenterX = catBounds.left + catBounds.width / 2;
    const catCenterY = catBounds.top + catBounds.height / 2;
    return catCenterX >= houseBounds.left
      && catCenterX <= houseBounds.right
      && catCenterY >= houseBounds.top
      && catCenterY <= houseBounds.bottom;
  }

  function positionCat(frameTime) {
    const maximumX = clampPosition();
    const now = Date.now();
    const elapsedTime = now - startedAt;
    let behavior = getPixelCatBehavior(elapsedTime);
    const frameDuration = Math.min(Math.max(frameTime - previousFrameTime, 0), 50) / 1000;
    previousFrameTime = frameTime;

    if (sleepState === "awake" && now >= nextSleepAt && activePointerId === null) {
      sleepState = "going-home";
      wakeTapCount = 0;
    }

    if (sleepState === "sleeping") {
      if (now >= sleepUntil) wakeCat();
    } else if (sleepState === "going-home" && activePointerId === null) {
      behavior = { name: "walking" };
      const targetX = houseX + house.offsetWidth * 0.72 - cat.offsetWidth / 2;
      const targetBottom = houseBottom;
      const deltaX = targetX - x;
      const deltaBottom = targetBottom - bottom;
      const distance = Math.hypot(deltaX, deltaBottom);
      if (distance <= 3 || reducedMotion.matches) {
        x = targetX;
        bottom = targetBottom;
        enterHouse();
      } else {
        const travel = Math.min(distance, PIXEL_CAT_HOME_SPEED * frameDuration);
        x += deltaX / distance * travel;
        bottom += deltaBottom / distance * travel;
        if (Math.abs(deltaX) > 1) direction = deltaX > 0 ? 1 : -1;
        positionChanged = true;
      }
    } else if (behavior.name === "walking" && activePointerId === null && !reducedMotion.matches) {
      x += direction * PIXEL_CAT_SPEED * frameDuration;
      positionChanged = true;
      if (x >= maximumX) {
        x = maximumX;
        direction = -1;
      } else if (x <= PIXEL_CAT_EDGE) {
        x = PIXEL_CAT_EDGE;
        direction = 1;
      }
    }

    renderPosition();
    if (behavior.name !== previousBehavior) {
      cat.dataset.behavior = behavior.name;
      previousBehavior = behavior.name;
    }
    if (positionChanged && frameTime - lastSavedAt >= PIXEL_CAT_SAVE_INTERVAL) {
      persistPosition();
      lastSavedAt = frameTime;
    }
    requestAnimationFrame(positionCat);
  }

  function finishDragging(event) {
    if (event.pointerId !== activePointerId) return;
    const droppedOnHouse = event.type === "pointerup" && isCatOverHouse();
    if (cat.hasPointerCapture(event.pointerId)) cat.releasePointerCapture(event.pointerId);
    activePointerId = null;
    cat.classList.remove("dragging");
    suppressClick = dragged || droppedOnHouse;
    setTimeout(() => { suppressClick = false; }, 0);
    persistPosition();
    if (droppedOnHouse) enterHouse();
  }

  cat.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const bounds = cat.getBoundingClientRect();
    activePointerId = event.pointerId;
    dragOffsetX = event.clientX - bounds.left;
    dragOffsetY = event.clientY - bounds.top;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragged = false;
    if (sleepState === "going-home") scheduleNextSleep();
    cat.classList.add("dragging");
    cat.setPointerCapture(event.pointerId);
  });

  cat.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    x = event.clientX - dragOffsetX;
    bottom = window.innerHeight - (event.clientY - dragOffsetY) - cat.offsetHeight;
    positionChanged = true;
    dragged ||= Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) > 4;
    clampPosition();
    renderPosition();
    event.preventDefault();
  });

  cat.addEventListener("pointerup", finishDragging);
  cat.addEventListener("pointercancel", finishDragging);
  cat.addEventListener("click", () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    releasePixelHearts(cat);
  });

  function finishHouseDragging(event) {
    if (event.pointerId !== housePointerId) return;
    if (house.hasPointerCapture(event.pointerId)) house.releasePointerCapture(event.pointerId);
    housePointerId = null;
    house.classList.remove("dragging");
    suppressHouseClick = houseDragged;
    persistHousePosition();
  }

  house.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const bounds = house.getBoundingClientRect();
    housePointerId = event.pointerId;
    houseDragOffsetX = event.clientX - bounds.left;
    houseDragOffsetY = event.clientY - bounds.top;
    houseDragStartX = event.clientX;
    houseDragStartY = event.clientY;
    houseDragged = false;
    house.classList.add("dragging");
    house.setPointerCapture(event.pointerId);
  });

  house.addEventListener("pointermove", (event) => {
    if (event.pointerId !== housePointerId) return;
    houseX = event.clientX - houseDragOffsetX;
    houseBottom = window.innerHeight - (event.clientY - houseDragOffsetY) - house.offsetHeight;
    houseDragged ||= Math.hypot(event.clientX - houseDragStartX, event.clientY - houseDragStartY) > 4;
    clampHousePosition();
    renderHousePosition();
    event.preventDefault();
  });

  house.addEventListener("pointerup", finishHouseDragging);
  house.addEventListener("pointercancel", finishHouseDragging);
  house.addEventListener("animationend", (event) => {
    if (event.animationName === "pixelHouseShake") house.classList.remove("shaking");
  });
  house.addEventListener("click", () => {
    if (suppressHouseClick) {
      suppressHouseClick = false;
      return;
    }
    shakeHouse();
    if (sleepState !== "sleeping") return;
    wakeTapCount++;
    if (wakeTapCount === 2) setTimeout(wakeCat, 180);
  });
  window.addEventListener("resize", () => {
    clampPosition();
    clampHousePosition();
    renderPosition();
    renderHousePosition();
    persistPosition();
    persistHousePosition();
  });
  window.addEventListener("pagehide", () => {
    persistPosition();
    persistHousePosition();
  });

  clampHousePosition();
  clampPosition();
  renderHousePosition();
  renderPosition();
  if (sleepState === "sleeping") {
    cat.classList.add("in-house");
    house.classList.add("sleeping");
    house.setAttribute("aria-label", "the pixel cat is sleeping; select the house twice to wake it or drag the house");
  } else {
    savePixelCatSleep({ nextSleepAt, sleepUntil: 0 });
  }
  positionCat(performance.now());
}

initializePixelCompanions();
