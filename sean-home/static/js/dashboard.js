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
  const condEl = document.getElementById("weather-condition");
  const hiloEl = document.getElementById("weather-hilo");
  const hwIcon = document.getElementById("header-weather-icon");
  const hwTemp = document.getElementById("header-weather-temp");
  const hwDesc = document.getElementById("header-weather-desc");
  const card   = document.getElementById("weather-card");
  if (!iconEl) return;

  const setUnavailable = () => {
    iconEl.innerHTML = "⚠️";
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

    // Header
    if (hwIcon) {
      if (typeof getWeatherIcon === "function") {
        hwIcon.innerHTML = getWeatherIcon(d.condition);
      } else {
        hwIcon.textContent = d.icon;
      }
    }
    if (hwTemp) hwTemp.textContent = `${d.temperature_f}°`;
    if (hwDesc) hwDesc.textContent = `${d.condition}  ·  Low ${d.low_f}°`;

    // Card scene tint
    if (card) {
      const wClass = weatherClass(d.condition);
      card.className = `card card-weather${wClass ? " " + wClass : ""}`;
    }

    // Main icon — SVG or emoji
    if (typeof getWeatherIcon === "function") {
      iconEl.innerHTML = getWeatherIcon(d.condition);
    } else {
      iconEl.textContent = d.icon;
    }

    // Condition + H/L
    if (condEl) {
      condEl.textContent = d.condition;
      condEl.className = "weather-condition";
    }
    if (hiloEl) hiloEl.textContent = `H: ${d.high_f}°  ·  L: ${d.low_f}°`;

    // Detail row — feels like, wind, rain, humidity
    const detailEl = document.getElementById("weather-detail");
    if (detailEl) {
      const chips = [
        d.feels_like_f  !== undefined ? `Feels ${d.feels_like_f}°`          : null,
        d.wind_mph      !== undefined ? `Wind ${d.wind_mph} mph`             : null,
        d.precip_chance !== undefined ? `Rain ${d.precip_chance}%`           : null,
        d.humidity_pct  !== undefined ? `Humidity ${d.humidity_pct}%`        : null,
      ].filter(Boolean);
      detailEl.innerHTML = chips.map(c => `<span class="wx-chip">${c}</span>`).join("");
    }

    // Hourly strip
    const hourlyEl = document.getElementById("weather-hourly");
    if (hourlyEl && d.hourly && d.hourly.length) {
      hourlyEl.innerHTML = d.hourly.map(h => `
        <div class="wx-hour">
          <div class="wx-h-label">${h.label}</div>
          <div class="wx-h-icon">${h.icon}</div>
          <div class="wx-h-temp">${h.temp_f}°</div>
          ${h.precip_chance >= 20 ? `<div class="wx-h-rain">${h.precip_chance}%</div>` : ""}
        </div>`).join("");
    }

    // Sunrise / Sunset
    const sunEl = document.getElementById("weather-sun");
    if (sunEl && d.sunrise && d.sunset) {
      sunEl.innerHTML = `<span>☀ ${d.sunrise}</span><span class="wx-sun-sep">·</span><span>🌅 ${d.sunset}</span>`;
    }

    // Tomorrow + weekend
    const forecastEl = document.getElementById("weather-forecast");
    if (forecastEl) {
      const rows = [];
      if (d.tomorrow) {
        const r = d.tomorrow;
        const rain = r.precip_chance > 0 ? ` · Rain ${r.precip_chance}%` : "";
        rows.push(`<div class="wx-forecast-row"><span class="wx-day">Tomorrow</span><span class="wx-ficon">${r.icon}</span><span class="wx-ftemps">${r.high_f}° / ${r.low_f}°${rain}</span></div>`);
      }
      if (d.weekend) {
        const r = d.weekend;
        const rain = r.precip_chance > 0 ? ` · Rain ${r.precip_chance}%` : "";
        rows.push(`<div class="wx-forecast-row"><span class="wx-day">${r.day}</span><span class="wx-ficon">${r.icon}</span><span class="wx-ftemps">${r.high_f}° / ${r.low_f}°${rain}</span></div>`);
      }
      forecastEl.innerHTML = rows.join("");
    }

  } catch {
    console.warn("Sean Home: weather unavailable");
    setUnavailable();
  }
}

