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
const CIRCUMFERENCE = 2 * Math.PI * 92;
ringFg.setAttribute("stroke-dasharray", CIRCUMFERENCE);

let name = currentAuthenticatedUser();
const missHistory = new MissHistory(torontoDayKey);
let db = null;
let eventsRef = null;
let historyReady = false;
let historyRenderTimer = null;
let adjust = {};
let call = null;
let missSending = false;
let resolveServerClock;
const serverClockReady = new Promise((resolve) => {
  resolveServerClock = resolve;
});

const normalizeName = (value) => (value || "").trim().toLowerCase();

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
  return missHistory.count(person);
}

function totalFor(person) {
  return personPoints(person) + adjustTotal(person);
}

function allTimeAdjustment() {
  return Number(adjust.allTime) || 0;
}

// misses for one toronto day, including that day's adjustments
function dayPoints(person, key) {
  let total = missHistory.countOnDay(person, key);
  const dayAdjustments = adjust[key];
  if (dayAdjustments && typeof dayAdjustments === "object") {
    total += Number(dayAdjustments[person]) || 0;
  }
  return total;
}

// server-synced clock is immune to device clock changes
let serverOffset = 0;
const serverNow = () => Date.now() + serverOffset;
const hourFormatters = Object.fromEntries(Object.entries(TIME_ZONES).map(([person, timeZone]) =>
  [person, new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone })]));
