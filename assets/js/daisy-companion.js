(() => {
  "use strict";
  const ROOM_KEY = "ily:daisyPark";
  const POSITION_KEY = "ily:daisyPosition";
  const behaviors = [
    { name: "walking", duration: 7000 }, { name: "sitting", duration: 4200 },
    { name: "walking", duration: 5200 }, { name: "idle", duration: 4800 }
  ];

  class DaisyCompanion {
    constructor() {
      this.area = document.getElementById("daisy-park");
      this.cat = document.getElementById("pixel-daisy") || document.createElement("button");
      this.cat.id = "pixel-daisy";
      this.cat.className = "pixel-daisy";
      this.cat.type = "button";
      this.cat.setAttribute("aria-label", "drag Daisy or select her to howl");
      this.cat.innerHTML = '<span class="pixel-daisy-direction" aria-hidden="true"><span class="pixel-daisy-sprite"></span></span>';
      document.body.appendChild(this.cat);
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const saved = appStorage.getJson(POSITION_KEY, {});
      this.direction = saved.direction === -1 ? -1 : 1;
      this.previousFrameTime = performance.now();
      this.behaviorStartedAt = this.previousFrameTime;
      this.behaviorIndex = 0;
      this.howlingUntil = 0;
      this.lastSavedAt = 0;
      this.catDrag = new window.CompanionDraggable(this.cat, {
        storageKey: POSITION_KEY,
        initialPosition: { x: 110, bottom: 8 },
        getExtraState: () => ({ direction: this.direction }),
        onDragStart: () => { this.howlingUntil = 0; this.sandbox?.beginDrag(); },
        onCancel: () => this.sandbox?.cancelDrag(),
        onDrop: () => {
          if (!this.catDrag.dragged) return false;
          const tree = document.querySelector(".pixel-house");
          const c = this.cat.getBoundingClientRect();
          const x = c.left + c.width / 2, y = c.top + c.height / 2;
          if (tree) {
            const t = tree.getBoundingClientRect();
            if (x >= t.left && x <= t.right && y >= t.top && y <= t.bottom) {
              this.sendToPlayroom();
              return true;
            }
          }
          const otherRoom = document.getElementById("pakku-sandbox");
          if (otherRoom) {
            const r = otherRoom.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
              this.catDrag.setPosition(this.catDrag.x, 8);
              return true;
            }
          }
          return this.sandbox?.drop() || false;
        }
      });
      const legacy = appStorage.getJson("ily:samoyedPosition", {});
      this.sandbox = this.area && window.DaisyPark ? new window.DaisyPark(this, {
        storageKey: ROOM_KEY, name: "Daisy", pronoun: "her",
        initialState: { inside: true, x: legacy.x ?? .68, y: legacy.y ?? .7 }
      }) : null;
      const room = appStorage.getJson(ROOM_KEY, { inside: !Number.isFinite(saved.x) });
      this.cat.hidden = !this.sandbox && room.inside;
      if (this.sandbox) { this.sandbox.save(); if (this.sandbox.inside) this.sandbox.place(); }
      this.cat.addEventListener("click", () => {
        if (this.catDrag.consumeSuppressedClick()) return;
        this.sandbox?.beginDrag();
        this.howlingUntil = performance.now() + 3200;
      });
      window.addEventListener("resize", () => {
        if (this.sandbox?.inside) this.sandbox.place();
        else { this.catDrag.clamp(); this.catDrag.render(); }
      });
      window.addEventListener("pagehide", () => { this.catDrag.save(); this.sandbox?.save(); });
      this.catDrag.clamp();
      this.catDrag.render();
      if (!this.cat.hidden) requestAnimationFrame(time => this.update(time));
    }

    // the shared playroom uses these hooks for pakku's sleep behavior.
    setSleepingAppearance() {}
    scheduleNextSleep() {}

    sendToPlayroom() {
      if (this.sandbox) {
        this.sandbox.beginDrag();
        this.sandbox.inside = true;
        this.sandbox.x = .68;
        this.sandbox.y = .7;
        this.sandbox.activate();
        this.sandbox.place();
        this.sandbox.save();
      } else {
        appStorage.setJson(ROOM_KEY, { inside: true, x: .68, y: .7 });
        window.location.assign("daisy.html");
      }
    }

    update(time) {
      const dt = Math.min(Math.max(time - this.previousFrameTime, 0), 50) / 1000;
      this.previousFrameTime = time;
      if (!document.hidden) {
        if (time - this.behaviorStartedAt >= behaviors[this.behaviorIndex].duration) {
          this.behaviorIndex = (this.behaviorIndex + 1) % behaviors.length;
          this.behaviorStartedAt = time;
        }
        const behavior = { name: this.howlingUntil > time ? "howling" :
          this.reducedMotion.matches ? "sitting" : behaviors[this.behaviorIndex].name };
        const inRoom = this.sandbox?.update(time, dt, behavior);
        if (!inRoom && !this.catDrag.isDragging) {
          this.cat.dataset.behavior = behavior.name;
          if (behavior.name === "walking" && !this.reducedMotion.matches) {
            const maximum = this.catDrag.clamp();
            const next = this.catDrag.x + this.direction * 20 * dt;
            if (next <= 8 || next >= maximum) this.direction *= -1;
            this.catDrag.setPosition(next, this.catDrag.bottom);
          }
          this.cat.style.setProperty("--cat-direction", String(this.direction));
        }
        if (!this.sandbox?.inside && this.catDrag.dirty && time - this.lastSavedAt > 500) {
          this.catDrag.save(); this.lastSavedAt = time;
        }
      }
      requestAnimationFrame(next => this.update(next));
    }
  }

  let daisy;
  window.initializeDaisy = () => {
    if (!daisy && isAppAuthenticated() && window.CompanionDraggable) daisy = new DaisyCompanion();
    return daisy;
  };
  window.addEventListener("app-auth-changed", window.initializeDaisy);
  window.initializeDaisy();
})();
