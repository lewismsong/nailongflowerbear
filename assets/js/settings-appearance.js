(() => {
  "use strict";

  const form = document.getElementById("appearance-form");
  const darkMode = document.getElementById("dark-mode");
  const applyButton = document.getElementById("apply-appearance");
  const status = document.getElementById("appearance-status");
  darkMode.checked = window.SessionAppearance.current === "dark";

  function updateApply() {
    applyButton.disabled = (darkMode.checked ? "dark" : "light") === window.SessionAppearance.current;
  }
  updateApply();
  darkMode.addEventListener("change", () => {
    updateApply();
    status.classList.remove("error");
    status.textContent = applyButton.disabled ? "" : "press apply to save your appearance.";
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (applyButton.disabled) return;
    try {
      window.SessionAppearance.set(darkMode.checked ? "dark" : "light");
      updateApply();
      status.classList.remove("error");
      status.textContent = "applied — saved on this browser for your next visit.";
    } catch (error) {
      console.error("could not save appearance:", error);
      status.classList.add("error");
      status.textContent = "couldn't save appearance. allow browser storage, then press apply to try again.";
    }
  });
})();
