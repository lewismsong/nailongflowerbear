(() => {
  "use strict";

  const DEFAULTS = { colors: { khali: "#EDB878", lewis: "#EF948F" }, house: "koala-tree" };
  const HOUSES = {
    temple: { label: "temple", image: "assets/images/optimized/chinese-temple.webp" },
    "cat-house": { label: "cat house", image: "assets/images/optimized/cat-house.webp" },
    "koala-tree": { label: "mango tree", image: "assets/images/optimized/mango-tree-autumn.webp" },
  };

  function normalizeHex(value) {
    if (typeof value !== "string") return null;
    const hex = value.trim().replace(/^#/, "");
    return /^[\da-f]{6}$/i.test(hex) ? "#" + hex.toUpperCase() : null;
  }

  function normalize(value) {
    return {
      colors: Object.fromEntries(Object.entries(DEFAULTS.colors).map(([person, color]) =>
        [person, normalizeHex(value?.colors?.[person]) || color])),
      house: Object.hasOwn(HOUSES, value?.house) ? value.house : DEFAULTS.house,
    };
  }

  function changes(previous, next) {
    const updates = {};
    for (const person of Object.keys(DEFAULTS.colors)) {
      if (previous.colors[person] !== next.colors[person]) updates["colors/" + person] = next.colors[person];
    }
    if (previous.house !== next.house) updates.house = next.house;
    return updates;
  }

  const model = { DEFAULTS, HOUSES, normalizeHex, normalize, changes };
  globalThis.SettingsModel = model;
  if (typeof module !== "undefined") module.exports = model;
})();
