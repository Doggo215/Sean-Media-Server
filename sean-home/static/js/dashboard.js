// Sean Home — TV Dashboard
// 65" display · 10 ft viewing distance · Apple TV / PS5 design language
// Phase K: one coherent scene. Favor recognition over reading.

/* ── Time-of-day scene ───────────────────────────────────────── */
function setTimeOfDayScene() {
  const h = new Date().getHours();
  const scene =
    h >= 5  && h < 12 ? "morning"    :
    h >= 12 && h < 17 ? "afternoon"  :
    h >= 17 && h < 22 ? "evening"    : "late-night";
  document.body.classList.remove(
    "scene-morning","scene-afternoon","scene-evening","scene-late-night"
  );
  document.body.classList.add("scene-" + scene);
}

/* ── Clock ───────────────────────────────────────────────────── */
function tickClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

/* ── Utility ─────────────────────────────────────────────────── */
function classify(v, warnAt, alertAt) {
  return v >= alertAt ? "alert" : v >= warnAt ? "warn" : "good";
}
function svcDot(status) {
  const cls = status === "active" ? "svc-ok" : status === "inactive" ? "svc-warn" : "svc-err";
  return `<span class="svc-dot ${cls}"></span>`;
}
function weatherClass(condition) {
  const c = (condition || "").toLowerCase();
  if (c.includes("thunder") || c.includes("storm")) return "weather-stormy";
  if (c.includes("snow") || c.includes("blizzard") || c.includes("ice")) return "weather-snowy";
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return "weather-rainy";
  if (c.includes("cloud") || c.includes("overcast") || c.includes("fog") || c.includes("mist")) return "weather-cloudy";
  if (c.includes("sun") || c.includes("clear") || c.includes("fair")) return "weather-sunny";
  return "";
}

/* ── System (hidden status card) ────────────────────────────── */
async function pollSystemStatus() {
  try {
    const res = await fetch("/api/system");
    if (!res.ok) throw new Error();
    const d = await res.json();
    const set = (id, text, cls) => {
      const el = document.getElementById(id);
      if (el) { el.textContent = text; if (cls) el.className = "stat-value " + cls; }
    };
    set("disk-pct",  `${d.disk.root_pct}%`,      classify(d.disk.root_pct,  80, 95));
    set("disk-free", `${d.disk.root_free_gb} GB`);
    set("ram-pct",   `${d.ram.used_pct}%`,        classify(d.ram.used_pct,   80, 95));
    set("cpu-pct",   `${d.cpu.used_pct}%`);
    if (d.cpu.temp_c !== null)
      set("cpu-temp", `${d.cpu.temp_c}°C`, classify(d.cpu.temp_c, 70, 80));
  } catch { /* hidden — fail silently */ }
}

/* ── Weather ─────────────────────────────────────────────────── */
async function pollWeather() {
  const iconEl = document.getElementById("weather-icon");
  const tempEl = document.getElementById("weather-temp");
  const condEl = document.getElementById("weather-condition");
  const hiloEl = document.getElementById("weather-hilo");
  const hwIcon = document.getElementById("header-weather-icon");
  const hwTemp = document.getElementById("header-weather-temp");
  const hwDesc = document.getElementById("header-weather-desc");
  const card   = document.getElementById("weather-card");
  if (!iconEl) return;

  const setUnavailable = () => {
    iconEl.innerHTML = "⚠️";
    if (tempEl) tempEl.textContent = "—°";
    if (condEl) { condEl.textContent = "Unavailable"; condEl.className = "weather-unavailable"; }
    if (hiloEl) hiloEl.textContent = "";
    if (hwIcon) hwIcon.textContent = "⚠️";
    if (hwTemp) hwTemp.textContent = "—°";
    if (hwDesc) hwDesc.textContent = "Weather unavailable";
  };

  try {
    const res = await fetch("/api/weather");
    if (!res.ok) throw new Error();
    const d = await res.json();
    if (!d.available) { setUnavailable(); return; }

    if (typeof getWeatherIcon === "function") {
      iconEl.innerHTML = getWeatherIcon(d.condition);
    } else {
      iconEl.innerHTML = d.icon;
    }

    if (tempEl) tempEl.textContent = `${d.temperature_f}°`;
    if (condEl) { condEl.textContent = d.condition + (d.stale ? " (cached)" : ""); condEl.className = "weather-condition"; }
    if (hiloEl) hiloEl.textContent  = `H: ${d.high_f}°  ·  L: ${d.low_f}°`;

    if (hwIcon) hwIcon.textContent = d.icon;
    if (hwTemp) hwTemp.textContent = `${d.temperature_f}°`;
    if (hwDesc) hwDesc.textContent = `${d.condition}  ·  Low ${d.low_f}°`;

    if (card) {
      const wClass = weatherClass(d.condition);
      card.className = `card card-weather${wClass ? " " + wClass : ""}`;
    }
  } catch {
    console.warn("Sean Home: weather unavailable");
    setUnavailable();
  }
}

