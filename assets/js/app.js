console.log("lewiskhalico v2.6");

const $ = (id) => document.getElementById(id);
const setupEl = $("setup");
const mainEl = $("main");
const nameIn = $("name-in");
const startBtn = $("start-btn");
const beacon = $("beacon");
const beaconEmoji = $("beacon-emoji");
const beaconLabel = $("beacon-label");
const beaconTiny = $("beacon-tiny");
const ringFg = $("ring-fg");
const CIRCUMFERENCE = 2 * Math.PI * 92;
ringFg.setAttribute("stroke-dasharray", CIRCUMFERENCE);

let name = localStorage.getItem("ily:name") || null;
let events = [];
let db = null;
let eventsRef = null;
let prevIncoming = null;
let adjust = {};
let adminMode = false;
let call = null;
let missSending = false;
let resolveServerClock;
const serverClockReady = new Promise((resolve) => { resolveServerClock = resolve; });

const norm = (s) => (s || "").trim().toLowerCase();
let whenCache = {};

// adjustments are stored per Toronto day so they count in the daily battle too
function writeAdjust(person, delta) {
  if (!db) return;
  db.ref("adjust/" + torontoDayKey(serverNow()) + "/" + person).transaction((v) => (v || 0) + delta);
}
function adjustTotal(person) {
  let sum = 0;
  for (const key in adjust) {
    const v = adjust[key];
    if (typeof v === "number") { if (key === person) sum += v; } // legacy flat shape
    else if (v && typeof v === "object") sum += Number(v[person]) || 0;
  }
  return sum;
}
// misses sent from midnight to 6am count double
const ptsOf = (e) => (e.x2 ? 2 : 1);
function personPoints(person) { return events.filter((e) => norm(e.from) === person).reduce((s, e) => s + ptsOf(e), 0); }
function totalFor(person) { return personPoints(person) + adjustTotal(person); }
// points for one Toronto day (misses + that day's adjustments)
function dayPoints(person, key) {
  let s = events.filter((e) => norm(e.from) === person && torontoDayKey(e.at) === key).reduce((sum, e) => sum + ptsOf(e), 0);
  const a = adjust[key];
  if (a && typeof a === "object") s += Number(a[person]) || 0;
  return s;
}
function todayFor(person) { return dayPoints(person, torontoDayKey(serverNow())); }

// server-synced clock: Google's time, immune to device clock changes
let serverOffset = 0;
const serverNow = () => Date.now() + serverOffset;
function hourFor(person) {
  const tz = TIME_ZONES[person];
  const d = new Date(serverNow());
  if (!tz) return d.getHours();
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(d)) % 24;
}

const configured = Boolean(firebaseConfig.databaseURL);

