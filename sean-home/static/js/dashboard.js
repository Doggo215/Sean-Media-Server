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

    // Populate header weather summary
    const hwIcon = document.getElementById("header-weather-icon");
    const hwTemp = document.getElementById("header-weather-temp");
    const hwDesc = document.getElementById("header-weather-desc");
    if (hwIcon) hwIcon.textContent = data.icon;
    if (hwTemp) hwTemp.textContent = `${data.temperature_f}°F`;
    if (hwDesc) hwDesc.textContent = `${data.condition} · Low ${data.low_f}°F`;
  } catch (err) {
    console.warn("Sean Home: weather unavailable", err);
    condEl.textContent = "Weather unavailable";
    condEl.className = "weather-unavailable";
    tempEl.textContent = "—";
    hiloEl.textContent = "";
    iconEl.textContent = "⚠️";

    const hwIcon = document.getElementById("header-weather-icon");
    const hwTemp = document.getElementById("header-weather-temp");
    const hwDesc = document.getElementById("header-weather-desc");
    if (hwIcon) hwIcon.textContent = "⚠️";
    if (hwTemp) hwTemp.textContent = "—";
    if (hwDesc) hwDesc.textContent = "Weather unavailable";
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

function renderGaming(data) {
  const sections = [];

  const fn = data.fortnite;
  if (fn && fn.available) {
    const statusLine = fn.status ? `<div class="gaming-status">Status: ${fn.status}</div>` : "";
    const newsLines = (fn.news || [])
      .slice(0, 2)
      .map((n) => `<div class="gaming-line">📰 ${n.title}</div>`)
      .join("");
    const shopLines = (fn.shop || [])
      .slice(0, 3)
      .map((s) => `<div class="gaming-line">🛒 ${s.name}${s.price ? ` — ${s.price} V-Bucks` : ""}</div>`)
      .join("");
    sections.push(`
      <div class="gaming-section">
        <div class="gaming-subtitle">Fortnite</div>
        ${statusLine}
        ${newsLines || `<div class="gaming-line gaming-dim">No news available</div>`}
        ${shopLines || `<div class="gaming-line gaming-dim">Shop unavailable</div>`}
      </div>
    `);
  } else {
    sections.push(`
      <div class="gaming-section">
        <div class="gaming-subtitle">Fortnite</div>
        <div class="gaming-line gaming-dim">Fortnite data unavailable</div>
      </div>
    `);
  }

  sections.push(`
    <div class="gaming-section">
      <div class="gaming-subtitle">PlayStation</div>
      <div class="gaming-line gaming-dim">${data.playstation.placeholder}</div>
    </div>
  `);

  sections.push(`
    <div class="gaming-section">
      <div class="gaming-subtitle">Friends Online</div>
      <div class="gaming-line gaming-dim">${data.friends_online.placeholder}</div>
    </div>
  `);

  return sections.join("");
}

async function pollGaming() {
  const bodyEl = document.getElementById("gaming-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/gaming");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    bodyEl.innerHTML = data.available
      ? renderGaming(data)
      : `<p class="placeholder-text">Gaming data unavailable</p>`;
  } catch (err) {
    // Fail gracefully — never crash the dashboard over a gaming data outage
    console.warn("Sean Home: gaming unavailable", err);
    bodyEl.innerHTML = `<p class="placeholder-text">Gaming data unavailable</p>`;
  }
}

