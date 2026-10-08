(() => {
  "use strict";

  const { normalize, normalizeHex, DEFAULTS } = SettingsModel;
  const root = document.documentElement;
  let current = normalize(null);
  let reference = null;
  let ready = false;
  let resolveReady;
  let rejectReady;
  const readyPromise = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // pages without an editor still report subscription failures through the shared status message.
  readyPromise.catch(error => console.error("settings unavailable:", error));

  function mix(hex, target, amount) {
    const channels = hex.match(/[\da-f]{2}/gi).map(channel => parseInt(channel, 16));
    return "#" + channels.map(channel => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, "0")).join("");
  }

  function rgb(hex) {
    return hex.match(/[\da-f]{2}/gi).map(channel => parseInt(channel, 16)).join(", ");
  }

  function applyColors(value) {
    const customKhali = normalizeHex(value?.colors?.khali);
    const customLewis = normalizeHex(value?.colors?.lewis);
    const properties = {
      "--yellow": customKhali,
      "--yellow-deep": customKhali && (customKhali === DEFAULTS.colors.khali ? "#9B522E" : mix(customKhali, 0, 0.42)),
      "--accent-rgb": customKhali && rgb(customKhali),
      "--accent-deep-rgb": customKhali && rgb(customKhali === DEFAULTS.colors.khali ? "#9B522E" : mix(customKhali, 0, 0.42)),
      "--accent-light": customKhali && mix(customKhali, 255, 0.65),
      "--accent-shadow": customKhali && mix(customKhali, 0, 0.2),
      "--blue": customLewis,
      "--blue-deep": customLewis && (customLewis === DEFAULTS.colors.lewis ? "#9B4945" : mix(customLewis, 0, 0.42)),
      "--lewis-rgb": customLewis && rgb(customLewis),
      "--lewis-deep-rgb": customLewis && rgb(customLewis === DEFAULTS.colors.lewis ? "#9B4945" : mix(customLewis, 0, 0.42)),
    };
    for (const [property, color] of Object.entries(properties)) {
      if (color) root.style.setProperty(property, color);
      else root.style.removeProperty(property);
    }
  }

  function reportError(error) {
    console.error("shared settings failed:", error);
    if (!ready) rejectReady(error);
    if (!document.getElementById("settings-form")) {
      let message = document.getElementById("shared-settings-error");
      if (!message) {
        message = document.createElement("p");
        message.id = "shared-settings-error";
        message.setAttribute("role", "alert");
        document.body.append(message);
      }
      message.textContent = "couldn't sync settings — check your connection and reload to try again.";
    }
    window.dispatchEvent(new CustomEvent("app-settings-error", { detail: error }));
  }

  window.appSettings = {
    get current() { return normalize(current); },
    ready: readyPromise,
    async apply(updates) {
      await readyPromise;
      if (!reference) throw new Error("settings are not connected");
      await reference.update(updates);
    },
  };

  if (!isAppAuthenticated()) return;
  try {
    reference = initializeFirebaseDatabase().ref("settings");
    reference.on("value", snapshot => {
      const value = snapshot.val();
      current = normalize(value);
      applyColors(value);
      // unset accents follow the seasonal palette rather than freezing its defaults.
      const palette = getComputedStyle(root);
      for (const [person, property] of [["khali", "--yellow"], ["lewis", "--blue"]]) {
        if (!normalizeHex(value?.colors?.[person])) {
          current.colors[person] = normalizeHex(palette.getPropertyValue(property)) || DEFAULTS.colors[person];
        }
      }
      document.getElementById("shared-settings-error")?.remove();
      ready = true;
      resolveReady(window.appSettings.current);
      window.dispatchEvent(new CustomEvent("app-settings-change", { detail: window.appSettings.current }));
    }, reportError);
  } catch (error) {
    reportError(error);
  }
})();
