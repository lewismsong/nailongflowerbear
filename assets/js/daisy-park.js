(() => {
  "use strict";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  window.DaisyPark = class {
    constructor(pet, options) {
      this.pet = pet;
      this.key = options.storageKey;
      this.area = document.getElementById("daisy-park");
      this.lake = document.getElementById("daisy-lake");
      this.bed = document.getElementById("daisy-bed");
      this.status = document.getElementById("daisy-status");
      const state = appStorage.getJson(this.key, options.initialState);
      this.inside = state.inside === true;
      this.x = Number.isFinite(state.x) ? clamp(state.x, 0, 1) : .68;
      this.y = Number.isFinite(state.y) ? clamp(state.y, 0, 1) : .7;
      this.mode = null;
      this.elapsed = 0;
      this.lastSave = 0;
      for (const id of ["daisy-lake", "lake-option"]) document.getElementById(id).addEventListener("click", () => this.start("swim"));
      for (const id of ["daisy-bed", "bed-option"]) document.getElementById(id).addEventListener("click", () => this.start("bed"));
      this.announce();
    }
    bounds() {
      const r = this.area.getBoundingClientRect();
      return { left: r.left + this.area.clientLeft, top: r.top + this.area.clientTop, width: this.area.clientWidth, height: this.area.clientHeight };
    }
    contains(r, x, y) { return x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height; }
    activate() { this.pet.cat.setAttribute("aria-label", "Daisy in her park; drag her onto a toy or out to explore"); this.announce(); }
    announce() { this.status.textContent = !this.inside ? "daisy is out exploring." : this.mode === "swim" ? "just keep swimming, daisy!" : this.mode === "bed" ? "sweet dreams, daisy." : "play with daisy!"; }
    save() { appStorage.setJson(this.key, { inside: this.inside, x: this.x, y: this.y }); }
    beginDrag() { this.mode = null; this.pet.cat.classList.remove("is-swimming"); this.pet.cat.style.clipPath = ""; this.announce(); }
    cancelDrag() { if (this.inside) this.place(); }
    drop() {
      const c = this.pet.cat.getBoundingClientRect();
      const x = c.left + c.width / 2, y = c.top + c.height / 2;
      if (!this.contains(this.bounds(), x, y)) {
        if (!this.inside) return false;
        this.inside = false; this.beginDrag(); this.save();
        this.pet.cat.setAttribute("aria-label", "drag Daisy or select her to howl");
        return true;
      }
      this.inside = true; this.activate(); this.rememberPosition(); this.place(); this.save();
      if (this.contains(this.lake.getBoundingClientRect(), x, y)) this.start("swim");
      else if (this.contains(this.bed.getBoundingClientRect(), x, y)) this.start("bed");
      return true;
    }
    placeAt(left, top, submerged = false) {
      const r = this.bounds(), c = this.pet.cat;
      left = clamp(left, r.left, r.left + Math.max(0, r.width - c.offsetWidth));
      const groundTop = r.top + Math.max(0, r.height * .60 - c.offsetHeight * .7);
      top = clamp(top, groundTop, r.top + Math.max(0, r.height - c.offsetHeight));
      this.pet.catDrag.x = left;
      this.pet.catDrag.bottom = window.innerHeight - top - c.offsetHeight;
      this.pet.catDrag.render();
      const bottom = Math.max(0, top + c.offsetHeight - window.innerHeight, submerged ? c.offsetHeight * .38 : 0);
      c.style.clipPath = `inset(${Math.max(0, -top)}px 0 ${bottom}px 0)`;
    }
    place() { const r = this.bounds(); this.placeAt(r.left + this.x * Math.max(0, r.width - this.pet.cat.offsetWidth), r.top + this.y * Math.max(0, r.height - this.pet.cat.offsetHeight)); }
    rememberPosition() { const r = this.bounds(), c = this.pet.cat.getBoundingClientRect(); this.x = clamp((c.left - r.left) / Math.max(1, r.width - c.width), 0, 1); this.y = clamp((c.top - r.top) / Math.max(1, r.height - c.height), 0, 1); }
    start(mode) { if (!this.inside || this.pet.catDrag.isDragging) return; this.beginDrag(); this.mode = mode; this.elapsed = 0; this.announce(); }
    swim(dt) {
      this.elapsed += dt;
      const r = this.lake.getBoundingClientRect(), c = this.pet.cat;
      // enter from the right bank, swim across, leave briefly, then go back in.
      const points = [[1.04,.64], [.68,.54], [.30,.49], [.68,.54], [1.04,.64], [1.04,.64]];
      const phase = this.pet.reducedMotion.matches ? 1 : (this.elapsed % 12) / 2;
      const i = Math.floor(phase), a = points[i], b = points[(i + 1) % points.length];
      const t = phase - i, smooth = t * t * (3 - 2 * t);
      const x = a[0] + (b[0] - a[0]) * smooth, y = a[1] + (b[1] - a[1]) * smooth;
      const inWater = x < .9;
      this.pet.direction = b[0] < a[0] ? -1 : 1;
      c.classList.toggle("is-swimming", inWater);
      c.dataset.behavior = this.pet.reducedMotion.matches ? "sitting" : "walking";
      this.placeAt(r.left + r.width * x - c.offsetWidth / 2, r.top + r.height * y - c.offsetHeight * .62 + (inWater && !this.pet.reducedMotion.matches ? Math.sin(this.elapsed * 7) * 2 : 0), inWater);
      this.rememberPosition();
    }
    update(time, dt, behavior) {
      if (!this.inside) return false;
      if (this.pet.catDrag.isDragging) return true;
      if (this.mode === "swim") this.swim(dt);
      else if (this.mode === "bed") {
        const r = this.bed.getBoundingClientRect(), c = this.pet.cat;
        c.dataset.behavior = "idle";
        this.placeAt(r.left + r.width / 2 - c.offsetWidth / 2, r.top + r.height * .65 - c.offsetHeight * .82);
        this.rememberPosition();
      } else {
        if (behavior.name === "walking" && !this.pet.reducedMotion.matches) {
          this.x += this.pet.direction * 20 * dt / Math.max(1, this.area.clientWidth - this.pet.cat.offsetWidth);
          if (this.x <= 0 || this.x >= 1) this.pet.direction *= -1;
          this.x = clamp(this.x, 0, 1);
        }
        this.pet.cat.dataset.behavior = behavior.name;
        this.place();
      }
      this.pet.cat.style.setProperty("--cat-direction", String(this.pet.direction));
      if (time - this.lastSave > 1500) { this.save(); this.lastSave = time; }
      return true;
    }
  };
})();
