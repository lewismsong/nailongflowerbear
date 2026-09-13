(() => {
  "use strict";

  const STORAGE_KEYS = {
    catStartedAt: "ily:pixelCatStartedAt",
    catPosition: "ily:pixelCatPosition",
    housePosition: "ily:pixelHousePosition",
    catSleep: "ily:pixelCatSleep",
  };
  const EDGE = 8;
  const CAT_SPEED = 22;
  const CAT_HOME_SPEED = 72;
  const SAVE_INTERVAL = 500;
  const SLEEP_DELAY = { minimum: 30000, maximum: 90000 };
  const SLEEP_DURATION = { minimum: 16000, maximum: 32000 };
  const HEART_COLORS = ["#E86A85", "#FF8FA5", "#FFC94D"];
  const CAT_BEHAVIORS = [
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
  const CAT_CYCLE_DURATION = CAT_BEHAVIORS.reduce((total, behavior) => total + behavior.duration, 0);
  const CAT_WALKING_DURATION = CAT_BEHAVIORS.reduce(
    (total, behavior) => total + (behavior.name === "walking" ? behavior.duration : 0),
    0,
  );
  const CAT_MARKUP = `
    <span class="pixel-cat-direction" aria-hidden="true">
      <span class="pixel-cat-sprite"></span>
    </span>`;
  const HOUSE_MARKUP = `
    <span class="pixel-house-zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></span>
    <img class="pixel-house-image" src="assets/images/temple.png" alt="" draggable="false" />`;
  const HEART_MARKUP = `
    <svg viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true">
      <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" />
    </svg>`;

  function readStoredPosition(key) {
    const position = appStorage.getJson(key);
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.bottom)) return null;
    return position;
  }

  function pixelCatStartedAt() {
    const storedValue = Number(appStorage.get(STORAGE_KEYS.catStartedAt));
    if (Number.isFinite(storedValue) && storedValue > 0) return storedValue;
    const startedAt = Date.now();
    appStorage.set(STORAGE_KEYS.catStartedAt, startedAt);
    return startedAt;
  }

  function randomDuration({ minimum, maximum }) {
    return Math.round(minimum + Math.random() * (maximum - minimum));
  }

  function getPixelCatBehavior(elapsedTime) {
    const completedCycles = Math.floor(elapsedTime / CAT_CYCLE_DURATION);
    let cycleTime = elapsedTime % CAT_CYCLE_DURATION;
    let walkingTime = completedCycles * CAT_WALKING_DURATION;

    for (const behavior of CAT_BEHAVIORS) {
      if (cycleTime <= behavior.duration) {
        if (behavior.name === "walking") walkingTime += cycleTime;
        return { name: behavior.name, walkingTime };
      }
      if (behavior.name === "walking") walkingTime += behavior.duration;
      cycleTime -= behavior.duration;
    }

    return { name: "idle", walkingTime };
  }

  function createButton(className, label, markup) {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.innerHTML = markup;
    return button;
  }

  function releasePixelHearts(cat) {
    const catBounds = cat.getBoundingClientRect();
    const centerX = catBounds.left + catBounds.width / 2;
    const top = catBounds.top + 8;

    for (let index = 0; index < 7; index++) {
      const heart = document.createElement("span");
      heart.className = "pixel-cat-heart";
      heart.innerHTML = HEART_MARKUP;
      heart.style.left = centerX + "px";
      heart.style.top = top + "px";
      heart.style.setProperty("--heart-color", HEART_COLORS[index % HEART_COLORS.length]);
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

  class PersistentDraggable {
    constructor(element, options) {
      this.element = element;
      this.storageKey = options.storageKey;
      this.edge = options.edge ?? EDGE;
      this.getExtraState = options.getExtraState ?? (() => ({}));
      this.onDragStart = options.onDragStart ?? (() => {});
      this.onDrop = options.onDrop ?? (() => false);
      this.onCancel = options.onCancel ?? (() => {});

      const storedPosition = options.storedPosition ?? readStoredPosition(this.storageKey);
      this.x = storedPosition?.x ?? options.initialPosition.x;
      this.bottom = storedPosition?.bottom ?? options.initialPosition.bottom;
      this.activePointerId = null;
      this.dragged = false;
      this.suppressClick = false;
      this.dirty = true;
      this.attachPointerEvents();
    }

    get isDragging() {
      return this.activePointerId !== null;
    }

    clamp() {
      const maximumX = Math.max(this.edge, window.innerWidth - this.element.offsetWidth - this.edge);
      const maximumBottom = Math.max(this.edge, window.innerHeight - this.element.offsetHeight - this.edge);
      const clampedX = Math.min(Math.max(this.x, this.edge), maximumX);
      const clampedBottom = Math.min(Math.max(this.bottom, this.edge), maximumBottom);
      this.dirty ||= clampedX !== this.x || clampedBottom !== this.bottom;
      this.x = clampedX;
      this.bottom = clampedBottom;
      return maximumX;
    }

    setPosition(x, bottom) {
      this.x = x;
      this.bottom = bottom;
      this.dirty = true;
      this.clamp();
      this.render();
    }

    render() {
      this.element.style.left = this.x + "px";
      this.element.style.bottom = this.bottom + "px";
    }

    save() {
      appStorage.setJson(this.storageKey, { x: this.x, bottom: this.bottom, ...this.getExtraState() });
      this.dirty = false;
    }

    consumeSuppressedClick() {
      if (!this.suppressClick) return false;
      this.suppressClick = false;
      return true;
    }

    attachPointerEvents() {
      this.element.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        const bounds = this.element.getBoundingClientRect();
        this.activePointerId = event.pointerId;
        this.dragOffsetX = event.clientX - bounds.left;
        this.dragOffsetY = event.clientY - bounds.top;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
        this.dragged = false;
        this.element.classList.add("dragging");
        this.element.setPointerCapture(event.pointerId);
        this.onDragStart();
      });

      this.element.addEventListener("pointermove", (event) => {
        if (event.pointerId !== this.activePointerId) return;
        this.x = event.clientX - this.dragOffsetX;
        this.bottom = window.innerHeight - (event.clientY - this.dragOffsetY) - this.element.offsetHeight;
        this.dragged ||= Math.hypot(event.clientX - this.dragStartX, event.clientY - this.dragStartY) > 4;
        this.dirty = true;
        this.clamp();
        this.render();
        event.preventDefault();
      });

      const finishDragging = (event) => {
        if (event.pointerId !== this.activePointerId) return;
        if (this.element.hasPointerCapture(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
        this.activePointerId = null;
        if (event.type === "pointercancel") this.onCancel();
        this.element.classList.remove("dragging");
        const acceptedDrop = event.type === "pointerup" && Boolean(this.onDrop());
        this.suppressClick = this.dragged || acceptedDrop;
        setTimeout(() => { this.suppressClick = false; }, 0);
        this.save();
      };

      this.element.addEventListener("pointerup", finishDragging);
      this.element.addEventListener("pointercancel", finishDragging);
    }
  }

  class PixelCompanions {
    constructor() {
      this.house = createButton("pixel-house", "drag the pixel temple or select it to make it shake", HOUSE_MARKUP);
      this.cat = createButton("pixel-cat", "drag Pakku or select him to send some love", CAT_MARKUP);
      document.body.append(this.house, this.cat);

      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.startedAt = pixelCatStartedAt();
      this.storedCatPosition = readStoredPosition(STORAGE_KEYS.catPosition);
      this.initialCatState = this.calculateInitialCatState();
      this.direction = this.storedCatPosition
        ? (this.storedCatPosition.direction === -1 ? -1 : 1)
        : this.initialCatState.direction;
      this.sleepState = "awake";
      this.sleepUntil = 0;
      this.nextSleepAt = 0;
      this.wakeTapCount = 0;
      this.previousBehavior = "";
      this.previousFrameTime = performance.now();
      this.lastSavedAt = 0;

      this.createDraggables();
      this.restoreSleepState();
      this.attachEvents();
      this.clampAndRender();
      this.sandbox = window.PakkuSandbox ? new window.PakkuSandbox(this) : null;
      this.parkedInSandbox = !this.sandbox && appStorage.getJson("ily:pakkuSandbox", {}).inside === true;
      this.cat.hidden = this.parkedInSandbox;
      requestAnimationFrame((frameTime) => this.update(frameTime));
    }

    calculateInitialCatState() {
      const behavior = getPixelCatBehavior(Date.now() - this.startedAt);
      const maximumX = Math.max(EDGE, window.innerWidth - this.cat.offsetWidth - EDGE);
      const travelWidth = maximumX - EDGE;
      const cycleWidth = travelWidth * 2;
      const distance = (behavior.walkingTime / 1000) * CAT_SPEED;
      const cyclePosition = cycleWidth > 0 ? distance % cycleWidth : 0;
      return cyclePosition <= travelWidth
        ? { x: EDGE + cyclePosition, bottom: EDGE, direction: 1 }
        : { x: maximumX - (cyclePosition - travelWidth), bottom: EDGE, direction: -1 };
    }

    createDraggables() {
      this.catDrag = new PersistentDraggable(this.cat, {
        storageKey: STORAGE_KEYS.catPosition,
        storedPosition: this.storedCatPosition,
        initialPosition: this.initialCatState,
        getExtraState: () => ({ direction: this.direction }),
        onDragStart: () => {
          this.sandbox?.beginDrag();
          if (this.sleepState === "going-home") this.scheduleNextSleep();
        },
        onCancel: () => this.sandbox?.cancelDrag(),
        onDrop: () => {
          if (this.sandbox && this.catDrag.dragged && this.sandbox.drop()) return true;
          if (!this.isCatOverHouse()) return false;
          this.enterHouse();
          return true;
        },
      });

      this.houseDrag = new PersistentDraggable(this.house, {
        storageKey: STORAGE_KEYS.housePosition,
        initialPosition: {
          x: Math.max(EDGE, window.innerWidth - this.house.offsetWidth - 18),
          bottom: EDGE,
        },
      });
    }

    restoreSleepState() {
      const storedSleep = appStorage.getJson(STORAGE_KEYS.catSleep, {});
      const now = Date.now();
      if (Number.isFinite(storedSleep.sleepUntil) && storedSleep.sleepUntil > now) {
        this.sleepState = "sleeping";
        this.sleepUntil = storedSleep.sleepUntil;
        this.setSleepingAppearance(true);
        return;
      }
      this.nextSleepAt = Number.isFinite(storedSleep.nextSleepAt) && storedSleep.nextSleepAt > now
        ? storedSleep.nextSleepAt
        : now + randomDuration(SLEEP_DELAY);
      this.saveSleepState();
    }

    saveSleepState() {
      appStorage.setJson(STORAGE_KEYS.catSleep, {
        nextSleepAt: this.sleepState === "awake" ? this.nextSleepAt : 0,
        sleepUntil: this.sleepState === "sleeping" ? this.sleepUntil : 0,
      });
    }

    scheduleNextSleep() {
      this.sleepState = "awake";
      this.sleepUntil = 0;
      this.nextSleepAt = Date.now() + randomDuration(SLEEP_DELAY);
      this.saveSleepState();
    }

    setSleepingAppearance(sleeping) {
      this.cat.classList.toggle("in-house", sleeping);
      this.house.classList.toggle("sleeping", sleeping);
      this.house.setAttribute(
        "aria-label",
        sleeping
          ? "Pakku is sleeping; select the temple twice to wake him or drag the temple"
          : "drag the pixel temple or select it to make it shake",
      );
    }

    enterHouse() {
      this.sleepState = "sleeping";
      this.sleepUntil = Date.now() + randomDuration(SLEEP_DURATION);
      this.wakeTapCount = 0;
      this.setSleepingAppearance(true);
      this.saveSleepState();
    }

    wakeCat() {
      if (this.sleepState !== "sleeping") return;
      this.setSleepingAppearance(false);
      this.wakeTapCount = 0;
      this.direction = 1;
      this.catDrag.setPosition(
        this.houseDrag.x + this.house.offsetWidth * 0.72 - this.cat.offsetWidth / 2,
        this.houseDrag.bottom,
      );
      this.catDrag.save();
      this.scheduleNextSleep();
    }

    isCatOverHouse() {
      const catBounds = this.cat.getBoundingClientRect();
      const houseBounds = this.house.getBoundingClientRect();
      const catCenterX = catBounds.left + catBounds.width / 2;
      const catCenterY = catBounds.top + catBounds.height / 2;
      return catCenterX >= houseBounds.left
        && catCenterX <= houseBounds.right
        && catCenterY >= houseBounds.top
        && catCenterY <= houseBounds.bottom;
    }

    shakeHouse() {
      this.house.classList.remove("shaking");
      requestAnimationFrame(() => this.house.classList.add("shaking"));
    }

    attachEvents() {
      this.cat.addEventListener("click", () => {
        if (this.catDrag.consumeSuppressedClick() || this.sleepState === "sleeping") return;
        releasePixelHearts(this.cat);
      });

      this.house.addEventListener("click", () => {
        if (this.houseDrag.consumeSuppressedClick()) return;
        this.shakeHouse();
        releasePixelHearts(this.house);
        if (this.sleepState !== "sleeping") return;
        this.wakeTapCount++;
        if (this.wakeTapCount === 2) setTimeout(() => this.wakeCat(), 180);
      });

      this.house.addEventListener("animationend", (event) => {
        if (event.animationName === "pixelHouseShake") this.house.classList.remove("shaking");
      });

      window.addEventListener("resize", () => this.clampAndRender(true));
      window.addEventListener("pagehide", () => {
        this.catDrag.save();
        this.houseDrag.save();
      });
    }

    clampAndRender(save = false) {
      this.catDrag.clamp();
      this.houseDrag.clamp();
      this.catDrag.render();
      this.houseDrag.render();
      this.cat.style.setProperty("--cat-direction", String(this.direction));
      if (save) {
        this.catDrag.save();
        this.houseDrag.save();
      }
    }

    moveCatHome(frameDuration) {
      const targetX = this.houseDrag.x + this.house.offsetWidth * 0.72 - this.cat.offsetWidth / 2;
      const targetBottom = this.houseDrag.bottom;
      const deltaX = targetX - this.catDrag.x;
      const deltaBottom = targetBottom - this.catDrag.bottom;
      const distance = Math.hypot(deltaX, deltaBottom);

      if (distance <= 3 || this.reducedMotion.matches) {
        this.catDrag.setPosition(targetX, targetBottom);
        this.enterHouse();
        return;
      }

      const travel = Math.min(distance, CAT_HOME_SPEED * frameDuration);
      this.catDrag.setPosition(
        this.catDrag.x + deltaX / distance * travel,
        this.catDrag.bottom + deltaBottom / distance * travel,
      );
      if (Math.abs(deltaX) > 1) this.direction = deltaX > 0 ? 1 : -1;
    }

    moveCatNormally(behavior, frameDuration) {
      if (behavior.name !== "walking" || this.catDrag.isDragging || this.reducedMotion.matches) return;
      const maximumX = this.catDrag.clamp();
      let nextX = this.catDrag.x + this.direction * CAT_SPEED * frameDuration;
      if (nextX >= maximumX) {
        nextX = maximumX;
        this.direction = -1;
      } else if (nextX <= EDGE) {
        nextX = EDGE;
        this.direction = 1;
      }
      this.catDrag.setPosition(nextX, this.catDrag.bottom);
    }

    update(frameTime) {
      const now = Date.now();
      const frameDuration = Math.min(Math.max(frameTime - this.previousFrameTime, 0), 50) / 1000;
      this.previousFrameTime = frameTime;
      let behavior = getPixelCatBehavior(now - this.startedAt);

      if (this.parkedInSandbox || this.sandbox?.update(frameTime, frameDuration, behavior)) {
        requestAnimationFrame((nextFrameTime) => this.update(nextFrameTime));
        return;
      }

      if (this.sleepState === "awake" && now >= this.nextSleepAt && !this.catDrag.isDragging) {
        this.sleepState = "going-home";
        this.wakeTapCount = 0;
      }

      if (this.sleepState === "sleeping") {
        if (now >= this.sleepUntil) this.wakeCat();
      } else if (this.sleepState === "going-home" && !this.catDrag.isDragging) {
        behavior = { name: "walking" };
        this.moveCatHome(frameDuration);
      } else {
        this.moveCatNormally(behavior, frameDuration);
      }

      this.cat.style.setProperty("--cat-direction", String(this.direction));
      if (behavior.name !== this.previousBehavior) {
        this.cat.dataset.behavior = behavior.name;
        this.previousBehavior = behavior.name;
      }
      if (this.catDrag.dirty && frameTime - this.lastSavedAt >= SAVE_INTERVAL) {
        this.catDrag.save();
        this.lastSavedAt = frameTime;
      }
      requestAnimationFrame((nextFrameTime) => this.update(nextFrameTime));
    }
  }

  let pixelCompanions = null;

  function initializePixelCompanions() {
    if (!isAppAuthenticated()) return null;
    if (!pixelCompanions && !document.querySelector(".pixel-cat, .pixel-house")) {
      pixelCompanions = new PixelCompanions();
    }
    return pixelCompanions;
  }

  window.initializePixelCompanions = initializePixelCompanions;
  initializePixelCompanions();
})();
