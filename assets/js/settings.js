(() => {
  "use strict";

  const { normalizeHex, normalize, changes } = SettingsModel;
  const form = document.getElementById("settings-form");
  const fields = document.getElementById("settings-fields");
  const applyButton = document.getElementById("apply-settings");
  const cancelButton = document.getElementById("cancel-settings");
  const status = document.getElementById("settings-status");
  const dialog = document.getElementById("colour-dialog");
  const wheel = document.getElementById("colour-wheel");
  const context = wheel.getContext("2d");
  const brightness = document.getElementById("colour-brightness");
  const people = ["khali", "lewis"];
  let baseline;
  let draft;
  let saving = false;
  let editingPerson;
  let hue = 0;
  let saturation = 0;
  let value = 1;

  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
  }

  function validInputs() {
    return people.every(person => normalizeHex(document.getElementById(person + "-hex").value));
  }

  function updateApply() {
    applyButton.disabled = saving || !baseline || !validInputs() || !Object.keys(changes(baseline, draft)).length;
  }

  function setColour(person, colour, updateInput = true) {
    draft.colors[person] = colour;
    document.getElementById(person + "-swatch").style.backgroundColor = colour;
    const input = document.getElementById(person + "-hex");
    if (updateInput) input.value = colour;
    input.setAttribute("aria-invalid", "false");
    updateApply();
  }

  function renderDraft() {
    for (const person of people) setColour(person, draft.colors[person]);
    form.querySelector(`input[name="house"][value="${draft.house}"]`).checked = true;
    updateApply();
  }

  for (const person of people) {
    const input = document.getElementById(person + "-hex");
    input.addEventListener("input", () => {
      const colour = normalizeHex(input.value);
      input.setAttribute("aria-invalid", String(!colour));
      if (colour) {
        setColour(person, colour, false);
        message("");
      } else {
        updateApply();
        message("enter a six-digit hex colour, like #EDB878.", true);
      }
    });
    input.addEventListener("blur", () => {
      const colour = normalizeHex(input.value);
      if (colour) input.value = colour;
    });
    document.getElementById(person + "-swatch").addEventListener("click", () => {
      editingPerson = person;
      const channels = draft.colors[person].slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
      const [red, green, blue] = channels;
      const maximum = Math.max(...channels);
      const minimum = Math.min(...channels);
      const difference = maximum - minimum;
      value = maximum;
      saturation = maximum ? difference / maximum : 0;
      hue = !difference ? 0 : maximum === red ? 60 * (((green - blue) / difference + 6) % 6)
        : maximum === green ? 60 * ((blue - red) / difference + 2) : 60 * ((red - green) / difference + 4);
      brightness.value = Math.round(value * 100);
      document.getElementById("picker-title").textContent = person + "’s colour";
      document.getElementById("picker-hex").textContent = draft.colors[person];
      drawWheel();
      dialog.showModal();
    });
  }

  form.querySelectorAll('input[name="house"]').forEach(input => input.addEventListener("change", () => {
    draft.house = input.value;
    updateApply();
    message("");
  }));

  function hsvChannels(hue, saturation, value) {
    const chroma = value * saturation;
    const secondary = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const minimum = value - chroma;
    const sector = Math.floor(hue / 60) % 6;
    const channels = [[chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary],
      [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary]][sector];
    return channels.map(channel => Math.round((channel + minimum) * 255));
  }

  function drawWheel() {
    const radius = wheel.width / 2;
    const pixels = context.createImageData(wheel.width, wheel.height);
    for (let y = 0; y < wheel.height; y++) {
      for (let x = 0; x < wheel.width; x++) {
        const distance = Math.hypot(x - radius, y - radius);
        if (distance > radius - 2) continue;
        const angle = (Math.atan2(y - radius, x - radius) * 180 / Math.PI + 360) % 360;
        const offset = (y * wheel.width + x) * 4;
        pixels.data.set([...hsvChannels(angle, distance / radius, value), 255], offset);
      }
    }
    context.putImageData(pixels, 0, 0);
    const angle = hue * Math.PI / 180;
    context.beginPath();
    context.arc(radius + Math.cos(angle) * saturation * (radius - 3), radius + Math.sin(angle) * saturation * (radius - 3), 5, 0, Math.PI * 2);
    context.strokeStyle = "#FFFFFF";
    context.lineWidth = 3;
    context.stroke();
    context.strokeStyle = "#503B2E";
    context.lineWidth = 1;
    context.stroke();
  }

  function updatePicker() {
    const colour = "#" + hsvChannels(hue, saturation, value).map(channel => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
    setColour(editingPerson, colour);
    document.getElementById("picker-hex").textContent = colour;
    message("");
    drawWheel();
  }

  function pickAt(event) {
    const bounds = wheel.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    saturation = Math.min(1, Math.hypot(x, y) / (bounds.width / 2));
    updatePicker();
  }

  wheel.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    wheel.setPointerCapture(event.pointerId);
    pickAt(event);
  });
  wheel.addEventListener("pointermove", event => {
    if (wheel.hasPointerCapture(event.pointerId)) pickAt(event);
  });
  for (const type of ["pointerup", "pointercancel"]) wheel.addEventListener(type, event => {
    if (wheel.hasPointerCapture(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
  });
  wheel.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") hue = (hue + 355) % 360;
    if (event.key === "ArrowRight") hue = (hue + 5) % 360;
    if (event.key === "ArrowUp") saturation = Math.min(1, saturation + 0.05);
    if (event.key === "ArrowDown") saturation = Math.max(0, saturation - 0.05);
    updatePicker();
  });
  brightness.addEventListener("input", () => { value = Number(brightness.value) / 100; updatePicker(); });
  for (const id of ["close-picker", "done-picker"]) document.getElementById(id).addEventListener("click", () => dialog.close());

  cancelButton.addEventListener("click", event => { if (saving) event.preventDefault(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (applyButton.disabled) return;
    if (!window.confirm("Apply these settings? This will change the colours and Pakku’s house across all your devices. Are you sure?")) return;
    const updates = changes(baseline, draft);
    saving = true;
    fields.disabled = true;
    cancelButton.setAttribute("aria-disabled", "true");
    updateApply();
    message("applying your settings…");
    try {
      await window.appSettings.apply(updates);
      baseline = window.appSettings.current;
      draft = normalize(baseline);
      renderDraft();
      message("applied — your settings are synced across devices.");
    } catch (error) {
      console.error("could not apply settings:", error);
      message("couldn't apply your settings. your draft is still here — check your connection and try again.", true);
    } finally {
      saving = false;
      fields.disabled = false;
      cancelButton.removeAttribute("aria-disabled");
      updateApply();
    }
  });

  window.addEventListener("app-settings-change", event => {
    if (!baseline || saving) return;
    const dirty = !validInputs() || Object.keys(changes(baseline, draft)).length;
    if (dirty) {
      message("settings changed on another device. your draft is kept; apply will save only your edits.");
    } else {
      baseline = normalize(event.detail);
      draft = normalize(baseline);
      renderDraft();
      message("settings updated from another device.");
    }
  });
  window.addEventListener("app-settings-error", () => message("couldn't sync settings — check your connection and reload to try again.", true));

  window.appSettings.ready.then(settings => {
    baseline = normalize(settings);
    draft = normalize(baseline);
    fields.disabled = false;
    renderDraft();
    message("");
  }).catch(error => {
    console.error("could not load settings:", error);
    message("couldn't load shared settings — check your connection and reload to try again.", true);
  });
})();