/* ── Live Strip — single most important live event ───────────── */
async function pollLiveStrip() {
  const stripEl = document.getElementById("live-strip");
  if (!stripEl) return;

  try {
    const res = await fetch("/api/tonight");
    if (!res.ok) throw new Error();
    const d = await res.json();

    const live = (d.available && d.sports && d.sports.live) ? d.sports.live : [];

    if (!live.length) {
      stripEl.classList.remove("is-live");
      stripEl.innerHTML = "";
      stripEl.setAttribute("aria-hidden", "true");
      setTimeout(pollLiveStrip, 120000);
      return;
    }

    // Show only the first (most important) live event
    const g = live[0];
    const isWC = (g.team === "World Cup" || (g.opponent || "").includes("@"));
    let html = "";

    if (isWC) {
      const m     = parseMatchup(g.opponent);
      const score  = g.score  || "–";
      const period = g.period || "Live";
      html = `
        <div class="ls-badge"><span class="ls-live-dot"></span>LIVE</div>
        <div class="ls-wc-matchup">
          <div class="ls-team-side">
            <span class="ls-flag">${getFlag(m.away)}</span>
            <span class="ls-team-name">${m.away}</span>
          </div>
          <div class="ls-score">${score}</div>
          <div class="ls-period">${period}</div>
          <div class="ls-team-side ls-home">
            <span class="ls-team-name">${m.home}</span>
            <span class="ls-flag">${getFlag(m.home)}</span>
          </div>
        </div>
        <div class="ls-sport-label">World Cup</div>`;
    } else {
      const score  = g.score  || "–";
      const period = g.period || "Live";
      html = `
        <div class="ls-badge"><span class="ls-live-dot"></span>LIVE</div>
        <div class="ls-regular-matchup">
          <span class="ls-regular-team">${g.team}</span>
          <span class="ls-period">vs ${g.opponent || ""}</span>
        </div>
        <div class="ls-regular-score">${score}</div>
        <div class="ls-period">${period}</div>`;
    }

    stripEl.innerHTML = html;
    stripEl.classList.add("is-live");
    stripEl.removeAttribute("aria-hidden");

  } catch {
    console.warn("Sean Home: live strip unavailable");
    stripEl.classList.remove("is-live");
  }

  const isActive = stripEl.classList.contains("is-live");
  setTimeout(pollLiveStrip, isActive ? 60000 : 120000);
}