function ago(t, now) {
  const s = Math.floor((now - t) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function spawnHearts(n) {
  const sky = $("sky");
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "heart-float";
    el.textContent = "🤍";
    el.style.left = (12 + Math.random() * 76) + "%";
    el.style.fontSize = (14 + Math.random() * 16) + "px";
    el.style.animationDelay = (Math.random() * 0.5) + "s";
    el.style.setProperty("--drift", ((Math.random() - 0.5) * 60) + "px");
    sky.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
}

function myEvents() { return events.filter((e) => norm(e.from) === norm(name)); }
function theirEvents() { return events.filter((e) => norm(e.from) !== norm(name)); }
function myLastAt() {
  const m = myEvents();
  const fromFeed = m.length ? m[m.length - 1].at : 0;
  const fromLocal = Number(localStorage.getItem("ily:lastSent") || 0);
  return Math.max(fromFeed, fromLocal);
}

function render() {
  const now = serverNow();
  const remaining = Math.min(COOLDOWN_MS, Math.max(0, COOLDOWN_MS - (now - myLastAt())));
  const cooling = remaining > 0;
  const onCall = !!(call && call.on);

  const me = norm(name);
  const bonusNow = hourFor(me) < 6;

  // beacon
  beacon.disabled = cooling || onCall || missSending;
  beacon.classList.toggle("cooling", cooling && !onCall);
  beacon.classList.toggle("on-call", onCall);
  beaconEmoji.textContent = onCall ? "📞" : cooling ? "⏳" : (bonusNow ? "🤍🤍" : "🤍");
  beaconLabel.textContent = onCall ? "on call" : cooling ? Math.ceil(remaining / 1000) + "s" : "I miss you";
  beaconTiny.textContent = onCall ? "misses paused" : "until your next miss";
  beaconTiny.classList.toggle("hidden", !cooling && !onCall);
  ringFg.style.display = cooling && !onCall ? "" : "none";
  ringFg.setAttribute("stroke-dashoffset", CIRCUMFERENCE * (1 - remaining / COOLDOWN_MS));

  // bonus hours indicator (sender's local midnight–6am)
  $("bonus-note").classList.toggle("hidden", !bonusNow);

  // partner clock — shows the other person's local time
  const partner = me === "lewis" ? "khali" : me === "khali" ? "lewis" : null;
  const pc = $("partner-clock");
  if (partner) {
    pc.classList.remove("hidden");
    $("pc-label").textContent = partner + (partner.endsWith("s") ? "' time" : "'s time");
    const nowD = new Date(serverNow());
    const timeStr = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONES[partner] }).format(nowD);
    const pHr = hourFor(partner);
    const icon = pHr >= 22 || pHr < 6 ? "🌙 " : pHr < 9 ? "🌅 " : pHr < 18 ? "☀️ " : "🌆 ";
    $("pc-time").textContent = icon + timeStr;
  } else {
    pc.classList.add("hidden");
  }

  // france countdown
  const franceDays = Math.ceil((FRANCE_DATE - new Date(serverNow())) / 86400000);
  $("france-box").textContent = franceDays > 1 ? "🇫🇷 " + franceDays + " days until france"
    : franceDays === 1 ? "🇫🇷 1 day until france!!"
    : "🇫🇷 it's france time 🥖";

  // tally — khali vs lewis daily miss counters (reset at Toronto midnight)
  $("their-count").textContent = Math.max(0, todayFor("khali"));
  $("my-count").textContent = Math.max(0, todayFor("lewis"));
  // all-time combined total — this one never resets
  $("total-count").textContent = Math.max(0, totalFor("khali") + totalFor("lewis"));

  // secret per-person all-time stats (revealed in admin mode)
  const sends = (p) => events.filter((e) => norm(e.from) === p).length;
  $("secret-stats").textContent = "🐻‍❄️ khali: " + sends("khali") + " sent (" + Math.max(0, totalFor("khali")) + " pts) · 🐻 lewis: " + sends("lewis") + " sent (" + Math.max(0, totalFor("lewis")) + " pts)";
}

let feedExpanded = false;

function renderFeed() {
  const feedEl = $("feed");
  // group consecutive misses from the same person
  const groups = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && norm(last.from) === norm(e.from)) last.items.push(e);
    else groups.push({ from: e.from, items: [e] });
  }
  const items = (feedExpanded ? groups.slice() : groups.slice(-5)).reverse();
  const moreBtn = $("more-btn");
  moreBtn.classList.toggle("hidden", groups.length <= 5);
  moreBtn.textContent = feedExpanded ? "see less" : "see more (" + groups.length + " total)";
  $("empty").classList.toggle("hidden", items.length > 0);
  feedEl.innerHTML = "";
  for (const g of items) {
    const latest = g.items[g.items.length - 1];
    const count = g.items.length;
    const pts = g.items.reduce((s, e) => s + ptsOf(e), 0);
    if (!whenCache[latest.at]) whenCache[latest.at] = ago(latest.at, serverNow());
    const mineItem = norm(g.from) === norm(name);
    const li = document.createElement("li");
    if (norm(g.from) === "khali") li.classList.add("khali");
    if (norm(g.from) === "lewis") li.classList.add("lewis");
    if (count > 1) li.classList.add("multi");
    const what = document.createElement("span");
    what.className = "what";
    what.textContent = (mineItem ? "💌 you sent a miss" : "💌 " + g.from + " missed you") + (count > 1 ? " ×" + count : "");
    if (pts > count) {
      const hasNight = g.items.some((e) => e.x2);
      const labels = [];
      if (hasNight) labels.push("🌙 ×2");
      const badge = document.createElement("span");
      badge.className = "x2";
      badge.textContent = " " + labels.join(" ") + " · worth " + pts;
      what.appendChild(badge);
    }
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = whenCache[latest.at];
    li.append(what, when);
    feedEl.appendChild(li);
  }
}

