(() => {
  'use strict';
  let ghali = false;
  try { ghali = (localStorage.getItem('ily:name') || '').trim().toLowerCase() === 'ghali'; } catch {}
  const onGhali = window.location.pathname.endsWith('/ghali.html');
  if (ghali && !onGhali) {
    document.documentElement.hidden = true;
    window.location.replace('ghali.html');
  } else if (!ghali && onGhali) {
    document.documentElement.hidden = true;
    window.location.replace('index.html');
  }
})();
