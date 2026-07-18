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
const partnerClock = $("partner-clock");
const partnerClockLabel = $("pc-label");
const partnerClockTime = $("pc-time");
const franceBox = $("france-box");
const CIRCUMFERENCE = 2 * Math.PI * 92;
const RECENT_FEED_GROUPS = 5;
const CALENDAR_DAYS = 28;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
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
const serverClockReady = new Promise((resolve) => {
  resolveServerClock = resolve;
});

const normalizeName = (value) => (value || "").trim().toLowerCase();
let whenCache = {};

// adjustments are stored per toronto day so they count in the daily battle too
function writeAdjust(person, delta) {
  if (!db) return;
  db.ref("adjust/" + torontoDayKey(serverNow()) + "/" + person).transaction((v) => (v || 0) + delta);
}
function adjustTotal(person) {
  let sum = 0;
  for (const key in adjust) {
    const value = adjust[key];
    if (typeof value === "number") {
      if (key === person) sum += value; // legacy flat shape
    } else if (value && typeof value === "object") {
      sum += Number(value[person]) || 0;
    }
  }
  return sum;
}

function personPoints(person) {
  return events.filter((event) => normalizeName(event.from) === person).length;
}

function totalFor(person) {
  return personPoints(person) + adjustTotal(person);
}

// misses for one toronto day, including that day's adjustments
function dayPoints(person, key) {
  let total = events.filter((event) => normalizeName(event.from) === person && torontoDayKey(event.at) === key).length;
  const dayAdjustments = adjust[key];
  if (dayAdjustments && typeof dayAdjustments === "object") {
    total += Number(dayAdjustments[person]) || 0;
  }
  return total;
}

function todayFor(person) {
  return dayPoints(person, torontoDayKey(serverNow()));
}

// server-synced clock is immune to device clock changes
let serverOffset = 0;
const serverNow = () => Date.now() + serverOffset;
function hourFor(person) {
  const timeZone = TIME_ZONES[person];
  const date = new Date(serverNow());
  if (!timeZone) return date.getHours();
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).format(date)) % 24;
}

const configured = Boolean(firebaseConfig.databaseURL);