function torontoDayKey(t) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: GAME_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
}

function timeLeftToronto() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: GAME_TZ, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(serverNow()));
  const h = Number(parts.find((p) => p.type === "hour").value) % 24;
  const m = Number(parts.find((p) => p.type === "minute").value);
  const left = 24 * 60 - (h * 60 + m);
  return Math.floor(left / 60) + "h " + (left % 60) + "m";
}

function renderCal() {
  const grid = $("cal-grid");
  // bucket points into Toronto days (x2 misses worth 2)
  const days = {};
  for (const e of events) {
    const key = torontoDayKey(e.at);
    const rec = days[key] || (days[key] = { k: 0, l: 0 });
    const v = ptsOf(e);
    if (norm(e.from) === "khali") rec.k += v;
    if (norm(e.from) === "lewis") rec.l += v;
  }
  // dated adjustments (khaliwins bypass + on-call bonuses) count in the day they happened
  for (const key in adjust) {
    const v = adjust[key];
    if (v && typeof v === "object") {
      const rec = days[key] || (days[key] = { k: 0, l: 0 });
      rec.k += Number(v.khali) || 0;
      rec.l += Number(v.lewis) || 0;
    }
  }
  const todayKey = torontoDayKey(serverNow());
  grid.innerHTML = "";
  for (let i = 0; i <= 27; i++) {
    const key = torontoDayKey(serverNow() - i * 86400000);
    const rec = days[key] || { k: 0, l: 0 };
    const cell = document.createElement("div");
    cell.className = "day";
    if (rec.k > rec.l) cell.classList.add("k");
    else if (rec.l > rec.k) cell.classList.add("l");
    else if (rec.k > 0) cell.classList.add("b");
    if (key === todayKey) cell.classList.add("today");
    if (rec.k > 0 || rec.l > 0) {
      const sk = document.createElement("span");
      sk.className = "ds ds-k";
      sk.textContent = rec.k;
      const sl = document.createElement("span");
      sl.className = "ds ds-l";
      sl.textContent = rec.l;
      cell.append(sk, sl);
    }
    cell.title = key + " · khali " + rec.k + " – " + rec.l + " lewis";
    grid.appendChild(cell);
  }
  // trophy count: completed days only — today isn't decided yet
  let kWins = 0, lWins = 0;
  for (const key in days) {
    if (key === todayKey) continue;
    const r = days[key];
    if (r.k > r.l) kWins++;
    else if (r.l > r.k) lWins++;
  }
  $("streak").textContent = "🏆 khali " + kWins + " – " + lWins + " lewis";
  const t = days[todayKey] || { k: 0, l: 0 };
  $("today-score").textContent = "today: khali " + t.k + " – " + t.l + " lewis · " + timeLeftToronto() + " left in the day";
}

function showMain() {
  setupEl.classList.add("hidden");
  mainEl.classList.remove("hidden");
  $("who").textContent = name;
  render();
  renderFeed();
  renderCal();
}

function showSetup() {
  mainEl.classList.add("hidden");
  setupEl.classList.remove("hidden");
  if (!configured) $("config-warn").classList.remove("hidden");
}

// ---- wire up ----
nameIn.addEventListener("input", () => { startBtn.disabled = !nameIn.value.trim(); });
nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && nameIn.value.trim()) startBtn.click(); });

