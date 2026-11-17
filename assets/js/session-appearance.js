(() => {
  "use strict";

  const STORAGE_KEY = "ily:appearance";
  const LEGACY_SESSION_KEY = "ily:sessionAppearance";
  const root = document.documentElement;

  function normalize(value) {
    return value === "dark" ? "dark" : "light";
  }

  function read() {
    try {
      const savedAppearance = localStorage.getItem(STORAGE_KEY);
      if (savedAppearance !== null) return normalize(savedAppearance);
    } catch (error) {
      console.error("could not read the saved appearance:", error);
    }

    try {
      const sessionAppearance = sessionStorage.getItem(LEGACY_SESSION_KEY);
      if (sessionAppearance !== null) {
        const appearance = normalize(sessionAppearance);
        localStorage.setItem(STORAGE_KEY, appearance);
        return appearance;
      }
    } catch (error) {
      console.error("could not migrate the session appearance:", error);
    }
    return "light";
  }

  function apply(value, persist) {
    const appearance = normalize(value);
    // persist first so a failed write cannot look like a successful save.
    if (persist) localStorage.setItem(STORAGE_KEY, appearance);
    root.dataset.appearance = appearance;
    window.dispatchEvent(new CustomEvent("session-appearance-change", { detail: appearance }));
  }

  apply(read(), false);
  window.SessionAppearance = {
    get current() { return normalize(root.dataset.appearance); },
    set(value) { apply(value, true); },
  };
})();