async function pollJellyfin() {
  const bodyEl = document.getElementById("jellyfin-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/jellyfin");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    if (!d.available) {
      bodyEl.innerHTML = `<p class="placeholder-text">Entertainment unavailable</p>`;
      setTimeout(pollJellyfin, 300000);
      return;
    }

    const sections = [];

    if (d.continue_watching && d.continue_watching.length) {
      sections.push(`<div class="jf-section-label">Continue Watching</div>`);
      for (const item of d.continue_watching) {
        const bar = `<div class="jf-progress-bar"><div class="jf-progress-fill" style="width:${item.progress}%"></div></div>`;
        sections.push(
          `<div class="jf-row">` +
          `<span class="jf-title">${item.label}</span>` +
          `<span class="jf-meta">${item.progress}%</span>` +
          `</div>${bar}`
        );
      }
    }

    if (d.recently_added && d.recently_added.length) {
      sections.push(`<div class="jf-section-label${d.continue_watching && d.continue_watching.length ? " jf-section-gap" : ""}">Recently Added</div>`);
      for (const item of d.recently_added) {
        const meta = item.runtime || item.type || "";
        sections.push(
          `<div class="jf-row">` +
          `<span class="jf-title">${item.label}</span>` +
          `<span class="jf-meta">${meta}</span>` +
          `</div>`
        );
      }
    }

    if (!sections.length) {
      bodyEl.innerHTML = `<p class="placeholder-text">Library is empty</p>`;
    } else {
      bodyEl.innerHTML = sections.join("");
    }
  } catch (err) {
    console.warn("Sean Home: Jellyfin unavailable", err);
    bodyEl.innerHTML = `<p class="placeholder-text">Entertainment unavailable</p>`;
  }

  setTimeout(pollJellyfin, 300000); // 5 min — matches server cache TTL
}

async function pollTonight() {
  const bodyEl = document.getElementById("tonight-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/tonight");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    if (!d.available) {
      bodyEl.innerHTML = `<p class="placeholder-text">Tonight unavailable</p>`;
      setTimeout(pollTonight, 120000);
      return;
    }

    const rows = [];

    // Weather row
    if (d.weather && d.weather.available) {
      rows.push(
        `<div class="tn-row tn-weather">` +
        `<span class="tn-icon">${d.weather.icon}</span>` +
        `<span class="tn-detail">${d.weather.condition} · ${d.weather.temp_f}°F &rarr; Low ${d.weather.low_f}°F</span>` +
        `</div>`
      );
    }

    // Live games
    for (const g of (d.sports.live || [])) {
      rows.push(
        `<div class="tn-row tn-live">` +
        `<span class="tn-icon">🔴</span>` +
        `<span class="tn-detail"><strong>LIVE</strong> ${g.team} vs ${g.opponent} · ${g.score}${g.period ? " · " + g.period : ""}</span>` +
        `</div>`
      );
    }

    // Upcoming games tonight
    for (const g of (d.sports.upcoming || [])) {
      rows.push(
        `<div class="tn-row tn-upcoming">` +
        `<span class="tn-icon">🏟</span>` +
        `<span class="tn-detail">${g.team} vs ${g.opponent} · ${g.time}</span>` +
        `</div>`
      );
    }

    // Final scores from today
    for (const g of (d.sports.finals || [])) {
      const resultClass = g.result === "W" ? "tn-win" : g.result === "L" ? "tn-loss" : "";
      const badge = g.result ? `<span class="tn-result ${resultClass}">${g.result}</span>` : "";
      rows.push(
        `<div class="tn-row tn-final">` +
        `<span class="tn-icon">📊</span>` +
        `<span class="tn-detail">${g.team} vs ${g.opponent} · ${g.score} ${badge}</span>` +
        `</div>`
      );
    }

    // No sports data tonight
    if (!d.sports.live.length && !d.sports.upcoming.length && !d.sports.finals.length) {
      rows.push(
        `<div class="tn-row tn-dim">` +
        `<span class="tn-icon">🏟</span>` +
        `<span class="tn-detail">No tracked games tonight</span>` +
        `</div>`
      );
    }

    // Gaming
    if (d.gaming && d.gaming.available) {
      const statusText = d.gaming.fortnite_status
        ? `Fortnite: ${d.gaming.fortnite_status}`
        : d.gaming.headline || "Fortnite";
      rows.push(
        `<div class="tn-row tn-dim">` +
        `<span class="tn-icon">🎮</span>` +
        `<span class="tn-detail">${statusText}</span>` +
        `</div>`
      );
    }

    // Media / Recently Added
    if (d.media && d.media.available && d.media.recently_added && d.media.recently_added.length) {
      for (const item of d.media.recently_added.slice(0, 2)) {
        rows.push(
          `<div class="tn-row tn-dim">` +
          `<span class="tn-icon">📺</span>` +
          `<span class="tn-detail">New: ${item.label}</span>` +
          `</div>`
        );
      }
      if (d.media.continue_watching && d.media.continue_watching.length) {
        const cw = d.media.continue_watching[0];
        rows.push(
          `<div class="tn-row tn-dim">` +
          `<span class="tn-icon">▶️</span>` +
          `<span class="tn-detail">Continue: ${cw.label} · ${cw.progress}%</span>` +
          `</div>`
        );
      }
    } else {
      rows.push(
        `<div class="tn-row tn-placeholder">` +
        `<span class="tn-icon">📺</span>` +
        `<span class="tn-detail">Recently Added — loading</span>` +
        `</div>`
      );
    }

    // Calendar placeholder
    rows.push(
      `<div class="tn-row tn-placeholder">` +
      `<span class="tn-icon">📅</span>` +
      `<span class="tn-detail">Calendar — coming soon</span>` +
      `</div>`
    );

    bodyEl.innerHTML = rows.join("");
  } catch (err) {
    console.warn("Sean Home: tonight unavailable", err);
    bodyEl.innerHTML = `<p class="placeholder-text">Tonight unavailable</p>`;
  }

  setTimeout(pollTonight, 120000); // refresh every 2 min
}

