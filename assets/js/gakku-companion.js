(() => {
  'use strict';
  if (appStorage.get('ily:name', '').trim().toLowerCase() !== 'ghali') return;
  const pet = document.getElementById('gakku-companion');
  const sprite = pet.querySelector('span');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saved = appStorage.getJson('ily:gakku:position', {});
  let x = Number.isFinite(saved.x) ? saved.x : 35;
  let bottom = Number.isFinite(saved.bottom) ? saved.bottom : 12;
  let direction = saved.direction === -1 ? -1 : 1;
  let drag = null, elapsed = 0, last = 0, lastSave = 0;
  function clamp() {
    x = Math.max(0, Math.min(x, Math.max(0, window.innerWidth - pet.offsetWidth)));
    bottom = Math.max(0, Math.min(bottom, Math.max(0, window.innerHeight - pet.offsetHeight)));
  }
  function render(frame = 4) {
    clamp();
    pet.style.left = `${x}px`; pet.style.bottom = `${bottom}px`;
    sprite.style.backgroundPosition = `${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%`;
    sprite.style.transform = `scaleX(${frame < 4 ? direction : 1})`;
  }
  function save() { appStorage.setJson('ily:gakku:position', { x, bottom, direction }); }
  pet.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: x, startBottom: bottom };
    pet.setPointerCapture(event.pointerId);pet.classList.add('dragging');render();
  });
  pet.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    x = drag.startX + event.clientX - drag.x;
    bottom = drag.startBottom - (event.clientY - drag.y);
    render();
  });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null; elapsed = 5; pet.classList.remove('dragging');render();save();
  }
  pet.addEventListener('pointerup', endDrag);
  pet.addEventListener('pointercancel', endDrag);
  pet.addEventListener('lostpointercapture', endDrag);
  pet.addEventListener('keydown', event => {
    const moves = { ArrowLeft: [-12,0], ArrowRight: [12,0], ArrowUp: [0,12], ArrowDown: [0,-12] };
    if (!moves[event.key]) return;
    event.preventDefault();x += moves[event.key][0];bottom += moves[event.key][1];elapsed = 5;render();save();
  });
  function tick(time) {
    const dt = last ? Math.min((time-last)/1000,.05) : 0;last=time;
    if (!document.hidden && !drag) {
      elapsed += dt;
      const walking = !reduced.matches && elapsed % 9 < 5;
      if (walking) {
        x += direction * 24 * dt;
        if (x <= 0 || x >= Math.max(0,window.innerWidth-pet.offsetWidth)) direction *= -1;
      }
      render(walking ? Math.floor(elapsed*7)%4 : !reduced.matches && elapsed%3>2.7 ? 5 : 4);
      if (time-lastSave>2000) {save();lastSave=time;}
    }
    requestAnimationFrame(tick);
  }
  window.addEventListener('resize', () => {render();save();});
  window.addEventListener('pagehide',save);
  render();requestAnimationFrame(tick);
})();