/* ── Tonight ─────────────────────────────────────────────────── */
async function pollTonight() {
  const bodyEl = document.getElementById("tonight-body");
  if (!bodyEl) return;

  const unavail = () => {
    bodyEl.innerHTML = `<div class="tn-callout tn-callout-dim"><div class="tn-co-body"><div class="tn-co-label">Tonight unavailable</div></div></div>`;
    setTimeout(pollTonight, 120000);
  };

  try {
    const res = await fetch("/api/tonight");
    if (!res.ok) throw new Error();
    const d = await res.json();
    if (!d.available) { unavail(); return; }

    const callouts = [];

    // Weather
    if (d.weather && d.weather.available) {
      callouts.push(`
        <div class="tn-callout">
          <div class="tn-co-icon">${d.weather.icon}</div>
          <div class="tn-co-body">
            <div class="tn-co-value">${d.weather.temp_f}°<span class="tn-co-unit">F</span></div>
            <div class="tn-co-label">${d.weather.condition}</div>
            <div class="tn-co-sub">Low ${d.weather.low_f}° tonight</div>
          </div>
        </div>`);
    }

    // Sports — best available
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
        </div>`);
    } else if (upcoming.length) {
      const g = upcoming[0];
      callouts.push(`
        <div class="tn-callout">
          <div class="tn-co-icon">🏟️</div>
          <div class="tn-co-body">
            <div class="tn-co-value">${g.time || "TBD"}</div>
            <div class="tn-co-label">${g.team} vs ${g.opponent}</div>
            <div class="tn-co-sub">Tonight</div>
          </div>
        </div>`);
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
        </div>`);
    } else {
      callouts.push(`
        <div class="tn-callout tn-callout-dim">
          <div class="tn-co-icon">🏟️</div>
          <div class="tn-co-body"><div class="tn-co-label">No games tonight</div></div>
        </div>`);
    }

    // Media
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
          </div>`);
      } else if (ra) {
        callouts.push(`
          <div class="tn-callout">
            <div class="tn-co-icon">✨</div>
            <div class="tn-co-body">
              <div class="tn-co-label">${ra.label}</div>
              <div class="tn-co-sub">New in library</div>
            </div>
          </div>`);
      }
    }

    bodyEl.innerHTML = callouts.join("");
  } catch {
    console.warn("Sean Home: tonight unavailable");
    unavail();
  }

  setTimeout(pollTonight, 120000);
}

/* ── Sports ──────────────────────────────────────────────────── */
const SPORTS_ORDER = ["phillies", "eagles", "sixers", "flyers", "world_cup"];

/* Country flag emoji lookup for World Cup matchups */
const COUNTRY_FLAGS = {
  "argentina":"🇦🇷","australia":"🇦🇺","austria":"🇦🇹","belgium":"🇧🇪",
  "bolivia":"🇧🇴","brazil":"🇧🇷","cameroon":"🇨🇲","canada":"🇨🇦",
  "chile":"🇨🇱","china":"🇨🇳","colombia":"🇨🇴","costa rica":"🇨🇷",
  "croatia":"🇭🇷","cuba":"🇨🇺","denmark":"🇩🇰","ecuador":"🇪🇨",
  "egypt":"🇪🇬","el salvador":"🇸🇻","england":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","fiji":"🇫🇯",
  "france":"🇫🇷","germany":"🇩🇪","ghana":"🇬🇭","guatemala":"🇬🇹",
  "haiti":"🇭🇹","honduras":"🇭🇳","hungary":"🇭🇺","indonesia":"🇮🇩",
  "iran":"🇮🇷","ireland":"🇮🇪","ivory coast":"🇨🇮","côte d'ivoire":"🇨🇮",
  "jamaica":"🇯🇲","japan":"🇯🇵","kenya":"🇰🇪","korea republic":"🇰🇷",
  "mexico":"🇲🇽","morocco":"🇲🇦","netherlands":"🇳🇱","new zealand":"🇳🇿",
  "nigeria":"🇳🇬","norway":"🇳🇴","panama":"🇵🇦","paraguay":"🇵🇾",
  "peru":"🇵🇪","poland":"🇵🇱","portugal":"🇵🇹","qatar":"🇶🇦",
  "romania":"🇷🇴","saudi arabia":"🇸🇦","scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","senegal":"🇸🇳",
  "serbia":"🇷🇸","slovakia":"🇸🇰","south africa":"🇿🇦","south korea":"🇰🇷",
  "spain":"🇪🇸","sweden":"🇸🇪","switzerland":"🇨🇭","trinidad and tobago":"🇹🇹",
  "turkey":"🇹🇷","ukraine":"🇺🇦","united states":"🇺🇸","usa":"🇺🇸",
  "uruguay":"🇺🇾","venezuela":"🇻🇪","wales":"🏴󠁧󠁢󠁷󠁬󠁳󠁿",
};

function getFlag(name) {
  if (!name) return "🌍";
  return COUNTRY_FLAGS[(name || "").toLowerCase()] || "🌍";
}

/* "Ecuador @ Mexico" → { away: "Ecuador", home: "Mexico" } */
function parseMatchup(str) {
  if (!str) return { away: "", home: "" };
  const parts = str.split(" @ ");
  return { away: (parts[0] || "").trim(), home: (parts[1] || "").trim() };
}

/* World Cup dedicated renderer — always shows both teams + flags */
function renderWCRow(team) {
  if (team.live) {
    const m = parseMatchup(team.live.matchup);
    const score  = team.live.score || "–";
    const period = team.live.period || "Live";
    return `
      <div class="sb-row sb-row-wc sb-row-wc-live" data-team="world_cup">
        <div class="wc-matchup-line">
          <div class="wc-team-away">
            <span class="wc-flag">${getFlag(m.away)}</span>
            <span class="wc-name">${m.away}</span>
          </div>
          <div class="wc-score-center">
            <div class="wc-score-num wc-score-num-live">${score}</div>
          </div>
          <div class="wc-team-home">
            <span class="wc-name">${m.home}</span>
            <span class="wc-flag">${getFlag(m.home)}</span>
          </div>
        </div>
        <div class="wc-status-line wc-status-live">
          <span class="sb-live-dot"></span>LIVE · ${period}
        </div>
      </div>`;
  }
  if (team.next) {
    const m = parseMatchup(team.next.matchup);
    return `
      <div class="sb-row sb-row-wc sb-row-wc-next" data-team="world_cup">
        <div class="wc-matchup-line">
          <div class="wc-team-away">
            <span class="wc-flag">${getFlag(m.away)}</span>
            <span class="wc-name">${m.away}</span>
          </div>
          <div class="wc-score-center">
            <div class="wc-score-time">${team.next.time || "TBD"}</div>
          </div>
          <div class="wc-team-home">
            <span class="wc-name">${m.home}</span>
            <span class="wc-flag">${getFlag(m.home)}</span>
          </div>
        </div>
        <div class="wc-status-line wc-status-next">World Cup</div>
      </div>`;
  }
  if (team.last) {
    const m = parseMatchup(team.last.matchup);
    const score = team.last.score || "–";
    return `
      <div class="sb-row sb-row-wc sb-row-wc-last" data-team="world_cup">
        <div class="wc-matchup-line">
          <div class="wc-team-away">
            <span class="wc-flag">${getFlag(m.away)}</span>
            <span class="wc-name">${m.away}</span>
          </div>
          <div class="wc-score-center">
            <div class="wc-score-num">${score}</div>
          </div>
          <div class="wc-team-home">
            <span class="wc-name">${m.home}</span>
            <span class="wc-flag">${getFlag(m.home)}</span>
          </div>
        </div>
        <div class="wc-status-line wc-status-final">Final · World Cup</div>
      </div>`;
  }
  return "";
}

const TEAM_LOGOS = {
  phillies:  "https://a.espncdn.com/i/teamlogos/mlb/500/phi.png",
  eagles:    "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png",
  sixers:    "https://a.espncdn.com/i/teamlogos/nba/500/phi.png",
  flyers:    "https://a.espncdn.com/i/teamlogos/nhl/500/phi.png",
  world_cup: "https://a.espncdn.com/i/leaguelogos/soccer/500/68.png",
};

function teamLogo(key) {
  const url = TEAM_LOGOS[key];
  if (!url) return "";
  return `<img class="sb-logo" src="${url}" alt="" loading="lazy" onerror="this.style.display='none'">`;
}

function renderSportsRow(team, key) {
  if (!team || team.available === false) return "";

  // World Cup always uses its own horizontal matchup renderer
  if (key === "world_cup") return renderWCRow(team);

  const teamAttr = `data-team="${key}"`;
  const logo = teamLogo(key);

  if (team.live) {
    const score  = team.live.score || `${team.live.my_score ?? "—"}-${team.live.opp_score ?? "—"}`;
    const period = team.live.period || "Live";
    return `
      <div class="sb-row sb-row-live sb-row-hero" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}</div>
          <div class="sb-sub sb-sub-live"><span class="sb-live-dot"></span>LIVE · ${period}</div>
        </div>
        <div class="sb-score sb-score-live">${score}</div>
      </div>`;
  }

  if (team.next) {
    const sub = team.next.opponent ? `vs ${team.next.opponent}` : "";
    return `
      <div class="sb-row" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}</div>
          ${sub ? `<div class="sb-sub">${sub}</div>` : ""}
        </div>
        <div class="sb-time">${team.next.time || "TBD"}</div>
      </div>`;
  }

  if (team.last) {
    const score    = team.last.score || `${team.last.my_score ?? "—"}-${team.last.opp_score ?? "—"}`;
    const result   = team.last.result || "";
    const sub      = result === "W" ? "Win" : result === "L" ? "Loss" : "Final";
    const subCls   = result === "W" ? "sb-sub-win" : result === "L" ? "sb-sub-loss" : "";
    const scoreCls = result === "W" ? "sb-score-win" : result === "L" ? "sb-score-loss" : "";
    return `
      <div class="sb-row" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}</div>
          <div class="sb-sub ${subCls}">${sub}</div>
        </div>
        <div class="sb-score ${scoreCls}">${score}</div>
      </div>`;
  }

  return "";
}

async function pollSports() {
  const listEl  = document.getElementById("sports-list");
  const sportsCard = document.getElementById("sports-card");
  if (!listEl) return;
  let nextDelay = 600000;

  try {
    const res = await fetch("/api/sports");
    if (!res.ok) throw new Error();
    const d = await res.json();

    if (!d.available) {
      listEl.innerHTML = `<div class="sb-placeholder">Sports unavailable</div>`;
    } else {
      const rows = SPORTS_ORDER
        .filter(k => d.teams[k])
        .map(k => renderSportsRow(d.teams[k], k))
        .filter(Boolean)
        .join("");
      listEl.innerHTML = rows || `<div class="sb-placeholder">No games data</div>`;
      nextDelay = d.live_active ? 60000 : 600000;

      // Live state classes
      const hasWcLive   = !!(d.teams.world_cup && d.teams.world_cup.live);
      const hasTeamLive = SPORTS_ORDER.filter(k => k !== "world_cup")
                            .some(k => d.teams[k] && d.teams[k].live);
      const hasAnyLive  = hasWcLive || hasTeamLive;

      if (sportsCard) sportsCard.classList.toggle("has-live", hasAnyLive);

      // Scoreboard hero compresses non-hero rows when a Philly team is live
      listEl.classList.toggle("has-hero", hasTeamLive);

      // Grid expands sports column when any live game is active
      const gridEl = document.querySelector(".tv-content-grid");
      if (gridEl) gridEl.classList.toggle("sports-hero", hasAnyLive);
    }
  } catch {
    console.warn("Sean Home: sports unavailable");
    listEl.innerHTML = `<div class="sb-placeholder">Sports unavailable</div>`;
  }

  setTimeout(pollSports, nextDelay);
}

/* ── Gaming — hero layout, one featured item ─────────────────── */
function renderGaming(data) {
  const fn = data.fortnite;

  if (!fn || !fn.available) {
    return `
      <div class="gaming-hero">
        <div class="gaming-hero-title">Gaming</div>
      </div>
      <div class="gaming-dim">Fortnite unavailable</div>`;
  }

  const badge = `<span class="gaming-status-badge">${fn.status || "Online"}</span>`;
  let feature = "";

  // Show the first shop item as the hero feature
  const topShop = (fn.shop || [])[0];
  if (topShop) {
    const price = topShop.price ? `${topShop.price} V-Bucks` : "Shop";
    feature = `
      <div class="gaming-feature">
        <div class="gaming-feature-name">${topShop.name}</div>
        <div class="gaming-feature-meta">${price}</div>
      </div>`;
  } else if ((fn.news || [])[0]) {
    // Fall back to top news item if no shop
    feature = `
      <div class="gaming-feature">
        <div class="gaming-feature-name">${fn.news[0].title}</div>
        <div class="gaming-feature-meta">News</div>
      </div>`;
  }

  return `
    <div class="gaming-hero">
      <div class="gaming-hero-title">Fortnite</div>
      ${badge}
    </div>
    ${feature}`;
}

async function pollGaming() {
  const bodyEl = document.getElementById("gaming-body");
  if (!bodyEl) return;
  try {
    const res = await fetch("/api/gaming");
    if (!res.ok) throw new Error();
    const d = await res.json();
    bodyEl.innerHTML = d.available ? renderGaming(d)
      : `<div class="gaming-hero"><div class="gaming-hero-title">Gaming</div></div><div class="gaming-dim">Unavailable</div>`;
  } catch {
    console.warn("Sean Home: gaming unavailable");
    bodyEl.innerHTML = `<div class="gaming-hero"><div class="gaming-hero-title">Gaming</div></div><div class="gaming-dim">Unavailable</div>`;
  }
}

/* ── Entertainment — poster artwork ──────────────────────────── */
function jfThumbFail(img) {
  const wrap = img.parentNode;
  if (wrap) wrap.innerHTML = wrap.dataset.initial || "?";
}

function jfPoster(item, large) {
  const initial = (item.label || "?").charAt(0).toUpperCase();
  const cls = large ? "jf-thumb" : "jf-thumb jf-thumb-sm";
  if (item.id) {
    const jfBase = `http://${window.location.hostname}:8096`;
    const h = large ? 204 : 160;
    const src = `${jfBase}/Items/${item.id}/Images/Primary?maxHeight=${h}&quality=85`;
    return `<div class="${cls}" data-initial="${initial}">` +
           `<img src="${src}" alt="" loading="lazy" onerror="jfThumbFail(this)">` +
           `</div>`;
  }
  return `<div class="${cls}">${initial}</div>`;
}

