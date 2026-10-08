(() => {
  'use strict';
  const KEY = 'ily:pakkuSandbox';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  window.PakkuSandbox = class {
    constructor(pet) {
      this.pet = pet;
      this.area = document.getElementById('pakku-sandbox');
      this.slide = document.getElementById('sandbox-slide');
      this.yarn = document.getElementById('sandbox-yarn');
      this.suitcase = document.getElementById('sandbox-suitcase');
      this.trampoline = document.getElementById('sandbox-trampoline');
      this.bounce = null;
      this.inSuitcase = false;
      this.yarnX = .78;
      this.yarnRun = null;
      const saved = appStorage.getJson(KEY, {});
      this.inside = saved.inside === true;
      this.x = Number.isFinite(saved.x) ? clamp(saved.x, 0, 1) : .2;
      this.y = Number.isFinite(saved.y) ? clamp(saved.y, 0, 1) : .8;
      this.lastSave = 0;
      this.ride = null;
      if (this.inside) this.activate();
      const ride = () => {
        if (!this.inside) return;
        this.startSlide();
      };
      this.slide.addEventListener('click', ride);
      document.getElementById('slide-option').addEventListener('click', ride);
      this.yarn.addEventListener('click', () => this.startYarn());
      document.getElementById('yarn-option').addEventListener('click', () => this.startYarn());
      this.suitcase.addEventListener('click', () => this.startSuitcase());
      document.getElementById('suitcase-option').addEventListener('click', () => this.startSuitcase());
      this.trampoline.addEventListener('click', () => this.startBounce());
      document.getElementById('trampoline-option').addEventListener('click', () => this.startBounce());
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
      this.pet.cat.setAttribute('aria-label', 'Pakku at home; drag him onto a toy or out to explore');
    }

    save() {
      appStorage.setJson(KEY, { inside: this.inside, x: this.x, y: this.y });
    }

    beginDrag() {
      this.bounce = null;
      this.inSuitcase = false;
      this.ride = null;
      this.yarnRun = null;
      this.pet.cat.classList.remove('is-sliding');
      this.pet.cat.style.clipPath = '';
    }

    cancelDrag() {
      if (this.inside) this.place();
    }

    drop() {
      const point = this.center();
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
      if (this.contains(this.trampoline.getBoundingClientRect(), point.x, point.y)) this.startBounce();
      else if (this.contains(this.suitcase.getBoundingClientRect(), point.x, point.y)) this.startSuitcase();
      else if (this.contains(this.yarn.getBoundingClientRect(), point.x, point.y)) this.startYarn();
      else if (this.contains(this.slide.getBoundingClientRect(), point.x, point.y)) this.startSlide();
      return true;
    }

    leave(keepDropPosition = false) {
      this.inside = false;
      this.bounce = null;
      this.inSuitcase = false;
      this.ride = null;
      this.yarnRun = null;
      this.pet.cat.classList.remove('in-sandbox', 'is-sliding');
      this.pet.cat.style.clipPath = '';
      this.pet.cat.setAttribute('aria-label', 'drag Pakku or select him to send some love');
      this.pet.scheduleNextSleep();
      this.pet.catDrag.setPosition(this.pet.catDrag.x, keepDropPosition ? this.pet.catDrag.bottom : 8);
      this.pet.previousBehavior = '';
      this.pet.catDrag.save();
      this.save();
    }

    // Keep coordinates relative to the room, so scrolling/resizing cannot detach Pakku.
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
      this.yarnRun = null;
      this.bounce = null;
      this.inSuitcase = false;
      this.selectToy('slide');
      this.ride = { elapsed: 0 };
      this.pet.direction = 1;
      this.pet.cat.classList.add('is-sliding');
    }

    selectToy(name) {
      document.getElementById('trampoline-option').classList.toggle('selected', name === 'trampoline');
      document.getElementById('slide-option').classList.toggle('selected', name === 'slide');
      document.getElementById('yarn-option').classList.toggle('selected', name === 'yarn');
      document.getElementById('suitcase-option').classList.toggle('selected', name === 'suitcase');
    }

    startYarn() {
      if (!this.inside) return;
      if (this.pet.catDrag.isDragging) return;
      this.ride = null;
      this.pet.cat.classList.remove('is-sliding');
      this.bounce = null;
      this.inSuitcase = false;
      this.selectToy('yarn');
      this.yarnRun = { elapsed: 0, from: this.yarnX, target: this.yarnX > .5 ? .12 : .82, caught: 0 };
    }

    startSuitcase() {
      if (!this.inside || this.pet.catDrag.isDragging) return;
      this.beginDrag();
      this.inSuitcase = true;
      this.selectToy('suitcase');
      this.suitcaseFrame();
      this.save();
    }

    startBounce() {
      if (!this.inside || this.pet.catDrag.isDragging) return;
      this.beginDrag();
      this.selectToy('trampoline');
      this.bounce = { elapsed: 0 };
      this.bounceFrame(0);
    }

    bounceFrame(dt) {
      const run = this.bounce;
      run.elapsed += dt;
      const durations = [1.05, .75, .42];
      const heights = [1, .48, .10];
      let phase = run.elapsed, index = 0;
      while (index < 3 && phase >= durations[index]) phase -= durations[index++];
      const r = this.trampoline.getBoundingClientRect();
      const cat = this.pet.cat;
      const base = r.top + r.height * .40 - cat.offsetHeight * .85;
      const available = Math.max(0, base - this.bounds().top - 4);
      const maximum = this.pet.reducedMotion.matches ? Math.min(8, available) : Math.min(120, available);
      const progress = index < 3 ? phase / durations[index] : 0;
      const lift = index < 3 ? 4 * progress * (1 - progress) * maximum * heights[index] : 0;
      cat.dataset.behavior = 'sitting';
      this.placeAt(r.left + r.width / 2 - cat.offsetWidth / 2, base - lift);
      this.rememberPosition();
      if (index === 3) {
        this.bounce = null;
        this.save();
      }
    }

    suitcaseFrame() {
      const r = this.suitcase.getBoundingClientRect();
      this.pet.cat.dataset.behavior = 'sitting';
      const rim = r.top + r.height * .70;
      this.placeAt(r.left + r.width * .50 - this.pet.cat.offsetWidth / 2,
        rim - this.pet.cat.offsetHeight * .52);
      // Match the front rim, hiding the body below it while keeping the head draggable.
      const cat = this.pet.cat.getBoundingClientRect();
      const bottom = Math.max(cat.height * .48, cat.top + cat.height - window.innerHeight);
      this.pet.cat.style.clipPath = `inset(${Math.max(0, -cat.top)}px 0 ${bottom}px 0)`;
      this.rememberPosition();
    }

    yarnFrame(dt) {
      const run = this.yarnRun;
      run.elapsed += dt;
      const reduced = this.pet.reducedMotion.matches;
      const t = reduced ? 1 : Math.min(1, run.elapsed / .9);
      this.yarnX = run.from + (run.target - run.from) * (1 - Math.pow(1 - t, 3));
      this.renderYarn();
      this.yarn.style.transform = reduced ? '' : `rotate(${(this.yarnX - run.from) * 540}deg)`;
      const ball = this.yarn.getBoundingClientRect();
      const cat = this.pet.cat.getBoundingClientRect();
      const targetX = ball.left + ball.width / 2 - cat.width / 2;
      const targetY = ball.top + ball.height * .75 - cat.height * .82;
      const dx = targetX - cat.left, dy = targetY - cat.top;
      const distance = Math.hypot(dx, dy);
      if (distance > 5) {
        const step = reduced ? distance : Math.min(distance, 110 * dt);
        this.placeAt(cat.left + dx / distance * step, cat.top + dy / distance * step);
        this.pet.direction = dx >= 0 ? 1 : -1;
        this.pet.cat.dataset.behavior = 'walking';
      } else if (t === 1) {
        run.caught += dt;
        this.pet.cat.dataset.behavior = 'playing';
        if (run.caught >= (reduced ? .15 : 1.8)) {
          this.yarnRun = null;
        }
      }
      this.rememberPosition();
      if (!this.yarnRun) this.save();
    }

    renderYarn() {
      if (this.renderedYarnX === this.yarnX) return;
      this.renderedYarnX = this.yarnX;
      this.yarn.style.left = `calc(${this.yarnX * 100}% - ${this.yarnX * this.yarn.offsetWidth}px)`;
    }

    rememberPosition() {
      const area = this.bounds();
      const cat = this.pet.cat.getBoundingClientRect();
      this.x = clamp((cat.left - area.left) / Math.max(1, area.width - cat.width), 0, 1);
      this.y = clamp((cat.top - area.top) / Math.max(1, area.height - cat.height), 0, 1);
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
        this.rememberPosition();
        this.ride = null;
        this.pet.cat.classList.remove('is-sliding');
        this.save();
      }
    }

    update(time, dt, behavior) {
      this.renderYarn();
      if (this.pet.catDrag.isDragging) {
        return this.inside;
      }
      if (!this.inside) return false;
      if (this.bounce) this.bounceFrame(dt);
      else if (this.ride) this.slideFrame(dt);
      else if (this.yarnRun) this.yarnFrame(dt);
      else if (this.inSuitcase) this.suitcaseFrame();
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

