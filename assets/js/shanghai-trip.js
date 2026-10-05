(() => {
  const start = Date.parse('2026-11-20T00:00:00+08:00');
  const endExclusive = Date.parse('2026-12-14T00:00:00+08:00');
  const day = 86400000;
  window.shanghaiTrip = {
    start, endExclusive, dayCount: Math.round((endExclusive - start) / day),
    label: 'nov 20 – dec 13, 2026',
    countdown(now = Date.now()) {
      if (now >= endExclusive) return "we'll always have shanghai 🤍";
      if (now >= start) return 'day ' + (Math.floor((now - start) / day) + 1) + ' in shanghai 🥟';
      const seconds = Math.floor((start - now) / 1000);
      return Math.floor(seconds / 86400) + 'd ' + Math.floor(seconds / 3600) % 24 + 'h '
        + Math.floor(seconds / 60) % 60 + 'm ' + seconds % 60 + 's until shanghai 🥟';
    },
    dateForDay(index) { return new Date(Date.UTC(2026, 10, 20 + index)); }
  };
  const timer = document.getElementById('shanghai-countdown');
  if (timer) {
    const render = () => { timer.textContent = window.shanghaiTrip.countdown(); };
    render(); setInterval(render, 1000);
  }
})();