async function pollJellyfin() {
  const bodyEl = document.getElementById("jellyfin-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/jellyfin");
    if (!res.ok) throw new Error();
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
        sections.push(`
          <div class="jf-poster-row">
            ${jfPoster(item, true)}
            <div class="jf-poster-info">
              <div class="jf-poster-title">${item.label}</div>
              <div class="jf-progress-bar"><div class="jf-progress-fill" style="width:${item.progress}%"></div></div>
              <div class="jf-poster-meta">${item.progress}% watched</div>
            </div>
          </div>`);
      }
    }

    if (d.recently_added && d.recently_added.length) {
      sections.push(`<div class="jf-section-label">Recently Added</div>`);
      // Limit to 2 items — bigger posters need more height
      for (const item of d.recently_added.slice(0, 2)) {
        sections.push(`
          <div class="jf-poster-row">
            ${jfPoster(item, false)}
            <div class="jf-poster-info">
              <div class="jf-poster-title">${item.label}</div>
              <div class="jf-poster-meta">${item.runtime || item.type || ""}</div>
            </div>
          </div>`);
      }
    }

    bodyEl.innerHTML = sections.length
      ? sections.join("")
      : `<p class="card-placeholder">Library is empty</p>`;

  } catch {
    console.warn("Sean Home: Jellyfin unavailable");
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
    if (!res.ok) throw new Error();
    const d = await res.json();

    if (!d.available) {
      bodyEl.innerHTML = `<span class="card-placeholder">Media Server unavailable</span>`;
    } else {
      const svcs = Object.values(d.services)
        .map(s => `<span class="ms-svc">${svcDot(s.status)}${s.label}</span>`).join("");
      const temp = d.cpu.temp_c !== null ? `${d.cpu.temp_c}°C` : "—";
      const imp  = d.last_import.available
        ? `<span class="ms-sep">·</span><span class="ms-stat-chip">Last import <strong>${d.last_import.folder} · ${d.last_import.date}</strong></span>`
        : "";
      bodyEl.innerHTML =
        svcs +
        `<span class="ms-sep">·</span>` +
        `<span class="ms-stat-chip">Disk <strong>${d.disk.pct}%</strong></span>` +
        `<span class="ms-stat-chip">Free <strong>${d.disk.free_gb} GB</strong></span>` +
        `<span class="ms-stat-chip">RAM <strong>${d.ram.used_pct}%</strong></span>` +
        `<span class="ms-stat-chip">Temp <strong>${temp}</strong></span>` +
        `<span class="ms-stat-chip">Up <strong>${d.uptime}</strong></span>` +
        imp;
    }
  } catch {
    console.warn("Sean Home: media server status unavailable");
    bodyEl.innerHTML = `<span class="card-placeholder">Media Server unavailable</span>`;
  }

  setTimeout(pollMediaServer, 60000);
}

/* ── Boot ────────────────────────────────────────────────────── */
setTimeOfDayScene();
setInterval(setTimeOfDayScene, 3600000); // update scene each hour

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
