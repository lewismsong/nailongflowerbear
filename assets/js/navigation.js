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
const PIXEL_CAT_SPEED = 22;
const PIXEL_CAT_EDGE = 8;
const PIXEL_CAT_SAVE_INTERVAL = 500;
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
  { name: "sleeping", duration: 5200 },
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

function initializePixelCat() {
  if (document.querySelector(".pixel-cat")) return;

  const cat = document.createElement("button");
  cat.className = "pixel-cat";
  cat.type = "button";
  cat.setAttribute("aria-label", "drag the pixel cat or select it to send some love");
  cat.innerHTML = PIXEL_CAT_MARKUP;
  document.body.appendChild(cat);

  const startedAt = pixelCatStartedAt();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const storedPosition = loadPixelCatPosition();
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

  function persistPosition() {
    savePixelCatPosition({ x, bottom, direction });
    positionChanged = false;
  }

  function positionCat(frameTime) {
    const maximumX = clampPosition();
    const elapsedTime = Date.now() - startedAt;
    const behavior = getPixelCatBehavior(elapsedTime);
    const frameDuration = Math.min(Math.max(frameTime - previousFrameTime, 0), 50) / 1000;
    previousFrameTime = frameTime;

    if (behavior.name === "walking" && activePointerId === null && !reducedMotion.matches) {
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
    if (!reducedMotion.matches) requestAnimationFrame(positionCat);
  }

  function finishDragging(event) {
    if (event.pointerId !== activePointerId) return;
    if (cat.hasPointerCapture(event.pointerId)) cat.releasePointerCapture(event.pointerId);
    activePointerId = null;
    cat.classList.remove("dragging");
    suppressClick = dragged;
    persistPosition();
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
  window.addEventListener("resize", () => {
    clampPosition();
    renderPosition();
    persistPosition();
  });
  window.addEventListener("pagehide", persistPosition);

  clampPosition();
  renderPosition();
  positionCat(performance.now());
}

initializePixelCat();