/* ── TODAY card — "what matters today?" ─────────────────────── */
async function pollToday() {
  const bodyEl = document.getElementById("today-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/tonight");
    if (!res.ok) throw new Error();
    const d = await res.json();

    const upcoming = (d.available && d.sports?.upcoming) ? d.sports.upcoming : [];
    const finals   = (d.available && d.sports?.finals)   ? d.sports.finals   : [];
    const gaming   = d.gaming || null;

    const parts = [];

    // ── Tonight's schedule ──────────────────────────────────────
    const events = [];
    for (const g of upcoming.slice(0, 3)) {
      const isWC = g.team === "World Cup" && (g.opponent || "").includes("@");
      let opp = "";
      if (isWC) {
        const m = parseMatchup(g.opponent);
        opp = `${getFlag(m.away)} ${m.away} vs ${m.home} ${getFlag(m.home)}`;
      } else if (g.opponent) {
        opp = `vs ${g.opponent}`;
      }
      events.push(`
        <div class="td-event">
          <div class="td-event-body">
            <div class="td-event-team">${g.team}</div>
            ${opp ? `<div class="td-event-opp">${opp}</div>` : ""}
          </div>
          <div class="td-event-time">${g.time || "TBD"}</div>
        </div>`);
    }

    // If no upcoming, show most recent final
    if (!events.length && finals.length) {
      const g = finals[0];
      const rCls = g.result === "W" ? "td-result-win" : g.result === "L" ? "td-result-loss" : "";
      events.push(`
        <div class="td-event">
          <div class="td-event-body">
            <div class="td-event-team ${rCls}">${g.team}</div>
            <div class="td-event-opp">vs ${g.opponent}</div>
          </div>
          <div class="td-event-time td-event-score ${rCls}">${g.score || "–"}</div>
        </div>`);
    }

    if (events.length) {
      parts.push(`
        <div class="td-section">
          <div class="td-section-label">Tonight</div>
          ${events.join("")}
        </div>`);
    } else {
      parts.push(`
        <div class="td-section">
          <div class="td-section-label">Tonight</div>
          <div class="td-empty">No games tonight</div>
        </div>`);
    }

    // ── Calendar ────────────────────────────────────────────────
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    parts.push(`
      <div class="td-divider"></div>
      <div class="td-section">
        <div class="td-section-label">Calendar</div>
        <div class="td-cal-row">
          <div class="td-cal-info">
            <div class="td-cal-day">Today</div>
            <div class="td-cal-date">${todayStr}</div>
          </div>
        </div>
        <div class="td-cal-row td-cal-dim">
          <div class="td-cal-info">
            <div class="td-cal-day">Tomorrow</div>
            <div class="td-cal-date">${tomorrowStr}</div>
          </div>
        </div>
        <div class="td-cal-note">Google Calendar · coming soon</div>
      </div>`);

    // ── Gaming ──────────────────────────────────────────────────
    if (gaming && gaming.available) {
      const status   = gaming.fortnite_status || "Online";
      const headline = gaming.headline || "";
      parts.push(`
        <div class="td-divider"></div>
        <div class="td-section">
          <div class="td-section-label">Gaming</div>
          <div class="td-gaming">
            <span class="td-gaming-name">Fortnite</span>
            <span class="td-gaming-badge">${status}</span>
          </div>
          ${headline ? `<div class="td-gaming-headline">${headline}</div>` : ""}
        </div>`);
    }

    bodyEl.innerHTML = parts.join("");

  } catch {
    console.warn("Sean Home: today unavailable");
    bodyEl.innerHTML = `<div class="td-empty">Unavailable</div>`;
  }

  setTimeout(pollToday, 120000);
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
    const g = team.live;
    const m = parseMatchup(g.matchup);
    const score  = g.score || "–";
    const period = g.period || "Live";
    const round  = g.round  ? ` · ${g.round}` : "";

    // Goal scorers grouped by side
    const goals = g.goals || [];
    let goalHtml = "";
    if (goals.length) {
      const awayGoals = goals.filter(x => x.side === "away").map(x => `${x.player} ${x.minute}`).join(", ");
      const homeGoals = goals.filter(x => x.side === "home").map(x => `${x.player} ${x.minute}`).join(", ");
      goalHtml = `<div class="wc-goals-line">
        <span class="wc-goals-side">${awayGoals || "—"}</span>
        <span class="wc-goals-sep">·</span>
        <span class="wc-goals-side">${homeGoals || "—"}</span>
      </div>`;
    }

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
        ${goalHtml}
        <div class="wc-status-line wc-status-live">
          <span class="sb-live-dot"></span>LIVE · ${period}${round}
        </div>
      </div>`;
  }
  if (team.next) {
    const g = team.next;
    const m = parseMatchup(g.matchup);
    const round = g.round ? `<span class="wc-round">${g.round}</span>` : "";
    return `
      <div class="sb-row sb-row-wc sb-row-wc-next" data-team="world_cup">
        <div class="wc-matchup-line">
          <div class="wc-team-away">
            <span class="wc-flag">${getFlag(m.away)}</span>
            <span class="wc-name">${m.away}</span>
          </div>
          <div class="wc-score-center">
            <div class="wc-score-time">${g.time || "TBD"}</div>
          </div>
          <div class="wc-team-home">
            <span class="wc-name">${m.home}</span>
            <span class="wc-flag">${getFlag(m.home)}</span>
          </div>
        </div>
        <div class="wc-status-line wc-status-next">⚽ World Cup${round ? " · " : ""}${round}</div>
      </div>`;
  }
  if (team.last) {
    const g = team.last;
    const m = parseMatchup(g.matchup);
    const score = g.score || "–";
    const round = g.round ? ` · ${g.round}` : "";
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
        <div class="wc-status-line wc-status-final">Final${round}</div>
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

const TEAM_LEAGUES = {
  phillies: "mlb", eagles: "nfl", sixers: "nba", flyers: "nhl",
};

function teamLogo(key) {
  const url = TEAM_LOGOS[key];
  if (!url) return "";
  return `<img class="sb-logo" src="${url}" alt="" loading="lazy" onerror="this.style.display='none'">`;
}

function oppLogo(abbr, league) {
  if (!abbr || !league) return "";
  const src = `https://a.espncdn.com/i/teamlogos/${league}/500/${abbr}.png`;
  return `<img class="sb-logo sb-logo-opp" src="${src}" alt="" loading="lazy" onerror="this.style.display='none'">`;
}