function ago(timestamp, now) {
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function spawnHearts(count) {
  const sky = $("sky");
  for (let index = 0; index < count; index++) {
    const heart = document.createElement("div");
    heart.className = "heart-float";
    heart.textContent = "🤍";
    heart.style.left = (12 + Math.random() * 76) + "%";
    heart.style.fontSize = (14 + Math.random() * 16) + "px";
    heart.style.animationDelay = (Math.random() * 0.5) + "s";
    heart.style.setProperty("--drift", ((Math.random() - 0.5) * 60) + "px");
    sky.appendChild(heart);
    setTimeout(() => heart.remove(), 3200);
  }
}

function myEvents() {
  const normalizedName = normalizeName(name);
  return events.filter((event) => normalizeName(event.from) === normalizedName);
}

function theirEvents() {
  const normalizedName = normalizeName(name);
  return events.filter((event) => normalizeName(event.from) !== normalizedName);
}

function myLastAt() {
  const sentEvents = myEvents();
  const fromFeed = sentEvents.length ? sentEvents[sentEvents.length - 1].at : 0;
  const fromLocal = Number(localStorage.getItem("ily:lastSent") || 0);
  return Math.max(fromFeed, fromLocal);
}

function renderBeacon(now) {
  const remaining = Math.min(COOLDOWN_MS, Math.max(0, COOLDOWN_MS - (now - myLastAt())));
  const cooling = remaining > 0;
  const onCall = !!(call && call.on);

  beacon.disabled = cooling || onCall || missSending;
  beacon.classList.toggle("cooling", cooling && !onCall);
  beacon.classList.toggle("on-call", onCall);
  beaconEmoji.textContent = onCall ? "📞" : cooling ? "⏳" : "🤍";
  beaconLabel.textContent = onCall ? "on call" : cooling ? Math.ceil(remaining / 1000) + "s" : "I miss you";
  beaconTiny.textContent = onCall ? "misses paused" : "until your next miss";
  beaconTiny.classList.toggle("hidden", !cooling && !onCall);
  ringFg.style.display = cooling && !onCall ? "" : "none";
  ringFg.setAttribute("stroke-dashoffset", CIRCUMFERENCE * (1 - remaining / COOLDOWN_MS));
}

function renderPartnerClock(normalizedName, now) {
  const partner = normalizedName === "lewis" ? "khali" : normalizedName === "khali" ? "lewis" : null;
  if (partner) {
    partnerClock.classList.remove("hidden");
    partnerClockLabel.textContent = partner + (partner.endsWith("s") ? "' time" : "'s time");
    const time = new Intl.DateTimeFormat([], {
      hour: "numeric",
      minute: "2-digit",
      timeZone: TIME_ZONES[partner],
    }).format(new Date(now));
    const partnerHour = hourFor(partner);
    const icon = partnerHour >= 22 || partnerHour < 6 ? "🌙 " : partnerHour < 9 ? "🌅 " : partnerHour < 18 ? "☀️ " : "🌆 ";
    partnerClockTime.textContent = icon + time;
  } else {
    partnerClock.classList.add("hidden");
  }
}

function renderFranceCountdown(now) {
  const franceDays = Math.ceil((FRANCE_DATE - new Date(now)) / MILLISECONDS_PER_DAY);
  franceBox.textContent = franceDays > 1 ? "🇫🇷 " + franceDays + " days until france"
    : franceDays === 1 ? "🇫🇷 1 day until france!!"
    : "🇫🇷 it's france time 🥖";
}

function renderStats() {
  $("their-count").textContent = Math.max(0, todayFor("khali"));
  $("my-count").textContent = Math.max(0, todayFor("lewis"));
  $("total-count").textContent = Math.max(0, totalFor("khali") + totalFor("lewis"));

  const sends = (person) => events.filter((event) => normalizeName(event.from) === person).length;
  $("secret-stats").textContent = "🐻‍❄️ khali: " + sends("khali") + " sent (" + Math.max(0, totalFor("khali")) + " pts) · 🐻 lewis: " + sends("lewis") + " sent (" + Math.max(0, totalFor("lewis")) + " pts)";
}

function render() {
  const now = serverNow();
  const normalizedName = normalizeName(name);
  renderBeacon(now);
  renderPartnerClock(normalizedName, now);
  renderFranceCountdown(now);
  renderStats();
}

let feedExpanded = false;

function renderFeed() {
  const feedEl = $("feed");
  // group consecutive misses from the same person
  const groups = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && normalizeName(last.from) === normalizeName(event.from)) {
      last.items.push(event);
    } else {
      groups.push({ from: event.from, items: [event] });
    }
  }
  const items = (feedExpanded ? groups.slice() : groups.slice(-RECENT_FEED_GROUPS)).reverse();
  const moreBtn = $("more-btn");
  moreBtn.classList.toggle("hidden", groups.length <= RECENT_FEED_GROUPS);
  moreBtn.textContent = feedExpanded ? "see less" : "see more (" + groups.length + " total)";
  $("empty").classList.toggle("hidden", items.length > 0);
  feedEl.innerHTML = "";
  for (const group of items) {
    const latest = group.items[group.items.length - 1];
    const count = group.items.length;
    if (!whenCache[latest.at]) whenCache[latest.at] = ago(latest.at, serverNow());
    const normalizedSender = normalizeName(group.from);
    const mineItem = normalizedSender === normalizeName(name);
    const li = document.createElement("li");
    if (normalizedSender === "khali") li.classList.add("khali");
    if (normalizedSender === "lewis") li.classList.add("lewis");
    if (count > 1) li.classList.add("multi");
    const what = document.createElement("span");
    what.className = "what";
    what.textContent = (mineItem ? "💌 you sent a miss" : "💌 " + group.from + " missed you") + (count > 1 ? " ×" + count : "");
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
  const hours = Number(parts.find((part) => part.type === "hour").value) % 24;
  const minutes = Number(parts.find((part) => part.type === "minute").value);
  const minutesLeft = 24 * 60 - (hours * 60 + minutes);
  return Math.floor(minutesLeft / 60) + "h " + (minutesLeft % 60) + "m";
}

