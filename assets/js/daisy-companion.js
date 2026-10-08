(() => {
  "use strict";

  const STORAGE_KEY = "ily:daisyPosition";
  const EDGE = 8;
  const RUN_SPEED = 20;
  const BEHAVIORS = [
    { name: "running", duration: 7000 },
    { name: "sitting", duration: 4200 },
    { name: "running", duration: 5200 },
    { name: "resting", duration: 4800 },
  ];
  const MARKUP = `
    <span class="pixel-daisy-direction" aria-hidden="true">
      <span class="pixel-daisy-sprite"></span>
    </span>`;

  class DaisyCompanion {
    constructor() {
      this.element = document.createElement("button");
      this.element.className = "pixel-daisy";
      this.element.type = "button";
      this.element.setAttribute("aria-label", "drag Daisy or select Daisy to hear a howl");
      this.element.innerHTML = MARKUP;
      document.body.appendChild(this.element);

      const storedPosition = appStorage.getJson(STORAGE_KEY, {});
      this.x = Number.isFinite(storedPosition.x) ? storedPosition.x : 112;
      this.bottom = Number.isFinite(storedPosition.bottom) ? storedPosition.bottom : 108;
      this.direction = storedPosition.direction === -1 ? -1 : 1;
      this.behaviorIndex = 0;
      this.behaviorStartedAt = performance.now();
      this.howlingUntil = 0;
      this.previousFrameTime = performance.now();
      this.activePointerId = null;
      this.dragged = false;
      this.suppressClick = false;
      this.dirty = true;
      this.lastSavedAt = 0;
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

      this.attachEvents();
      this.setBehavior(this.reducedMotion.matches ? "sitting" : "running");
      this.clampAndRender();
      requestAnimationFrame(frameTime => this.update(frameTime));
    }

    setBehavior(behavior) {
      this.element.dataset.behavior = behavior;
    }

    clampAndRender() {
      const maximumX = Math.max(EDGE, window.innerWidth - this.element.offsetWidth - EDGE);
      const maximumBottom = Math.max(EDGE, window.innerHeight - this.element.offsetHeight - EDGE);
      this.x = Math.min(Math.max(this.x, EDGE), maximumX);
      this.bottom = Math.min(Math.max(this.bottom, EDGE), maximumBottom);
      this.element.style.left = `${this.x}px`;
      this.element.style.bottom = `${this.bottom}px`;
      this.element.style.setProperty("--daisy-direction", String(this.direction));
      return maximumX;
    }

    save() {
      appStorage.setJson(STORAGE_KEY, {
        x: this.x,
        bottom: this.bottom,
        direction: this.direction,
      });
      this.dirty = false;
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
        this.x = event.clientX - this.dragOffsetX;
        this.bottom = window.innerHeight - (event.clientY - this.dragOffsetY) - this.element.offsetHeight;
        this.dragged ||= Math.hypot(event.clientX - this.dragStartX, event.clientY - this.dragStartY) > 4;
        this.dirty = true;
        this.clampAndRender();
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
      window.addEventListener("resize", () => {
        this.clampAndRender();
        this.save();
      });
      window.addEventListener("pagehide", () => this.save());
    }

    move(frameDuration) {
      const maximumX = this.clampAndRender();
      this.x += this.direction * RUN_SPEED * frameDuration;
      if (this.x >= maximumX) {
        this.x = maximumX;
        this.direction = -1;
      } else if (this.x <= EDGE) {
        this.x = EDGE;
        this.direction = 1;
      }
      this.dirty = true;
      this.clampAndRender();
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
          if (currentBehavior.name === "running") this.move(frameDuration);
        } else {
          this.setBehavior("sitting");
        }
      }

      if (this.dirty && frameTime - this.lastSavedAt >= 500) {
        this.save();
        this.lastSavedAt = frameTime;
      }
      requestAnimationFrame(nextFrameTime => this.update(nextFrameTime));
    }
  }

  if (isAppAuthenticated()) new DaisyCompanion();
})();