function buildPitcherRow(pitchers) {
  const isPhiHome = (pitchers.home_abbr || "").toLowerCase() === "phi";
  const us   = isPhiHome ? pitchers.home : pitchers.away;
  const them = isPhiHome ? pitchers.away : pitchers.home;
  const usStr   = us   ? `${us.name}  ${us.W}-${us.L}  ${us.ERA} ERA` : "TBD";
  const themStr = them ? `${them.name}  ${them.W}-${them.L}  ${them.ERA} ERA` : "TBD";
  return `
    <div class="sb-pitcher-row">
      <span class="sb-pitcher-us">${usStr}</span>
      <span class="sb-pitcher-vs">vs</span>
      <span class="sb-pitcher-them">${themStr}</span>
    </div>`;
}

function renderSportsRow(team, key) {
  if (!team || team.available === false) return "";

  // World Cup always uses its own horizontal matchup renderer
  if (key === "world_cup") return renderWCRow(team);

  const teamAttr = `data-team="${key}"`;
  const logo     = teamLogo(key);
  const league   = TEAM_LEAGUES[key] || "";

  if (team.live) {
    const g = team.live;
    const score  = g.score || `${g.my_score ?? "—"}-${g.opp_score ?? "—"}`;
    const period = g.period || "Live";
    const opp    = oppLogo(g.opponent_abbr, league);
    const record = team.record ? `<span class="sb-record">${team.record}</span>` : "";
    return `
      <div class="sb-row sb-row-live sb-row-hero" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}${record ? " " : ""}${record}</div>
          <div class="sb-sub sb-sub-live"><span class="sb-live-dot"></span>LIVE · ${period}</div>
        </div>
        ${opp}
        <div class="sb-score sb-score-live">${score}</div>
      </div>`;
  }

  if (team.next) {
    const g = team.next;
    const opp      = oppLogo(g.opponent_abbr, league);
    const haway    = g.home_away === "home" ? "vs" : "@";
    const record   = team.record ? `${team.record} · ` : "";
    const oppRec   = g.opponent_record ? ` (${g.opponent_record})` : "";
    const matchup  = g.opponent ? `${record}${haway} ${g.opponent}${oppRec}` : record;
    // Date on its own line so it doesn't get truncated by long opponent names
    const dateLine = g.date ? `<div class="sb-sub sb-sub-date">${g.date}</div>` : "";
    const pitchers = (key === "phillies" && team.pitchers) ? buildPitcherRow(team.pitchers) : "";
    return `
      <div class="sb-row" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}</div>
          ${matchup ? `<div class="sb-sub">${matchup}</div>` : ""}
          ${dateLine}
          ${pitchers}
        </div>
        ${opp}
        <div class="sb-time">${g.time || "TBD"}</div>
      </div>`;
  }

  // No upcoming game — headline takes priority over stale last result (offseason)
  if (team.headline) {
    const standing = team.standing || "Offseason";
    return `
      <div class="sb-row" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}</div>
          <div class="sb-sub">${standing}${team.record ? " · " + team.record : ""}</div>
          <div class="sb-headline">${team.headline}</div>
        </div>
      </div>`;
  }

  // Last result — only shown when no headline available
  if (team.last) {
    const g = team.last;
    const score    = g.score || `${g.my_score ?? "—"}-${g.opp_score ?? "—"}`;
    const result   = g.result || "";
    const subLabel = result === "W" ? "Win" : result === "L" ? "Loss" : "Final";
    const record   = team.record ? ` · ${team.record}` : "";
    const subCls   = result === "W" ? "sb-sub-win" : result === "L" ? "sb-sub-loss" : "";
    const scoreCls = result === "W" ? "sb-score-win" : result === "L" ? "sb-score-loss" : "";
    const opp      = oppLogo(g.opponent_abbr, league);
    return `
      <div class="sb-row" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}</div>
          <div class="sb-sub ${subCls}">${subLabel}${record}</div>
        </div>
        ${opp}
        <div class="sb-score ${scoreCls}">${score}</div>
      </div>`;
  }

  return "";
}

