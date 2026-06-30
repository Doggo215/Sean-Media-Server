// Sean Home v1.0 — dashboard client
// Phase 1A: live clock tick, system stats poll. No external integrations yet.

function tickClock() {
  const now = new Date();
  const clock = document.getElementById("clock");
  if (!clock) return;
  clock.textContent = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function classify(value, warnAt, alertAt) {
  if (value >= alertAt) return "alert";
  if (value >= warnAt) return "warn";
  return "good";
}

async function pollSystemStatus() {
  try {
    const res = await fetch("/api/system");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const diskEl = document.getElementById("disk-pct");
    const diskFreeEl = document.getElementById("disk-free");
    const ramEl = document.getElementById("ram-pct");
    const cpuEl = document.getElementById("cpu-pct");
    const tempEl = document.getElementById("cpu-temp");

    if (diskEl) {
      diskEl.textContent = `${data.disk.root_pct}%`;
      diskEl.className = "stat-value " + classify(data.disk.root_pct, 80, 95);
    }
    if (diskFreeEl) diskFreeEl.textContent = `${data.disk.root_free_gb} GB`;
    if (ramEl) {
      ramEl.textContent = `${data.ram.used_pct}%`;
      ramEl.className = "stat-value " + classify(data.ram.used_pct, 80, 95);
    }
    if (cpuEl) cpuEl.textContent = `${data.cpu.used_pct}%`;
    if (tempEl && data.cpu.temp_c !== null) {
      tempEl.textContent = `${data.cpu.temp_c}°C`;
      tempEl.className = "stat-value " + classify(data.cpu.temp_c, 70, 80);
    }
  } catch (err) {
    // Fail gracefully — leave placeholders, don't break the page
    console.warn("Sean Home: system status unavailable", err);
  }
}

async function pollWeather() {
  const iconEl = document.getElementById("weather-icon");
  const tempEl = document.getElementById("weather-temp");
  const condEl = document.getElementById("weather-condition");
  const hiloEl = document.getElementById("weather-hilo");
  if (!iconEl) return;

  try {
    const res = await fetch("/api/weather");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.available) {
      condEl.textContent = "Weather unavailable";
      condEl.className = "weather-unavailable";
      tempEl.textContent = "—";
      hiloEl.textContent = "";
      iconEl.textContent = "⚠️";
      return;
    }

    iconEl.textContent = data.icon;
    tempEl.textContent = `${data.temperature_f}°F`;
    condEl.className = "weather-condition";
    condEl.textContent = data.condition + (data.stale ? " (cached)" : "");
    hiloEl.textContent = `H: ${data.high_f}°  L: ${data.low_f}°`;
  } catch (err) {
    console.warn("Sean Home: weather unavailable", err);
    condEl.textContent = "Weather unavailable";
    condEl.className = "weather-unavailable";
    tempEl.textContent = "—";
    hiloEl.textContent = "";
    iconEl.textContent = "⚠️";
  }
}

const SPORTS_ORDER = ["phillies", "eagles", "sixers", "flyers", "world_cup"];

function renderSportsRow(team) {
  if (!team || team.available === false) {
    return `<div class="sports-row"><span class="sports-team">${team ? team.label : ""}</span><span class="sports-unavailable">Unavailable</span></div>`;
  }

  let detail;
  if (team.live) {
    const score = team.live.score || `${team.live.my_score ?? "—"}-${team.live.opp_score ?? "—"}`;
    detail = `<span class="sports-live">LIVE ${score} · ${team.live.period || ""}</span>`;
  } else if (team.next) {
    const who = team.next.opponent ? `vs ${team.next.opponent}` : team.next.matchup;
    detail = `<span class="sports-next">Next: ${who} · ${team.next.date} ${team.next.time}</span>`;
  } else if (team.last) {
    const score = team.last.score || `${team.last.my_score ?? "—"}-${team.last.opp_score ?? "—"}`;
    const result = team.last.result ? `${team.last.result} ` : "";
    detail = `<span class="sports-last">Last: ${result}${score}</span>`;
  } else {
    detail = `<span class="sports-unavailable">No data</span>`;
  }

  return `<div class="sports-row"><span class="sports-team">${team.label}</span>${detail}</div>`;
}

async function pollSports() {
  const listEl = document.getElementById("sports-list");
  if (!listEl) return;

  let nextDelay = 600000; // 10 min default

  try {
    const res = await fetch("/api/sports");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.available) {
      listEl.innerHTML = `<p class="placeholder-text">Sports unavailable</p>`;
    } else {
      listEl.innerHTML = SPORTS_ORDER
        .filter((key) => data.teams[key])
        .map((key) => renderSportsRow(data.teams[key]))
        .join("");
      nextDelay = data.live_active ? 60000 : 600000; // poll faster only while a game is live
    }
  } catch (err) {
    // Fail gracefully — never crash the dashboard over a sports data outage
    console.warn("Sean Home: sports unavailable", err);
    listEl.innerHTML = `<p class="placeholder-text">Sports unavailable</p>`;
  }

  setTimeout(pollSports, nextDelay);
}

tickClock();
setInterval(tickClock, 1000);

pollSystemStatus();
setInterval(pollSystemStatus, 30000);

pollWeather();
setInterval(pollWeather, 600000); // 10 min — matches server-side cache TTL

pollSports(); // self-scheduling — interval adapts to live-game state