function renderCal() {
  const grid = $("cal-grid");
  // bucket misses into toronto days
  const days = {};
  for (const event of events) {
    const key = torontoDayKey(event.at);
    const record = days[key] || (days[key] = { k: 0, l: 0 });
    const sender = normalizeName(event.from);
    if (sender === "khali") record.k++;
    if (sender === "lewis") record.l++;
  }
  // dated adjustments (khaliwins bypass + on-call bonuses) count in the day they happened
  for (const key in adjust) {
    const dayAdjustments = adjust[key];
    if (dayAdjustments && typeof dayAdjustments === "object") {
      const record = days[key] || (days[key] = { k: 0, l: 0 });
      record.k += Number(dayAdjustments.khali) || 0;
      record.l += Number(dayAdjustments.lewis) || 0;
    }
  }
  const todayKey = torontoDayKey(serverNow());
  grid.innerHTML = "";
  for (let index = 0; index < CALENDAR_DAYS; index++) {
    const key = torontoDayKey(serverNow() - index * MILLISECONDS_PER_DAY);
    const record = days[key] || { k: 0, l: 0 };
    const cell = document.createElement("div");
    cell.className = "day";
    if (record.k > record.l) cell.classList.add("k");
    else if (record.l > record.k) cell.classList.add("l");
    else if (record.k > 0) cell.classList.add("b");
    if (key === todayKey) cell.classList.add("today");
    if (record.k > 0 || record.l > 0) {
      const khaliScore = document.createElement("span");
      khaliScore.className = "ds ds-k";
      khaliScore.textContent = record.k;
      const lewisScore = document.createElement("span");
      lewisScore.className = "ds ds-l";
      lewisScore.textContent = record.l;
      cell.append(khaliScore, lewisScore);
    }
    cell.title = key + " · khali " + record.k + " – " + record.l + " lewis";
    grid.appendChild(cell);
  }
  // trophy count: completed days only — today isn't decided yet
  let khaliWins = 0;
  let lewisWins = 0;
  for (const key in days) {
    if (key === todayKey) continue;
    const record = days[key];
    if (record.k > record.l) khaliWins++;
    else if (record.l > record.k) lewisWins++;
  }
  $("streak").textContent = "🏆 khali " + khaliWins + " – " + lewisWins + " lewis";
  const today = days[todayKey] || { k: 0, l: 0 };
  $("today-score").textContent = "today: khali " + today.k + " – " + today.l + " lewis · " + timeLeftToronto() + " left in the day";
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
  const enteredName = nameIn.value.trim();
  if (!enteredName) return;
  if (!["khali", "lewis"].includes(normalizeName(enteredName))) {
    $("name-err").textContent = "that's not khali, fix it.";
    return;
  }
  $("name-err").textContent = "";
  name = enteredName;
  localStorage.setItem("ily:name", enteredName);
  prevIncoming = null;
  showMain();
});

$("france-box").addEventListener("click", () => { location.href = "france.html?v=1"; });

$("reset-btn").addEventListener("click", () => {
  localStorage.removeItem("ily:name");
  name = null;
  nameIn.value = "";
  startBtn.disabled = true;
  showSetup();
});

function renderCall() {
  const callToggle = $("call-toggle");
  const callSubtitle = $("call-sub");
  const on = !!(call && call.on);
  if (callToggle.checked !== on) callToggle.checked = on;
  if (on && typeof call.since === "number") {
    const elapsed = Math.max(0, serverNow() - call.since);
    const hours = Math.floor(elapsed / (60 * 60 * 1000));
    const minutes = Math.floor((elapsed % (60 * 60 * 1000)) / (60 * 1000));
    callSubtitle.textContent = "on call for " + (hours ? hours + "h " : "") + minutes + "m";
  } else {
    callSubtitle.textContent = "flip this when you're on a call.";
  }
}

$("call-toggle").addEventListener("change", (e) => {
  if (!db) {
    e.target.checked = false;
    return;
  }
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
  if (adminMode) {
    setAdmin(false);
    return;
  }
  const pw = prompt("password?");
  if (pw === "khaliwins") setAdmin(true);
  else if (pw !== null) alert("no.");
});
document.querySelectorAll(".adj-btn").forEach((b) => {
  b.addEventListener("click", () => {
    if (!adminMode || !db) return;
    const person = b.dataset.p;
    const delta = Number(b.dataset.d);
    if (delta < 0 && todayFor(person) <= 0) return; // counters can't go below zero
    writeAdjust(person, delta);
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
    for (const event of events) {
      if (event.id && torontoDayKey(event.at) === todayKey) updates[event.id] = null;
    }
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
    whenCache = {}; // recompute all "x min ago" times on every press
    const ev = { from: name, at: firebase.database.ServerValue.TIMESTAMP };
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
        if (name) {
          render();
          renderFeed();
          renderCal();
        }
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
      render();
      renderCall();
      if (call && call.on) creditCallBlocks(false);
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
