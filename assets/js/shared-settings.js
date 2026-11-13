(() => {
  "use strict";

  const { normalize, normalizeHex, DEFAULTS } = SettingsModel;
  const root = document.documentElement;
  let current = normalize(null);
  let sourceValue = null;
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

  function blend(hex, target, amount) {
    const source = hex.match(/[\da-f]{2}/gi).map(channel => parseInt(channel, 16));
    const destination = target.match(/[\da-f]{2}/gi).map(channel => parseInt(channel, 16));
    return "#" + source.map((channel, index) =>
      Math.round(channel + (destination[index] - channel) * amount).toString(16).padStart(2, "0")).join("");
  }

  // tint warm neutrals gently so the background supports the colourful accents.
  function tint(base, neutral, amount) {
    const source = base.match(/[\da-f]{2}/gi).map(channel => parseInt(channel, 16));
    return "#" + neutral.match(/[\da-f]{2}/gi).map((channel, index) =>
      Math.round(parseInt(channel, 16) * (1 - amount) + source[index] * amount).toString(16).padStart(2, "0")).join("");
  }

  function rgb(hex) {
    return hex.match(/[\da-f]{2}/gi).map(channel => parseInt(channel, 16)).join(", ");
  }

  function applyColors(value) {
    const customKhali = normalizeHex(value?.colors?.khali);
    const customLewis = normalizeHex(value?.colors?.lewis);
    const base = normalizeHex(value?.colors?.base) || DEFAULTS.colors.base;
    const appearance = root.dataset.appearance === "dark" ? "dark" : "light";
    const darkKhali = blend(customKhali || DEFAULTS.colors.khali, "#77716F", 0.38);
    const darkLewis = blend(customLewis || DEFAULTS.colors.lewis, "#747A76", 0.38);
    const properties = {
      "--site-bg-top": tint(base, "#FFFCF5", 0.02),
      "--site-bg-bottom": tint(base, "#F1F3EA", 0.10),
      "--site-surface": tint(base, "#FFFCF7", 0.03),
      "--site-deep": tint(base, "#34443B", 0.10),
      "--site-text": tint(base, "#303C35", 0.05),
      "--site-muted": tint(base, "#627167", 0.08),
      "--site-card": "rgba(" + rgb(base) + ", 0.035)",
      "--site-edge": "rgba(" + rgb(base) + ", 0.14)",
      "--yellow": appearance === "dark" ? darkKhali : customKhali,
      "--yellow-deep": appearance === "dark" ? blend(darkKhali, "#FFFFFF", 0.24) : customKhali && (customKhali === DEFAULTS.colors.khali ? "#78393B" : mix(customKhali, 0, 0.42)),
      "--accent-rgb": appearance === "dark" ? rgb(darkKhali) : customKhali && rgb(customKhali),
      "--accent-deep-rgb": appearance === "dark" ? rgb(blend(darkKhali, "#FFFFFF", 0.24)) : customKhali && rgb(customKhali === DEFAULTS.colors.khali ? "#78393B" : mix(customKhali, 0, 0.42)),
      "--accent-light": appearance === "dark" ? blend(darkKhali, "#E4E0DC", 0.28) : customKhali && mix(customKhali, 255, 0.65),
      "--accent-shadow": appearance === "dark" ? blend(darkKhali, "#111412", 0.32) : customKhali && mix(customKhali, 0, 0.2),
      "--blue": appearance === "dark" ? darkLewis : customLewis,
      "--blue-deep": appearance === "dark" ? blend(darkLewis, "#FFFFFF", 0.22) : customLewis && (customLewis === DEFAULTS.colors.lewis ? "#345944" : mix(customLewis, 0, 0.42)),
      "--lewis-rgb": appearance === "dark" ? rgb(darkLewis) : customLewis && rgb(customLewis),
      "--lewis-deep-rgb": appearance === "dark" ? rgb(blend(darkLewis, "#FFFFFF", 0.22)) : customLewis && rgb(customLewis === DEFAULTS.colors.lewis ? "#345944" : mix(customLewis, 0, 0.42)),
      "--dark-bg-top": blend(base, "#343836", 0.86),
      "--dark-bg-bottom": blend(base, "#252826", 0.9),
      "--dark-surface": blend(base, "#393D3A", 0.87),
      "--dark-edge": "rgba(225, 230, 226, 0.16)",
    };
    for (const [property, color] of Object.entries(properties)) {
      if (color) root.style.setProperty(property, color);
      else root.style.removeProperty(property);
    }
    const meta = document.querySelector?.('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue("--bg-bottom").trim();
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

  window.addEventListener("session-appearance-change", () => applyColors(sourceValue));

  if (!isAppAuthenticated()) return;
  try {
    reference = initializeFirebaseDatabase().ref("settings");
    reference.on("value", snapshot => {
      const value = snapshot.val();
      sourceValue = value;
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
