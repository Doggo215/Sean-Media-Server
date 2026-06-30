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

tickClock();
setInterval(tickClock, 1000);

pollSystemStatus();
setInterval(pollSystemStatus, 30000);
