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

tickClock();
setInterval(tickClock, 1000);

pollSystemStatus();
setInterval(pollSystemStatus, 30000);

pollWeather();
setInterval(pollWeather, 600000); // 10 min — matches server-side cache TTL