startBtn.addEventListener("click", () => {
  const n = nameIn.value.trim();
  if (!n) return;
  if (!["khali", "lewis"].includes(norm(n))) {
    $("name-err").textContent = "that's not khali, fix it.";
    return;
  }
  $("name-err").textContent = "";
  name = n;
  localStorage.setItem("ily:name", n);
  prevIncoming = null;
  showMain();
});

$("reset-btn").addEventListener("click", () => {
  localStorage.removeItem("ily:name");
  name = null;
  nameIn.value = "";
  startBtn.disabled = true;
  showSetup();
});

// ---- on-call crediting ----
// every full 45 minutes of an active call adds +45 to both counters, exactly once,
// no matter how many devices are open (the transaction claims blocks atomically)
function creditCallBlocks(alsoEnd) {
  if (!db) return;
  let delta = 0;
  db.ref("call").transaction((c) => {
    if (!c || !c.on || typeof c.since !== "number") return alsoEnd ? { on: false } : c;
    const blocks = Math.floor((serverNow() - c.since) / CALL_BLOCK_MS);
    delta = Math.max(0, blocks - (c.credited || 0));
    if (alsoEnd) return { on: false };
    if (delta === 0) return; // nothing new — abort, no write
    return { on: true, since: c.since, credited: blocks };
  }, (error, committed) => {
    if (error) {
      console.error("call credit update failed:", error);
      return;
    }
    if (committed && delta > 0) {
      writeAdjust("khali", delta * CALL_BLOCK_PTS);
      writeAdjust("lewis", delta * CALL_BLOCK_PTS);
    }
  });
}

function renderCall() {
  const t = $("call-toggle"), sub = $("call-sub");
  const on = !!(call && call.on);
  if (t.checked !== on) t.checked = on;
  if (on && typeof call.since === "number") {
    const elapsed = Math.max(0, serverNow() - call.since);
    const h = Math.floor(elapsed / 3600000), m = Math.floor((elapsed % 3600000) / 60000);
    const nextIn = Math.ceil((CALL_BLOCK_MS - (elapsed % CALL_BLOCK_MS)) / 60000);
    sub.textContent = "on call for " + (h ? h + "h " : "") + m + "m";
  } else {
    sub.textContent = "flip this when you're on a call.";
  }
}

$("call-toggle").addEventListener("change", (e) => {
  if (!db) { e.target.checked = false; return; }
  if (e.target.checked) {
    db.ref("call").set({ on: true, since: firebase.database.ServerValue.TIMESTAMP, credited: 0 });
  } else {
    creditCallBlocks(true); // pay out any earned blocks, then end the call
  }
});

$("more-btn").addEventListener("click", () => {
  feedExpanded = !feedExpanded;
  renderFeed();
});

// hidden counter controls: tap the trademark, enter the password
function setAdmin(on) {
  adminMode = on;
  document.querySelectorAll(".adj-btn").forEach((b) => b.classList.toggle("hidden", !on));
  $("secret-stats").classList.toggle("hidden", !on);
}
document.querySelector(".trademark").addEventListener("click", () => {
  if (adminMode) { setAdmin(false); return; }
  const pw = prompt("password?");
  if (pw === "khaliwins") setAdmin(true);
  else if (pw !== null) alert("no.");
});
document.querySelectorAll(".adj-btn").forEach((b) => {
  b.addEventListener("click", () => {
    if (!adminMode || !db) return;
    const p = b.dataset.p, d = Number(b.dataset.d);
    if (d < 0 && todayFor(p) <= 0) return; // counters can't go below zero
    writeAdjust(p, d);
  });
});

