(() => {
  'use strict';
  // ghali is paused; keep its artwork and local progress for later.
  try {
    if ((localStorage.getItem('ily:name') || '').trim().toLowerCase() === 'ghali') localStorage.removeItem('ily:name');
  } catch {}
  if (window.location.pathname.endsWith('/ghali.html')) {
    document.documentElement.hidden = true;
    window.location.replace('index.html');
  }
})();
