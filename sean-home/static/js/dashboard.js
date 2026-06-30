// Sean Home — TV Dashboard client
// Designed for 65" TV at 1920×1080, couch-distance readability.

/* ── Clock ──────────────────────────────────────────────────── */
function tickClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ── Utility ─────────────────────────────────────────────────── */
function classify(value, warnAt, alertAt) {
  if (value >= alertAt) return "alert";
  if (value >= warnAt) return "warn";
  return "good";
}

function svcDot(status) {
  if (status === "active")   return `<span class="svc-dot svc-ok"></span>`;
  if (status === "inactive") return `<span class="svc-dot svc-warn"></span>`;
  return `<span class="svc-dot svc-err"></span>`;
}

/* ── System status (writes to hidden #system-card IDs) ────── */
async function pollSystemStatus() {
  try {
    const res = await fetch("/api/system");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    const diskEl  = document.getElementById("disk-pct");
    const freeEl  = document.getElementById("disk-free");
    const ramEl   = document.getElementById("ram-pct");
    const cpuEl   = document.getElementById("cpu-pct");
    const tempEl  = document.getElementById("cpu-temp");

    if (diskEl)  { diskEl.textContent = `${d.disk.root_pct}%`; diskEl.className = "stat-value " + classify(d.disk.root_pct, 80, 95); }
    if (freeEl)    freeEl.textContent  = `${d.disk.root_free_gb} GB`;
    if (ramEl)   { ramEl.textContent  = `${d.ram.used_pct}%`;  ramEl.className  = "stat-value " + classify(d.ram.used_pct, 80, 95); }
    if (cpuEl)     cpuEl.textContent  = `${d.cpu.used_pct}%`;
    if (tempEl && d.cpu.temp_c !== null) {
      tempEl.textContent = `${d.cpu.temp_c}°C`;
      tempEl.className   = "stat-value " + classify(d.cpu.temp_c, 70, 80);
    }
  } catch (err) {
    console.warn("Sean Home: system status unavailable", err);
  }
}

/* ── Weather ──────────────────────────────────────────────────── */
async function pollWeather() {
  const iconEl = document.getElementById("weather-icon");
  const tempEl = document.getElementById("weather-temp");
  const condEl = document.getElementById("weather-condition");
  const hiloEl = document.getElementById("weather-hilo");
  const hwIcon = document.getElementById("header-weather-icon");
  const hwTemp = document.getElementById("header-weather-temp");
  const hwDesc = document.getElementById("header-weather-desc");

  if (!iconEl) return;

  try {
    const res = await fetch("/api/weather");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    if (!d.available) {
      iconEl.textContent = "⚠️";
      if (tempEl)  tempEl.textContent = "—°";
      if (condEl) { condEl.textContent = "Unavailable"; condEl.className = "weather-unavailable"; }
      if (hiloEl)  hiloEl.textContent = "";
      if (hwIcon)  hwIcon.textContent = "⚠️";
      if (hwTemp)  hwTemp.textContent = "—°";
      if (hwDesc)  hwDesc.textContent = "Weather unavailable";
      return;
    }

    iconEl.textContent = d.icon;
    if (tempEl) tempEl.textContent = `${d.temperature_f}°`;
    if (condEl) { condEl.textContent = d.condition + (d.stale ? " (cached)" : ""); condEl.className = "weather-condition"; }
    if (hiloEl) hiloEl.textContent  = `H: ${d.high_f}°  ·  L: ${d.low_f}°`;

    if (hwIcon) hwIcon.textContent = d.icon;
    if (hwTemp) hwTemp.textContent = `${d.temperature_f}°`;
    if (hwDesc) hwDesc.textContent = `${d.condition}  ·  Low ${d.low_f}°`;
  } catch (err) {
    console.warn("Sean Home: weather unavailable", err);
    iconEl.textContent = "⚠️";
    if (tempEl)  tempEl.textContent = "—°";
    if (condEl) { condEl.textContent = "Unavailable"; condEl.className = "weather-unavailable"; }
    if (hwIcon)  hwIcon.textContent = "⚠️";
    if (hwTemp)  hwTemp.textContent = "—°";
    if (hwDesc)  hwDesc.textContent = "Weather unavailable";
  }
}

