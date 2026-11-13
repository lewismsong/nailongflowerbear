(() => {
  "use strict";

  const darkMode = document.getElementById("dark-mode");
  if (!darkMode) throw new Error("dark mode control is missing");

  darkMode.checked = window.SessionAppearance.current === "dark";
  darkMode.addEventListener("change", () => {
    window.SessionAppearance.set(darkMode.checked ? "dark" : "light");
  });
})();
