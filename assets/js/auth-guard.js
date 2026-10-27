(() => {
  "use strict";

  if (appStorage.get("ily:name", "").trim().toLowerCase() === "ghali") {
    document.documentElement.hidden = true;
    window.stop();
    window.location.replace("ghali.html");
    return;
  }
  if (isAppAuthenticated()) return;

  document.documentElement.hidden = true;
  window.stop();
  window.location.replace("index.html");
})();