/* ── Tonight — 3 large hero callouts ─────────────────────────── */
async function pollTonight() {
  const bodyEl = document.getElementById("tonight-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/tonight");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    if (!d.available) {
      bodyEl.innerHTML = `<div class="tn-callout tn-callout-dim"><div class="tn-co-label">Tonight unavailable</div></div>`;
      setTimeout(pollTonight, 120000);
      return;
    }

    const callouts = [];

    // ── 1. Weather callout ──
    if (d.weather && d.weather.available) {
      callouts.push(`
        <div class="tn-callout">
          <div class="tn-co-icon">${d.weather.icon}</div>
          <div class="tn-co-body">
            <div class="tn-co-value">${d.weather.temp_f}°<span class="tn-co-unit">F</span></div>
            <div class="tn-co-label">${d.weather.condition}</div>
            <div class="tn-co-sub">Low ${d.weather.low_f}° tonight</div>
          </div>
        </div>
      `);
    }

    // ── 2. Best sports callout ──
    const live     = d.sports.live     || [];
    const upcoming = d.sports.upcoming || [];
    const finals   = d.sports.finals   || [];

    if (live.length) {
      const g = live[0];
      callouts.push(`
        <div class="tn-callout tn-callout-live">
          <div class="tn-co-body">
            <div class="tn-co-live-badge"><span class="tn-live-dot"></span>LIVE</div>
            <div class="tn-co-value">${g.score || "—"}</div>
            <div class="tn-co-label">${g.team} vs ${g.opponent}</div>
            <div class="tn-co-sub">${g.period || ""}</div>
          </div>
        </div>
      `);
    } else if (upcoming.length) {
      const g = upcoming[0];
      callouts.push(`
        <div class="tn-callout">
          <div class="tn-co-icon">🏟️</div>
          <div class="tn-co-body">
            <div class="tn-co-value">${g.time || "TBD"}</div>
            <div class="tn-co-label">${g.team} vs ${g.opponent}</div>
            <div class="tn-co-sub">Game tonight</div>
          </div>
        </div>
      `);
    } else if (finals.length) {
      const g = finals[0];
      const rClass = g.result === "W" ? "tn-co-win" : g.result === "L" ? "tn-co-loss" : "";
      const rWord  = g.result === "W" ? "Win" : g.result === "L" ? "Loss" : "Final";
      callouts.push(`
        <div class="tn-callout">
          <div class="tn-co-icon">📊</div>
          <div class="tn-co-body">
            <div class="tn-co-value ${rClass}">${g.score || "—"}</div>
            <div class="tn-co-label">${g.team} · ${rWord}</div>
            <div class="tn-co-sub">vs ${g.opponent}</div>
          </div>
        </div>
      `);
    } else {
      callouts.push(`
        <div class="tn-callout tn-callout-dim">
          <div class="tn-co-icon">🏟️</div>
          <div class="tn-co-body">
            <div class="tn-co-label">No tracked games tonight</div>
          </div>
        </div>
      `);
    }

    // ── 3. Media callout ──
    if (d.media && d.media.available) {
      const cw = (d.media.continue_watching || [])[0];
      const ra = (d.media.recently_added   || [])[0];
      if (cw) {
        callouts.push(`
          <div class="tn-callout">
            <div class="tn-co-icon">▶️</div>
            <div class="tn-co-body">
              <div class="tn-co-value">${cw.progress}%</div>
              <div class="tn-co-label">${cw.label}</div>
              <div class="tn-co-sub">Continue watching</div>
            </div>
          </div>
        `);
      } else if (ra) {
        callouts.push(`
          <div class="tn-callout">
            <div class="tn-co-icon">✨</div>
            <div class="tn-co-body">
              <div class="tn-co-label">${ra.label}</div>
              <div class="tn-co-sub">New in library</div>
            </div>
          </div>
        `);
      }
    }

    bodyEl.innerHTML = callouts.join("");
  } catch (err) {
    console.warn("Sean Home: tonight unavailable", err);
    bodyEl.innerHTML = `<div class="tn-callout tn-callout-dim"><div class="tn-co-label">Tonight unavailable</div></div>`;
  }

  setTimeout(pollTonight, 120000);
}

