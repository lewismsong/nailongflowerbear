(() => {
  "use strict";

  if (isAppAuthenticated()) return;

  document.documentElement.hidden = true;
  window.stop();
  window.location.replace("index.html");
})();