$("refresh-btn").addEventListener("click", async () => {
  const sure = confirm("⚠️ warning: this erases TODAY's misses for both of you and resets today's counters to zero. past days and the total stay. continue?");
  if (!sure) return;
  const pw = prompt("enter the password to refresh the misses:");
  if (pw === null) return;
  if (pw !== "lewiswins") {
    alert("wrong password — the misses are safe 🐻");
    return;
  }
  try {
    if (!eventsRef) throw new Error("not connected");
    const todayKey = torontoDayKey(serverNow());
    const updates = {};
    for (const e of events) if (e.id && torontoDayKey(e.at) === todayKey) updates[e.id] = null;
    if (Object.keys(updates).length) await eventsRef.update(updates);
    await db.ref("adjust/" + todayKey).remove();
    alert("today's misses cleared — fresh day 🧹");
  } catch (error) {
    console.error("miss reset failed:", error);
    $("err").textContent = "couldn't clear — check your connection and try again";
  }
});

beacon.addEventListener("click", async () => {
  if (beacon.disabled || !name || missSending) return;
  missSending = true;
  render();
  $("err").textContent = "";
  try {
    if (!eventsRef) throw new Error("not connected");
    await serverClockReady;
    const bonus = hourFor(norm(name)) < 6;
    whenCache = {}; // recompute all "x min ago" times on every press
    const ev = { from: name, at: firebase.database.ServerValue.TIMESTAMP };
    if (bonus) ev.x2 = true;
    await eventsRef.push(ev);
    localStorage.setItem("ily:lastSent", String(serverNow()));
    spawnHearts(7);
    render();
    renderFeed();
  } catch (error) {
    console.error("miss send failed:", error);
    $("err").textContent = "couldn't send — check your connection and try again";
  } finally {
    missSending = false;
    render();
  }
});

// ---- firebase ----
if (configured) {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    eventsRef = db.ref("misses");
    db.ref(".info/serverTimeOffset").on("value", (s) => {
      serverOffset = s.val() || 0;
      resolveServerClock();
    });
    db.ref("adjust").on("value", (s) => { adjust = s.val() || {}; if (name) render(); });
    db.ref("call").on("value", (s) => { call = s.val(); renderCall(); if (name) render(); });
    eventsRef.on("value", (snap) => {
      try {
        const val = snap.val() || {};
        // keep only well-formed misses (with their ids, so day-resets can target them)
        events = Object.entries(val)
          .map(([id, e]) => (e && typeof e === "object" ? { id, ...e } : null))
          .filter((e) => e && typeof e.from === "string" && typeof e.at === "number" && e.at > 0)
          .sort((a, b) => a.at - b.at);
        const incoming = theirEvents().length;
        if (name && prevIncoming !== null && incoming > prevIncoming) {
          spawnHearts(10);
          try {
            if (navigator.vibrate) navigator.vibrate([90, 50, 90]);
          } catch (error) {
            console.warn("vibration failed:", error);
          }
        }
        prevIncoming = incoming;
        if (name) { render(); renderFeed(); renderCal(); }
      } catch (error) {
        console.error("data update failed:", error);
      }
    }, (error) => {
      console.error("firebase data subscription failed:", error);
      $("err").textContent = "can't reach the misses database — check the Firebase rules";
    });
  } catch (error) {
    console.error("firebase initialization failed:", error);
  }
}

// tick every second for cooldown and relative times
let lastDayKey = null;
setInterval(() => {
  if (name && !mainEl.classList.contains("hidden")) {
    try {
      const dk = torontoDayKey(serverNow());
      if (dk !== lastDayKey) {
        lastDayKey = dk;
        whenCache = {}; // new day: refresh all feed timestamps + roll the calendar
        renderFeed();
        renderCal();
      }
      render(); renderCall(); if (call && call.on) creditCallBlocks(false);
    } catch (error) {
      console.error("render failed:", error);
    }
  }
}, 1000);

// self-healing: when the app is brought back to the foreground after 30+ minutes,
// force-fetch the latest deployed version (cache-busting query beats stale caches)
const loadedAt = Date.now();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - loadedAt > 30 * 60 * 1000) {
    location.replace(location.pathname + "?r=" + Date.now());
  }
});

// initial screen
if (name && configured) showMain(); else showSetup();
