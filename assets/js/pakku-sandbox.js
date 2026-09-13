(() => {
  'use strict';
  const KEY = 'ily:pakkuSandbox';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  window.PakkuSandbox = class {
    constructor(pet) {
      this.pet = pet;
      this.area = document.getElementById('pakku-sandbox');
      this.slide = document.getElementById('sandbox-slide');
      this.status = document.getElementById('sandbox-status');
      this.transfer = document.getElementById('sandbox-transfer');
      const saved = appStorage.getJson(KEY, {});
      this.inside = saved.inside === true;
      this.x = Number.isFinite(saved.x) ? clamp(saved.x, 0, 1) : .2;
      this.y = Number.isFinite(saved.y) ? clamp(saved.y, 0, 1) : .8;
      this.lastSave = 0;
      this.ride = null;
      if (this.inside) this.activate();
      this.announce();
      const ride = () => {
        if (!this.inside) {
          this.status.textContent = 'bring Pakku into the sandbox first.';
          return;
        }
        this.startSlide();
      };
      this.slide.addEventListener('click', ride);
      document.getElementById('slide-option').addEventListener('click', ride);
      this.transfer.addEventListener('click', () => {
        if (this.inside) this.leave();
        else {
          this.inside = true;
          this.activate();
          this.place();
          this.save();
          this.announce();
        }
      });
      window.addEventListener('pagehide', () => this.save());
    }

    bounds() {
      const r = this.area.getBoundingClientRect();
      const border = this.area.clientLeft;
      return { left: r.left + border, top: r.top + border,
        width: this.area.clientWidth, height: this.area.clientHeight };
    }

    contains(r, x, y) {
      return x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;
    }

    center() {
      const r = this.pet.cat.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    activate() {
      this.pet.setSleepingAppearance(false);
      this.pet.scheduleNextSleep();
      this.pet.cat.classList.add('in-sandbox');
      this.pet.cat.setAttribute('aria-label', 'Pakku in the sandbox; drag him onto the slide or out to explore');
    }

    save() {
      appStorage.setJson(KEY, { inside: this.inside, x: this.x, y: this.y });
    }

    announce() {
      this.status.textContent = this.inside
        ? 'Pakku is playing here. drop him on the slide!'
        : 'Pakku is out exploring.';
      this.transfer.textContent = this.inside ? 'let Pakku roam outside' : 'bring Pakku into the sandbox';
    }

    beginDrag() {
      this.ride = null;
      this.pet.cat.classList.remove('is-sliding');
      this.pet.cat.style.clipPath = '';
    }

    cancelDrag() {
      this.area.classList.remove('drag-over');
      if (this.inside) this.place();
    }

    drop() {
      const point = this.center();
      this.area.classList.remove('drag-over');
      if (!this.contains(this.bounds(), point.x, point.y)) {
        if (this.inside) {
          this.leave(true);
          return true;
        }
        return false;
      }
      this.inside = true;
      this.activate();
      const r = this.bounds();
      this.x = clamp((point.x - r.left - this.pet.cat.offsetWidth / 2) / Math.max(1, r.width - this.pet.cat.offsetWidth), 0, 1);
      this.y = clamp((point.y - r.top - this.pet.cat.offsetHeight / 2) / Math.max(1, r.height - this.pet.cat.offsetHeight), 0, 1);
      this.place();
      this.save();
      this.announce();
      if (this.contains(this.slide.getBoundingClientRect(), point.x, point.y)) this.startSlide();
      return true;
    }

    leave(keepDropPosition = false) {
      this.inside = false;
      this.ride = null;
      this.pet.cat.classList.remove('in-sandbox', 'is-sliding');
      this.pet.cat.style.clipPath = '';
      this.pet.cat.setAttribute('aria-label', 'drag Pakku or select him to send some love');
      this.pet.scheduleNextSleep();
      this.pet.catDrag.setPosition(this.pet.catDrag.x, keepDropPosition ? this.pet.catDrag.bottom : 8);
      this.pet.previousBehavior = '';
      this.pet.catDrag.save();
      this.save();
      this.announce();
    }

    // Keep coordinates relative to the sand, so scrolling/resizing cannot detach Pakku.
    placeAt(left, top) {
      const cat = this.pet.cat;
      const r = this.bounds();
      left = clamp(left, r.left, r.left + Math.max(0, r.width - cat.offsetWidth));
      top = clamp(top, r.top, r.top + Math.max(0, r.height - cat.offsetHeight));
      this.pet.catDrag.x = left;
      this.pet.catDrag.bottom = window.innerHeight - top - cat.offsetHeight;
      this.pet.catDrag.render();
      // A fixed companion must be clipped when the page scrolls past the play area.
      const t = Math.max(0, -top), b = Math.max(0, top + cat.offsetHeight - window.innerHeight);
      cat.style.clipPath = `inset(${t}px 0 ${b}px 0)`;
    }

    place() {
      const r = this.bounds();
      this.placeAt(r.left + this.x * Math.max(0, r.width - this.pet.cat.offsetWidth),
        r.top + this.y * Math.max(0, r.height - this.pet.cat.offsetHeight));
    }

    startSlide() {
      if (!this.inside || this.pet.catDrag.isDragging || this.ride) return;
      this.ride = { elapsed: 0 };
      this.pet.direction = 1;
      this.pet.cat.classList.add('is-sliding');
      this.status.textContent = 'wheee!';
    }

    slideFrame(dt) {
      this.ride.elapsed += dt;
      const duration = this.pet.reducedMotion.matches ? .15 : 1.6;
      const progress = clamp(this.ride.elapsed / duration, 0, 1);
      const t = progress * progress;
      const r = this.slide.getBoundingClientRect();
      // Follow the chute in the generated sprite, from its top to the right-hand exit.
      const x = r.left + r.width * (.40 + .46 * t);
      const y = r.top + r.height * (.29 + .47 * t);
      this.placeAt(x - this.pet.cat.offsetWidth / 2, y - this.pet.cat.offsetHeight * .78);
      if (progress === 1) {
        const area = this.bounds();
        const cat = this.pet.cat.getBoundingClientRect();
        this.x = clamp((cat.left - area.left) / Math.max(1, area.width - cat.width), 0, 1);
        this.y = clamp((cat.top - area.top) / Math.max(1, area.height - cat.height), 0, 1);
        this.ride = null;
        this.pet.cat.classList.remove('is-sliding');
        this.save();
        this.status.textContent = 'again? drop Pakku on the slide for another ride.';
      }
    }

    update(time, dt, behavior) {
      if (this.pet.catDrag.isDragging) {
        const c = this.center();
        this.area.classList.toggle('drag-over', this.contains(this.bounds(), c.x, c.y));
        return this.inside;
      }
      if (!this.inside) return false;
      if (this.ride) this.slideFrame(dt);
      else {
        const travel = Math.max(1, this.bounds().width - this.pet.cat.offsetWidth);
        if (behavior.name === 'walking' && !this.pet.reducedMotion.matches) {
          this.x += this.pet.direction * 22 * dt / travel;
          if (this.x >= 1 || this.x <= 0) this.pet.direction *= -1;
          this.x = clamp(this.x, 0, 1);
        }
        this.pet.cat.dataset.behavior = behavior.name;
        this.place();
      }
      this.pet.cat.style.setProperty('--cat-direction', String(this.pet.direction));
      if (time - this.lastSave > 1500) { this.save(); this.lastSave = time; }
      return true;
    }
  };
})();