/* ── Sports — scoreboard style ────────────────────────────────── */
const SPORTS_ORDER = ["phillies", "eagles", "sixers", "flyers", "world_cup"];

function renderSportsRow(team) {
  if (!team || team.available === false) return "";

  if (team.live) {
    const score = team.live.score || `${team.live.my_score ?? "—"}-${team.live.opp_score ?? "—"}`;
    const period = team.live.period ? ` · ${team.live.period}` : "";
    return `
      <div class="sb-row sb-row-live">
        <div class="sb-team">${team.label}</div>
        <div class="sb-score sb-score-live">${score}</div>
        <div class="sb-badge sb-badge-live"><span class="sb-live-dot"></span>LIVE${period}</div>
      </div>`;
  }

  if (team.next) {
    const opp  = team.next.opponent ? `vs ${team.next.opponent}` : (team.next.matchup || "");
    const when = `${team.next.date || ""} ${team.next.time || ""}`.trim();
    return `
      <div class="sb-row">
        <div class="sb-team">${team.label}</div>
        <div class="sb-time">${team.next.time || "TBD"}</div>
        <div class="sb-badge sb-badge-next">${opp}</div>
      </div>`;
  }

  if (team.last) {
    const score  = team.last.score || `${team.last.my_score ?? "—"}-${team.last.opp_score ?? "—"}`;
    const result = team.last.result || "";
    const rClass = result === "W" ? "sb-badge-win" : result === "L" ? "sb-badge-loss" : "sb-badge-final";
    const scoreClass = result === "W" ? "sb-badge-win" : result === "L" ? "sb-badge-loss" : "";
    return `
      <div class="sb-row">
        <div class="sb-team">${team.label}</div>
        <div class="sb-score sb-score-final ${scoreClass}">${score}</div>
        <div class="sb-badge ${rClass}">${result || "Final"}</div>
      </div>`;
  }

  return "";
}

async function pollSports() {
  const listEl = document.getElementById("sports-list");
  if (!listEl) return;
  let nextDelay = 600000;

  try {
    const res = await fetch("/api/sports");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    if (!d.available) {
      listEl.innerHTML = `<div class="sb-placeholder">Sports unavailable</div>`;
    } else {
      const rows = SPORTS_ORDER
        .filter(k => d.teams[k])
        .map(k => renderSportsRow(d.teams[k]))
        .filter(Boolean)
        .join("");
      listEl.innerHTML = rows || `<div class="sb-placeholder">No data</div>`;
      nextDelay = d.live_active ? 60000 : 600000;
    }
  } catch (err) {
    console.warn("Sean Home: sports unavailable", err);
    listEl.innerHTML = `<div class="sb-placeholder">Sports unavailable</div>`;
  }

  setTimeout(pollSports, nextDelay);
}

/* ── Gaming — neon card ──────────────────────────────────────── */
function renderGaming(data) {
  const fn = data.fortnite;
  const parts = [];

  if (fn && fn.available) {
    const badge = fn.status
      ? `<span class="gaming-status-badge">${fn.status}</span>`
      : `<span class="gaming-status-badge">Online</span>`;

    parts.push(`<div class="gaming-hero"><div class="gaming-hero-title">Fortnite</div>${badge}</div>`);

    const news = (fn.news || []).slice(0, 2);
    for (const n of news) {
      parts.push(`<div class="gaming-news-item">📰 ${n.title}</div>`);
    }

    const shop = (fn.shop || []).slice(0, 2);
    if (shop.length) {
      parts.push(`<div class="gaming-shop-hdr">Today's Shop</div>`);
      for (const s of shop) {
        const vb = s.price ? ` · ${s.price} V-Bucks` : "";
        parts.push(`<div class="gaming-shop-item">🛒 ${s.name}${vb}</div>`);
      }
    }
  } else {
    parts.push(`<div class="gaming-hero"><div class="gaming-hero-title">Gaming</div></div>`);
    parts.push(`<div class="gaming-dim">Fortnite data unavailable</div>`);
  }

  parts.push(`<div class="gaming-coming-soon"><span class="gaming-coming-icon">🎮</span>PS5 integration coming soon</div>`);

  return parts.join("");
}

