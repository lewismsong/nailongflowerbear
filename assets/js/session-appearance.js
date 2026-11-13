(() => {
  "use strict";

  const STORAGE_KEY = "ily:sessionAppearance";
  const root = document.documentElement;

  function normalize(value) {
    return value === "dark" ? "dark" : "light";
  }

  function read() {
    try {
      return normalize(sessionStorage.getItem(STORAGE_KEY));
    } catch (error) {
      console.error("could not read the session appearance:", error);
      return "light";
    }
  }

  function apply(value, persist) {
    const appearance = normalize(value);
    root.dataset.appearance = appearance;
    if (persist) {
      try {
        sessionStorage.setItem(STORAGE_KEY, appearance);
      } catch (error) {
        console.error("could not save the session appearance:", error);
      }
    }
    window.dispatchEvent(new CustomEvent("session-appearance-change", { detail: appearance }));
  }

  apply(read(), false);
  window.SessionAppearance = {
    get current() { return normalize(root.dataset.appearance); },
    set(value) { apply(value, true); },
  };
})();
