(() => {
  "use strict";

  const STORAGE_KEY = "ily:samoyedPosition";
  const EDGE = 4;
  const RUN_SPEED = 20;
  const BEHAVIORS = [
    { name: "running", duration: 7000 },
    { name: "sitting", duration: 4200 },
    { name: "running", duration: 5200 },
    { name: "resting", duration: 4800 },
  ];

  class SamoyedCompanion {
    constructor() {
      this.area = document.getElementById("pakku-sandbox");
      this.element = document.getElementById("sandbox-samoyed");
      if (!this.area || !this.element) {
        throw new Error("the Samoyed playroom elements are required");
      }

      const storedPosition = appStorage.getJson(STORAGE_KEY, {});
      this.x = Number.isFinite(storedPosition.x) ? this.clamp(storedPosition.x, 0, 1) : 0.68;
      this.y = Number.isFinite(storedPosition.y) ? this.clamp(storedPosition.y, 0, 1) : 0.7;
      this.direction = storedPosition.direction === -1 ? -1 : 1;
      this.behaviorIndex = 0;
      this.behaviorStartedAt = performance.now();
      this.howlingUntil = 0;
      this.previousFrameTime = performance.now();
      this.activePointerId = null;
      this.dragged = false;
      this.suppressClick = false;
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

      this.attachEvents();
      this.setBehavior(this.reducedMotion.matches ? "sitting" : "running");
      this.render();
      requestAnimationFrame(frameTime => this.update(frameTime));
    }

    clamp(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }

    availableSpace() {
      return {
        width: Math.max(0, this.area.clientWidth - this.element.offsetWidth - EDGE * 2),
        height: Math.max(0, this.area.clientHeight - this.element.offsetHeight - EDGE * 2),
      };
    }

    setBehavior(behavior) {
      this.element.dataset.behavior = behavior;
    }

    render() {
      const space = this.availableSpace();
      this.element.style.left = `${EDGE + this.x * space.width}px`;
      this.element.style.top = `${EDGE + this.y * space.height}px`;
      this.element.style.setProperty("--samoyed-direction", String(this.direction));
    }

    save() {
      appStorage.setJson(STORAGE_KEY, { x: this.x, y: this.y, direction: this.direction });
    }

    startHowling() {
      this.howlingUntil = performance.now() + 3200;
      this.setBehavior("howling");
    }

    attachEvents() {
      this.element.addEventListener("click", () => {
        if (this.suppressClick) {
          this.suppressClick = false;
          return;
        }
        this.startHowling();
      });

      this.element.addEventListener("pointerdown", event => {
        if (!event.isPrimary || event.button !== 0) return;
        const bounds = this.element.getBoundingClientRect();
        this.activePointerId = event.pointerId;
        this.dragOffsetX = event.clientX - bounds.left;
        this.dragOffsetY = event.clientY - bounds.top;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
        this.dragged = false;
        this.howlingUntil = 0;
        this.setBehavior("sitting");
        this.element.classList.add("dragging");
        this.element.setPointerCapture(event.pointerId);
      });

      this.element.addEventListener("pointermove", event => {
        if (event.pointerId !== this.activePointerId) return;
        const areaBounds = this.area.getBoundingClientRect();
        const space = this.availableSpace();
        const left = event.clientX - this.dragOffsetX - areaBounds.left - this.area.clientLeft - EDGE;
        const top = event.clientY - this.dragOffsetY - areaBounds.top - this.area.clientTop - EDGE;
        this.x = space.width ? this.clamp(left / space.width, 0, 1) : 0;
        this.y = space.height ? this.clamp(top / space.height, 0, 1) : 0;
        this.dragged ||= Math.hypot(event.clientX - this.dragStartX, event.clientY - this.dragStartY) > 4;
        this.render();
        event.preventDefault();
      });

      const finishDragging = event => {
        if (event.pointerId !== this.activePointerId) return;
        if (this.element.hasPointerCapture(event.pointerId)) {
          this.element.releasePointerCapture(event.pointerId);
        }
        this.activePointerId = null;
        this.element.classList.remove("dragging");
        this.suppressClick = this.dragged;
        setTimeout(() => { this.suppressClick = false; }, 0);
        this.behaviorStartedAt = performance.now();
        this.behaviorIndex = 1;
        this.setBehavior("sitting");
        this.save();
      };

      this.element.addEventListener("pointerup", finishDragging);
      this.element.addEventListener("pointercancel", finishDragging);
      window.addEventListener("resize", () => this.render());
      window.addEventListener("pagehide", () => this.save());
    }

    update(frameTime) {
      const frameDuration = Math.min(Math.max(frameTime - this.previousFrameTime, 0), 50) / 1000;
      this.previousFrameTime = frameTime;

      if (this.activePointerId === null) {
        if (frameTime < this.howlingUntil) {
          this.setBehavior("howling");
        } else if (this.howlingUntil) {
          this.howlingUntil = 0;
          this.behaviorIndex = 1;
          this.behaviorStartedAt = frameTime;
          this.setBehavior("sitting");
        } else if (!this.reducedMotion.matches) {
          const behavior = BEHAVIORS[this.behaviorIndex];
          if (frameTime - this.behaviorStartedAt >= behavior.duration) {
            this.behaviorIndex = (this.behaviorIndex + 1) % BEHAVIORS.length;
            this.behaviorStartedAt = frameTime;
          }
          const currentBehavior = BEHAVIORS[this.behaviorIndex];
          this.setBehavior(currentBehavior.name);
          if (currentBehavior.name === "running") {
            const space = this.availableSpace();
            this.x += this.direction * RUN_SPEED * frameDuration / Math.max(1, space.width);
            if (this.x >= 1 || this.x <= 0) this.direction *= -1;
            this.x = this.clamp(this.x, 0, 1);
            this.render();
          }
        } else {
          this.setBehavior("sitting");
        }
      }

      requestAnimationFrame(nextFrameTime => this.update(nextFrameTime));
    }
  }

  if (isAppAuthenticated()) new SamoyedCompanion();
})();