async function pollGaming() {
  const bodyEl = document.getElementById("gaming-body");
  if (!bodyEl) return;
  try {
    const res = await fetch("/api/gaming");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    bodyEl.innerHTML = d.available
      ? renderGaming(d)
      : `<div class="gaming-hero"><div class="gaming-hero-title">Gaming</div></div><div class="gaming-dim">Unavailable</div>`;
  } catch (err) {
    console.warn("Sean Home: gaming unavailable", err);
    bodyEl.innerHTML = `<div class="gaming-hero"><div class="gaming-hero-title">Gaming</div></div><div class="gaming-dim">Unavailable</div>`;
  }
}

/* ── Entertainment — poster style ────────────────────────────── */
async function pollJellyfin() {
  const bodyEl = document.getElementById("jellyfin-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/jellyfin");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    if (!d.available) {
      bodyEl.innerHTML = `<p class="card-placeholder">Entertainment unavailable</p>`;
      setTimeout(pollJellyfin, 300000);
      return;
    }

    const sections = [];

    if (d.continue_watching && d.continue_watching.length) {
      sections.push(`<div class="jf-section-label">Continue Watching</div>`);
      for (const item of d.continue_watching.slice(0, 1)) {
        const initial = (item.label || "?").charAt(0).toUpperCase();
        const bar = `<div class="jf-progress-bar"><div class="jf-progress-fill" style="width:${item.progress}%"></div></div>`;
        sections.push(`
          <div class="jf-poster-row">
            <div class="jf-thumb">${initial}</div>
            <div class="jf-poster-info">
              <div class="jf-poster-title">${item.label}</div>
              ${bar}
              <div class="jf-poster-meta">${item.progress}% watched</div>
            </div>
          </div>`);
      }
    }

    if (d.recently_added && d.recently_added.length) {
      const hasCW = d.continue_watching && d.continue_watching.length;
      sections.push(`<div class="jf-section-label${hasCW ? "" : ""}">Recently Added</div>`);
      for (const item of d.recently_added.slice(0, 3)) {
        const initial = (item.label || "?").charAt(0).toUpperCase();
        const meta = item.runtime || item.type || "";
        sections.push(`
          <div class="jf-poster-row">
            <div class="jf-thumb jf-thumb-sm">${initial}</div>
            <div class="jf-poster-info">
              <div class="jf-poster-title">${item.label}</div>
              <div class="jf-poster-meta">${meta}</div>
            </div>
          </div>`);
      }
    }

    bodyEl.innerHTML = sections.length
      ? sections.join("")
      : `<p class="card-placeholder">Library is empty</p>`;

  } catch (err) {
    console.warn("Sean Home: Jellyfin unavailable", err);
    bodyEl.innerHTML = `<p class="card-placeholder">Entertainment unavailable</p>`;
  }

  setTimeout(pollJellyfin, 300000);
}

/* ── Media Server strip ──────────────────────────────────────── */
async function pollMediaServer() {
  const bodyEl = document.getElementById("media-server-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/media-server");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    if (!d.available) {
      bodyEl.innerHTML = `<span class="card-placeholder">Media Server unavailable</span>`;
    } else {
      const svcs     = Object.values(d.services).map(s => `<span class="ms-svc">${svcDot(s.status)}${s.label}</span>`).join("");
      const tempStr  = d.cpu.temp_c !== null ? `${d.cpu.temp_c}°C` : "—";
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
    bodyEl.innerHTML = `<span class="card-placeholder">Media Server unavailable</span>`;
  }

  setTimeout(pollMediaServer, 60000);
}

/* ── Boot ───────────────────────────────────────────────────── */
tickClock();
setInterval(tickClock, 1000);

pollSystemStatus();
setInterval(pollSystemStatus, 30000);

pollWeather();
setInterval(pollWeather, 600000);

pollTonight();
pollSports();
pollJellyfin();
pollMediaServer();

pollGaming();
setInterval(pollGaming, 1800000);