const clockFormatters = Object.fromEntries(Object.entries(TIME_ZONES).map(([person, timeZone]) =>
  [person, new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit", timeZone })]));

function hourFor(person) {
  const timeZone = TIME_ZONES[person];
  const date = new Date(serverNow());
  if (!timeZone) return date.getHours();
  return Number(hourFormatters[person].format(date)) % 24;
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

function spawnLeaves(count) {
  const sky = $("sky");
  if (!sky || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  sky.replaceChildren();
  const colors = ["#D47738", "#E8B647", "#B9533B", "#C58D46", "#D99B59"];
  for (let index = 0; index < count; index++) {
    const leaf = document.createElement("div");
    leaf.className = "miss-leaf";
    leaf.style.left = (3 + Math.random() * 94) + "%";
    leaf.style.setProperty("--leaf-size", (16 + Math.random() * 17) + "px");
    leaf.style.setProperty("--leaf-color", colors[index % colors.length]);
    leaf.style.setProperty("--drift", ((Math.random() - 0.5) * 140) + "px");
    leaf.style.setProperty("--spin", ((Math.random() - 0.5) * 540) + "deg");
    leaf.style.animationDuration = (3.2 + Math.random() * 1.8) + "s";
    leaf.style.animationDelay = (Math.random() * 1.1) + "s";
    sky.appendChild(leaf);
    leaf.addEventListener("animationend", () => leaf.remove(), { once: true });
    setTimeout(() => leaf.remove(), 6500);
  }
}

function myLastAt() {
  const fromLocal = Number(appStorage.get("ily:lastSent", "0"));
  return Math.max(missHistory.lastAt(normalizeName(name)), fromLocal);
}

function renderBeacon(now) {
  const remaining = Math.min(COOLDOWN_MS, Math.max(0, COOLDOWN_MS - (now - myLastAt())));
  const cooling = remaining > 0;
  const onCall = !!(call && call.on);
  const someoneSleeping = onCall && !!call.sleeping;
  const missesPaused = onCall && !someoneSleeping;

  beacon.disabled = cooling || missesPaused || missSending;
  beacon.classList.toggle("cooling", cooling && !missesPaused);
  beacon.classList.toggle("on-call", missesPaused);
  beaconEmoji.textContent = missesPaused ? "📞" : cooling ? "⏳" : "🤍";
  beaconLabel.textContent = missesPaused ? "on call" : cooling ? Math.ceil(remaining / 1000) + "s" : "I miss you";
  beaconTiny.textContent = missesPaused ? "misses paused" : "until your next miss";
  beaconTiny.classList.toggle("hidden", !cooling && !missesPaused);
  ringFg.style.display = cooling && !missesPaused ? "" : "none";
  ringFg.setAttribute("stroke-dashoffset", CIRCUMFERENCE * (1 - remaining / COOLDOWN_MS));
}

function renderPartnerClock(normalizedName, now) {
  const partner = normalizedName === "lewis" ? "khali" : normalizedName === "khali" ? "lewis" : null;
  if (partner) {
    partnerClock.classList.remove("hidden");
    partnerClockLabel.textContent = partner + (partner.endsWith("s") ? "' time" : "'s time");
    const time = clockFormatters[partner].format(new Date(now));
    const partnerHour = hourFor(partner);
    const icon = partnerHour >= 22 || partnerHour < 6 ? "🌙 " : partnerHour < 9 ? "🌅 " : partnerHour < 18 ? "☀️ " : "🌆 ";
    partnerClockTime.textContent = icon + time;
  } else {
    partnerClock.classList.add("hidden");
  }
}


let statsCache = null;
function renderStats() {
  const todayKey = torontoDayKey(serverNow());
  if (statsCache?.version === missHistory.version && statsCache.adjust === adjust && statsCache.day === todayKey) return;
  const yesterdayKey = previousTorontoDayKey(serverNow());
  $("yesterday-khali-count").textContent = Math.max(0, dayPoints("khali", yesterdayKey));
  $("yesterday-lewis-count").textContent = Math.max(0, dayPoints("lewis", yesterdayKey));
  const completedMisses = totalFor("khali") + totalFor("lewis")
    - dayPoints("khali", todayKey) - dayPoints("lewis", todayKey)
    + allTimeAdjustment();
  $("total-count").textContent = Math.max(0, completedMisses);
  statsCache = { version: missHistory.version, adjust, day: todayKey };
}

function render() {
  const now = serverNow();
  const normalizedName = normalizeName(name);
  renderBeacon(now);
  renderPartnerClock(normalizedName, now);
  renderStats();
}

function renderFeed() {
  const feedEl = $("feed");
  const latest = missHistory.latest;
  $("empty").classList.toggle("hidden", Boolean(latest));
  feedEl.innerHTML = "";
  if (!latest) return;

  const normalizedSender = normalizeName(latest.from);
  const sender = normalizedSender === "khali" ? "khali" : normalizedSender === "lewis" ? "lewis" : latest.from;
  const li = document.createElement("li");
  if (normalizedSender === "khali") li.classList.add("khali");
  if (normalizedSender === "lewis") li.classList.add("lewis");
  const what = document.createElement("span");
  what.className = "what";
  what.textContent = "💌 last sent by " + sender;
  const when = document.createElement("span");
  when.className = "when";
  when.dataset.timestamp = latest.at;
  when.textContent = ago(latest.at, serverNow());
  li.append(what, when);
  feedEl.appendChild(li);
}

function refreshLatestMissTime() {
  const when = $("feed").querySelector(".when");
  if (!when) return;
  const timestamp = Number(when.dataset.timestamp);
  if (Number.isFinite(timestamp)) when.textContent = ago(timestamp, serverNow());
}

const torontoDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: GAME_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
function torontoDayKey(t) {
  return torontoDateFormatter.format(new Date(t));
}

const gameTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GAME_TZ, hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
});
function secondsUntilTorontoMidnight() {
  const parts = gameTimeFormatter.formatToParts(new Date(serverNow()));
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  const secondsElapsed = (value("hour") % 24) * 3600 + value("minute") * 60 + value("second");
  return 24 * 3600 - secondsElapsed;
}

function timeLeftToronto() {
  const minutesLeft = Math.ceil(secondsUntilTorontoMidnight() / 60);
  return Math.floor(minutesLeft / 60) + "h " + (minutesLeft % 60) + "m";
}

function revealCountdownToronto() {
  const minutes = Math.ceil(secondsUntilTorontoMidnight() / 60);
  return Math.floor(minutes / 60) + "h " + String(minutes % 60).padStart(2, "0") + "m";
}

function renderRevealCountdown() {
  if (name && !document.hidden && !mainEl.classList.contains("hidden")) {
    $("today-score").textContent = "today's result is hidden · " + timeLeftToronto() + " left";
    $("reveal-countdown").textContent = "today reveals in " + revealCountdownToronto();
  }
}
setInterval(renderRevealCountdown, 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderRevealCountdown();
});

let calMonthOffset = 0; // 0 = this month, -1 = last month, +1 = next
const CAL_FIRST_MONTH = { year: 2026, month: 7 }; // nothing exists before july 2026

function torontoParts(timestamp) {
  const parts = torontoDateFormatter.formatToParts(new Date(timestamp));
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function dayKeyFromParts(year, month, day) {
  return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function previousTorontoDayKey(timestamp) {
  const today = torontoParts(timestamp);
  const yesterday = new Date(Date.UTC(today.year, today.month - 1, today.day - 1));
  return dayKeyFromParts(yesterday.getUTCFullYear(), yesterday.getUTCMonth() + 1, yesterday.getUTCDate());
}

function dayScores() {
  const days = {};
  for (const [key, counts] of missHistory.days) {
    days[key] = { k: counts.get("khali") || 0, l: counts.get("lewis") || 0 };
  }
  // preserve existing dated adjustments in their original day
  for (const key in adjust) {
    const dayAdjustments = adjust[key];
    if (dayAdjustments && typeof dayAdjustments === "object") {
      const record = days[key] || (days[key] = { k: 0, l: 0 });
      record.k += Number(dayAdjustments.khali) || 0;
      record.l += Number(dayAdjustments.lewis) || 0;
    }
  }
  return days;
}

function renderCal() {
  const grid = $("cal-grid");
  const days = dayScores();
  const todayKey = torontoDayKey(serverNow());
  const todayParts = torontoParts(serverNow());

  // the month being viewed
  const viewed = new Date(todayParts.year, todayParts.month - 1 + calMonthOffset, 1);
  const viewYear = viewed.getFullYear();
  const viewMonth = viewed.getMonth() + 1;
  $("cal-month").textContent = viewed
    .toLocaleDateString(undefined, { month: "long", year: "numeric" })
    .toLowerCase();
  // no peeking at months that haven't happened, or before the app existed
  $("cal-next").disabled = calMonthOffset >= 0;
  $("cal-prev").disabled =
    viewYear < CAL_FIRST_MONTH.year ||
    (viewYear === CAL_FIRST_MONTH.year && viewMonth <= CAL_FIRST_MONTH.month);

  // convert javascript's sunday-first index to a monday-first index
  // 5 rows covers most months; a 6th only appears when the month genuinely spills over
  const firstOfMonth = new Date(viewYear, viewMonth - 1, 1);
  const firstDayIndex = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(viewYear, viewMonth - 1, 1 - firstDayIndex);
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cellCount = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;

  grid.innerHTML = "";
  for (let index = 0; index < cellCount; index++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = dayKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const record = days[key] || { k: 0, l: 0 };
    const isToday = key === todayKey;

    const cell = document.createElement("div");
    cell.className = "day";
    if (date.getMonth() + 1 !== viewMonth) cell.classList.add("outside");
    if (!isToday && record.k > record.l) cell.classList.add("k");
    else if (!isToday && record.l > record.k) cell.classList.add("l");
    else if (!isToday && record.k > 0) cell.classList.add("b");
    if (isToday) cell.classList.add("today");

    if (!isToday && (record.k > 0 || record.l > 0)) {
      const khaliScore = document.createElement("span");
      khaliScore.className = "ds ds-k";
      khaliScore.textContent = record.k;
      const lewisScore = document.createElement("span");
      lewisScore.className = "ds ds-l";
      lewisScore.textContent = record.l;
      cell.append(khaliScore, lewisScore);
    }
    cell.title = isToday
      ? "today · result hidden until the day ends"
      : key + " · khali " + record.k + " – " + record.l + " lewis";
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
  $("today-score").textContent = "today's result is hidden · " + timeLeftToronto() + " left";
}

$("cal-prev").addEventListener("click", () => {
  if ($("cal-prev").disabled) return;
  calMonthOffset -= 1;
  renderCal();
});

$("cal-next").addEventListener("click", () => {
  if (calMonthOffset >= 0) return;
  calMonthOffset += 1;
  renderCal();
});

function showMain() {
  setupEl.classList.add("hidden");
  mainEl.classList.remove("hidden");
  $("who").textContent = name;
  renderRevealCountdown();
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
  const normalizedEnteredName = normalizeName(enteredName);
  if (!["khali", "lewis"].includes(normalizedEnteredName)) {
    $("name-err").textContent = "that's not khali, fix it.";
    return;
  }
  $("name-err").textContent = "";
  if (!appStorage.set("ily:name", normalizedEnteredName)) {
    $("name-err").textContent = "couldn't save your login — check browser storage permissions.";
    return;
  }
  window.location.reload();
});


$("reset-btn").addEventListener("click", () => {
  if (!appStorage.remove("ily:name")) {
    $("err").textContent = "couldn't log out — check browser storage permissions.";
    return;
  }
  window.location.reload();
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
    const reset = { ["adjust/" + todayKey]: null };
    for (const event of missHistory.records.values()) {
      if (torontoDayKey(event.at) === todayKey) reset["misses/" + event.id] = null;
    }
    await db.ref().update(reset);
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
    const ev = { from: name, at: firebase.database.ServerValue.TIMESTAMP };
    await eventsRef.push(ev);
    appStorage.set("ily:lastSent", serverNow());
    spawnLeaves(36);
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
function connectFirebase() {
  if (!configured || db) return;
  try {
    db = initializeFirebaseDatabase();
    eventsRef = db.ref("misses");
    const showSubscriptionError = (error) => {
      console.error("firebase data subscription failed:", error);
      $("err").textContent = "can't reach the misses database — check your connection and Firebase rules";
    };
    db.ref(".info/serverTimeOffset").on("value", (s) => {
      serverOffset = s.val() || 0;
      resolveServerClock();
    }, showSubscriptionError);
    db.ref("adjust").on("value", (s) => { adjust = s.val() || {}; if (name) { render(); renderCal(); } }, showSubscriptionError);
    db.ref("call").on("value", (s) => { call = s.val();  if (name) render(); }, showSubscriptionError);
    const updateMiss = (snapshot, removed = false) => {
      const previous = missHistory.records.get(snapshot.key);
      if (removed) missHistory.remove(snapshot.key);
      else missHistory.update(snapshot.key, snapshot.val());
      const event = missHistory.records.get(snapshot.key);
      if (historyReady && !previous && event && event.from !== normalizeName(name)) {
        spawnLeaves(44);
        try {
          navigator.vibrate?.([90, 50, 90]);
        } catch (error) {
          console.warn("vibration failed:", error);
        }
      }
      // initial child events arrive in a burst; render them together.
      if (historyRenderTimer !== null) return;
      historyRenderTimer = setTimeout(() => {
        historyRenderTimer = null;
        if (name) {
          render();
          renderFeed();
          renderCal();
        }
      }, 0);
    };
    eventsRef.on("child_added", (snapshot) => updateMiss(snapshot), showSubscriptionError);
    eventsRef.on("child_changed", (snapshot) => updateMiss(snapshot), showSubscriptionError);
    eventsRef.on("child_removed", (snapshot) => updateMiss(snapshot, true), showSubscriptionError);
    eventsRef.once("value").then(() => { historyReady = true; }).catch(showSubscriptionError);
  } catch (error) {
    console.error("firebase initialization failed:", error);
    $("err").textContent = "couldn't connect to the misses database";
  }
}

// tick every second for cooldown and relative times
let lastDayKey = null;
setInterval(() => {
  if (name && !document.hidden && !mainEl.classList.contains("hidden")) {
    try {
      const dk = torontoDayKey(serverNow());
      if (dk !== lastDayKey) {
        lastDayKey = dk;
        renderFeed();
        renderCal();
      }
      refreshLatestMissTime();
      render();
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
if (name) {
  showMain();
  connectFirebase();
} else {
  showSetup();
}
