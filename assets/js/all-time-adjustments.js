(() => {
  "use strict";

  const ADMIN_PASSWORD = "khaliwins";
  const ADJUSTMENT_PATH = "adjust/allTime";
  const TRANSFER_AUTHORIZATION_KEY = "ily:allTimeAdjustmentAuthorized";

  let authorized = false;
  let adjustmentRef = null;
  let updatePending = false;

  const adjustmentButtons = [...document.querySelectorAll("[data-all-time-delta]")];

  function connectAdjustment() {
    if (adjustmentRef) return adjustmentRef;
    try {
      adjustmentRef = initializeFirebaseDatabase().ref(ADJUSTMENT_PATH);
      return adjustmentRef;
    } catch (error) {
      console.error("all-time miss adjustment connection failed:", error);
      alert("couldn't connect to the misses database");
      return null;
    }
  }

  function requestAuthorization() {
    if (authorized) return true;
    const password = prompt("password?");
    if (password === ADMIN_PASSWORD) {
      authorized = true;
      return true;
    }
    if (password !== null) alert("no.");
    return false;
  }

  function setControlsVisible(visible) {
    adjustmentButtons.forEach((button) => { button.hidden = !visible; });
    if (visible) {
      connectAdjustment();
      adjustmentButtons[1].focus();
    }
  }

  function controlsAreVisible() {
    return adjustmentButtons.some((button) => !button.hidden);
  }

  function transferAuthorizationToMissesPage() {
    try {
      window.sessionStorage.setItem(TRANSFER_AUTHORIZATION_KEY, "1");
      window.location.href = "index.html";
    } catch (error) {
      console.error("all-time miss authorization transfer failed:", error);
      alert("couldn't open the all-time miss controls");
    }
  }

  function takeTransferredAuthorization() {
    try {
      const wasAuthorized = window.sessionStorage.getItem(TRANSFER_AUTHORIZATION_KEY) === "1";
      window.sessionStorage.removeItem(TRANSFER_AUTHORIZATION_KEY);
      return wasAuthorized;
    } catch (error) {
      console.error("all-time miss authorization could not be restored:", error);
      return false;
    }
  }

  async function changeAllTimeMisses(delta) {
    if (updatePending) return;
    if (delta !== -1 && delta !== 1) {
      console.error("invalid all-time miss adjustment:", delta);
      return;
    }
    const reference = connectAdjustment();
    if (!reference) return;

    updatePending = true;
    adjustmentButtons.forEach((button) => { button.disabled = true; });
    try {
      const result = await reference.transaction((currentValue) => {
        if (currentValue === null) return delta;
        const numericValue = Number(currentValue);
        return Number.isFinite(numericValue) ? numericValue + delta : undefined;
      });
      if (!result.committed) throw new Error("stored all-time adjustment is not numeric");
    } catch (error) {
      console.error("all-time miss adjustment failed:", error);
      alert("couldn't update the all-time misses");
    } finally {
      updatePending = false;
      adjustmentButtons.forEach((button) => { button.disabled = false; });
    }
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".trademark")) return;
    if (!requestAuthorization()) return;
    if (!adjustmentButtons.length) {
      transferAuthorizationToMissesPage();
      return;
    }
    setControlsVisible(!controlsAreVisible());
  });

  adjustmentButtons.forEach((button) => {
    button.addEventListener("click", () => changeAllTimeMisses(Number(button.dataset.allTimeDelta)));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && controlsAreVisible()) setControlsVisible(false);
  });

  if (adjustmentButtons.length && takeTransferredAuthorization()) {
    authorized = true;
    setControlsVisible(true);
  }
})();
