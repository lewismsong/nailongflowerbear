(() => {
  "use strict";
  const dateFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", month: "2-digit", day: "2-digit"
  });
  function updateSeasonalTheme() {
    const parts = dateFormat.formatToParts(new Date());
    const month = parts.find(part => part.type === "month").value;
    const day = parts.find(part => part.type === "day").value;
    const birthday = month === "11" && day === "30";
    const theme = birthday ? "birthday" : "autumn";
    if (document.documentElement.dataset.season === theme) return;
    document.documentElement.dataset.season = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = birthday ? "#F4DFED" : "#F3DDC1";
  }
  updateSeasonalTheme();
  setInterval(() => { if (!document.hidden) updateSeasonalTheme(); }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateSeasonalTheme();
  });
})();
