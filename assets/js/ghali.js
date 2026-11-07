(() => {
  'use strict';
  if (appStorage.get('ily:name', '').trim().toLowerCase() !== 'ghali') return;
  const key = 'ily:ghali:misses';
  const saved = Number(appStorage.get(key, '0'));
  let count = Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
  const total = document.getElementById('ghali-count');
  const response = document.getElementById('ghali-response');
  const sparks = document.getElementById('ghali-sparks');
  total.textContent = count.toLocaleString();
  let lastClick = -Infinity;
  document.getElementById('gakku-button').addEventListener('click', () => {
    if (performance.now() - lastClick < 600) return;
    lastClick = performance.now();
    count = Math.min(Number.MAX_SAFE_INTEGER, count + 1);
    appStorage.set(key, count);
    total.textContent = count.toLocaleString();
    response.textContent = ['gakku missed you too.', 'a little greener, a little closer.', 'your miss made him glow.'][(count - 1) % 3];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    sparks.replaceChildren();
    for (let i = 0; i < 7; i++) {
      const heart = document.createElement('span');
      heart.className = 'glow-heart'; heart.textContent = '♡';
      heart.style.setProperty('--x', `${35 + Math.random() * 30}%`);
      sparks.appendChild(heart);
      setTimeout(() => heart.remove(), 1900);
    }
  });
  document.getElementById('ghali-signout').addEventListener('click', () => {
    if (!appStorage.remove('ily:name')) { response.textContent = "couldn't sign out — please try again."; return; }
    window.location.replace('index.html');
  });
})();