/* ── News Card — team headlines drawn from sports data ────────── */
const NEWS_ORDER  = ["eagles", "sixers", "flyers", "phillies"];
const NEWS_COLORS = {
  phillies: "#e81828",
  eagles:   "#00b140",
  sixers:   "#006bb6",
  flyers:   "#f74902",
};
const NEWS_NAMES = {
  phillies: "Phillies", eagles: "Eagles", sixers: "Sixers", flyers: "Flyers",
};

function renderNewsCard(teams) {
  const bodyEl = document.getElementById("news-body");
  if (!bodyEl) return;

  const items = [];
  for (const key of NEWS_ORDER) {
    const team = teams && teams[key];
    if (!team) continue;
    const headline = team.headline || "";
    if (!headline) continue;
    const color = NEWS_COLORS[key] || "var(--text-3)";
    const name  = NEWS_NAMES[key]  || key;
    items.push(`
      <div class="news-item">
        <div class="news-accent" style="background:${color}"></div>
        <div class="news-team-info">
          <div class="news-team-name" style="color:${color}">${name}</div>
          <div class="news-headline">${headline}</div>
        </div>
      </div>`);
  }

  bodyEl.innerHTML = items.length
    ? items.join("")
    : `<p class="card-placeholder">No news available</p>`;
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

      renderNewsCard(d.teams);
    }
  } catch {
    console.warn("Sean Home: sports unavailable");
    listEl.innerHTML = `<div class="sb-placeholder">Sports unavailable</div>`;
    renderNewsCard(null);
  }

  setTimeout(pollSports, nextDelay);
}

/* Gaming is now rendered inside pollToday() via the tonight API */

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
      bodyEl.innerHTML = `
        <div class="jf-offline">
          <div class="jf-offline-title">Media Library</div>
          <div class="jf-offline-status">Starting up...</div>
          <div class="jf-offline-hint">Jellyfin is loading. Usually ready within 60 seconds of reboot.</div>
        </div>`;
      setTimeout(pollJellyfin, 30000);
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
    bodyEl.innerHTML = `
      <div class="jf-offline">
        <div class="jf-offline-title">Media Library</div>
        <div class="jf-offline-status">Starting up...</div>
        <div class="jf-offline-hint">Jellyfin is loading. Usually ready within 60 seconds of reboot.</div>
      </div>`;
  }

  setTimeout(pollJellyfin, 30000);
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
setInterval(setTimeOfDayScene, 3600000);

tickClock();
setInterval(tickClock, 1000);

pollSystemStatus();
setInterval(pollSystemStatus, 30000);

pollWeather();
setInterval(pollWeather, 600000);

pollLiveStrip();
pollToday();
pollSports();
pollMediaServer();