function svcDot(status) {
  if (status === "active")   return `<span class="svc-dot svc-ok"></span>`;
  if (status === "inactive") return `<span class="svc-dot svc-warn"></span>`;
  return `<span class="svc-dot svc-err"></span>`;
}

async function pollMediaServer() {
  const bodyEl = document.getElementById("media-server-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/media-server");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    if (!d.available) {
      bodyEl.innerHTML = `<p class="placeholder-text">Media Server unavailable</p>`;
    } else {
      const svcs = Object.values(d.services)
        .map(s => `<span class="ms-svc">${svcDot(s.status)}${s.label}</span>`)
        .join("");

      const tempStr = d.cpu.temp_c !== null ? `${d.cpu.temp_c}°C` : "—";
      const importRow = d.last_import.available
        ? `<span class="ms-sep">·</span><span class="ms-stat-chip">Last import <strong>${d.last_import.folder} · ${d.last_import.date}</strong></span>`
        : "";

      bodyEl.innerHTML =
        svcs +
        `<span class="ms-sep">·</span>` +
        `<span class="ms-stat-chip">Disk <strong>${d.disk.pct}%</strong></span>` +
        `<span class="ms-stat-chip">Free <strong>${d.disk.free_gb} GB</strong></span>` +
        `<span class="ms-stat-chip">RAM <strong>${d.ram.used_pct}%</strong></span>` +
        `<span class="ms-stat-chip">Temp <strong>${tempStr}</strong></span>` +
        `<span class="ms-stat-chip">Up <strong>${d.uptime}</strong></span>` +
        importRow;
    }
  } catch (err) {
    console.warn("Sean Home: media server status unavailable", err);
    bodyEl.innerHTML = `<p class="placeholder-text">Media Server unavailable</p>`;
  }

  setTimeout(pollMediaServer, 60000);
}

tickClock();
setInterval(tickClock, 1000);

pollSystemStatus();
setInterval(pollSystemStatus, 30000);

pollWeather();
setInterval(pollWeather, 600000); // 10 min — matches server-side cache TTL

pollJellyfin(); // self-scheduling, 5 min refresh
pollTonight(); // self-scheduling, 2 min refresh — reads from warm caches
pollSports(); // self-scheduling — interval adapts to live-game state
pollMediaServer(); // self-scheduling via setTimeout, 60s refresh

pollGaming();
setInterval(pollGaming, 1800000); // 30 min — matches server-side cache TTL
