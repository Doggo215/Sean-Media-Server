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
  const body   = document.getElementById("weather-body");
  const hwIcon = document.getElementById("header-weather-icon");
  const hwTemp = document.getElementById("header-weather-temp");
  const hwDesc = document.getElementById("header-weather-desc");
  const card   = document.getElementById("weather-card");
  if (!body) return;

  const setUnavailable = () => {
    body.innerHTML = `<p class="weather-unavailable">Weather unavailable</p>`;
    if (hwIcon) hwIcon.textContent = "⚠️";
    if (hwTemp) hwTemp.textContent = "—°";
    if (hwDesc) hwDesc.textContent = "Weather unavailable";
  };

  try {
    const res = await fetch("/api/weather");
    if (!res.ok) throw new Error();
    const d = await res.json();
    if (!d.available) { setUnavailable(); return; }

    const useSvg = typeof getWeatherIcon === "function";

    // Header bar
    if (hwIcon) {
      if (useSvg) hwIcon.innerHTML = getWeatherIcon(d.condition);
      else hwIcon.textContent = d.icon;
    }
    if (hwTemp) hwTemp.textContent = `${d.temperature_f}°`;
    if (hwDesc) hwDesc.textContent = `${d.condition}  ·  Low ${d.low_f}°`;

    // Card scene tint
    if (card) {
      const wClass = weatherClass(d.condition);
      card.className = `card card-weather${wClass ? " " + wClass : ""}`;
    }

    // ── SUMMARY — hero icon + temp, details strip below ──────────
    const mainIcon = useSvg ? getWeatherIcon(d.condition) : d.icon;
    const detailParts = [];
    if (d.feels_like_f  !== undefined) detailParts.push(`Feels ${d.feels_like_f}°`);
    if (d.wind_mph      !== undefined) detailParts.push(`Wind ${d.wind_mph} mph`);
    if (d.precip_chance !== undefined) detailParts.push(`Rain ${d.precip_chance}%`);
    if (d.humidity_pct  !== undefined) detailParts.push(`Humidity ${d.humidity_pct}%`);
    const summaryHtml = `
      <div class="wx-summary">
        <div class="wx-hero">
          <span class="wx-main-icon">${mainIcon}</span>
          <div class="wx-hero-info">
            ${d.temperature_f !== undefined ? `<div class="wx-current-temp">${d.temperature_f}°</div>` : ""}
            <div class="wx-main-condition">${d.condition}</div>
            <div class="wx-hilo-line">H ${d.high_f}°&nbsp;/&nbsp;L ${d.low_f}°</div>
          </div>
        </div>
        <div class="wx-details-strip">
          ${detailParts.map(p => `<span class="wx-dl-item">${p}</span>`).join('<span class="wx-dl-sep">·</span>')}
          ${d.sunrise && d.sunset ? `<span class="wx-dl-sep">·</span><span class="wx-dl-item wx-dl-sun">☀ ${d.sunrise} – ${d.sunset}</span>` : ""}
        </div>
      </div>`;

    // ── HOURLY — horizontal chips ─────────────────────────────────
    const hourlyHtml = `
      <div class="wx-hourly-section">
        ${(d.hourly || []).slice(0, 6).map(h => {
          const hIcon = useSvg
            ? `<span class="wx-hc-icon-svg">${getWeatherIcon(h.condition)}</span>`
            : `<span class="wx-hc-icon">${h.icon}</span>`;
          const rainBadge = h.precip_chance >= 20
            ? `<span class="wx-hc-rain">${h.precip_chance}%</span>` : "";
          return `<div class="wx-hour-chip">
            <span class="wx-hc-label">${h.label}</span>
            ${hIcon}
            <span class="wx-hc-temp">${h.temp_f}°</span>
            ${rainBadge}
          </div>`;
        }).join("")}
      </div>`;

    // ── FORECAST — 5-day compact row ──────────────────────────────
    const forecastHtml = (d.daily && d.daily.length) ? `
      <div class="wx-forecast-section">
        ${d.daily.slice(0, 5).map(day => {
          const dIcon = useSvg
            ? `<span class="wx-fd-icon">${getWeatherIcon(day.condition)}</span>`
            : `<span class="wx-fd-icon">${day.icon}</span>`;
          return `<div class="wx-forecast-day">
            <span class="wx-fd-label">${day.label}</span>
            ${dIcon}
            <span class="wx-fd-temps">${day.high_f}°<span class="wx-fd-lo"> / ${day.low_f}°</span></span>
          </div>`;
        }).join("")}
      </div>` : "";

    body.innerHTML = summaryHtml + hourlyHtml + forecastHtml;

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
            <span class="ls-flag">${renderFlagByName(m.away)}</span>
            <span class="ls-team-name">${m.away}</span>
          </div>
          <div class="ls-score">${score}</div>
          <div class="ls-period">${period}</div>
          <div class="ls-team-side ls-home">
            <span class="ls-team-name">${m.home}</span>
            <span class="ls-flag">${renderFlagByName(m.home)}</span>
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

/* ── CALENDAR section — inside Today card ───────────────────── */
function getCalendarEventState(e) {
  const now = Date.now();
  if (e.all_day) return "upcoming";
  const start = e.start_iso ? new Date(e.start_iso).getTime() : null;
  // end_iso from backend; if absent fall back to start + 60 min
  const end = e.end_iso
    ? new Date(e.end_iso).getTime()
    : (start ? start + 60 * 60000 : null);
  if (!start) return "upcoming";
  if (end && now > end) return "completed";
  if (now >= start) return "active";
  if (start - now <= 30 * 60000) return "soon";
  return "upcoming";
}

// Kept separately so the 1-min state timer can re-render without a network fetch
let _lastCalendarData = null;

function renderCalendar(data) {
  const el = document.getElementById("calendar-section");
  if (!el) return;

  if (data.source === "placeholder") {
    el.innerHTML = `
      <div class="cal-header">My Day</div>
      <div class="cal-empty">Connect Google Calendar</div>`;
    return;
  }

  if (data.source === "error") {
    el.innerHTML = `
      <div class="cal-header">My Day</div>
      <div class="cal-empty">Calendar unavailable</div>`;
    return;
  }

  _lastCalendarData = data;

  const rows = data.events_today.map(e => {
    const state = getCalendarEventState(e);
    const loc   = e.location ? `<span class="cal-loc"> · ${e.location}</span>` : "";
    const nowBadge = state === "active" ? `<span class="cal-now-badge">NOW</span>` : "";
    return `<div class="cal-event cal-event-${state}">
      <span class="cal-time">${e.time}</span>
      <span class="cal-title">${e.title}${nowBadge}</span>${loc}
    </div>`;
  }).join("");

  const tomorrowRows = data.events_tomorrow.slice(0, 4).map(e =>
    `<div class="cal-event cal-event-tomorrow">
      <span class="cal-time">${e.time}</span>
      <span class="cal-title">${e.title}</span>
    </div>`
  ).join("");

  el.innerHTML = `
    <div class="cal-header">My Day</div>
    ${rows || '<div class="cal-empty">No events today</div>'}
    ${tomorrowRows ? `<div class="cal-divider">Tomorrow</div>${tomorrowRows}` : ""}`;
}

async function pollCalendar() {
  try {
    const res = await fetch("/api/calendar");
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderCalendar(data);
  } catch {
    const el = document.getElementById("calendar-section");
    if (el) el.innerHTML = "";
  }
  setTimeout(pollCalendar, 300000); // refresh every 5 min
}

// Re-render calendar state every minute without a network fetch
setInterval(() => {
  if (_lastCalendarData) renderCalendar(_lastCalendarData);
}, 60000);

/* ── GMAIL section — inside Today card ──────────────────────── */
function renderGmail(data) {
  const el = document.getElementById("gmail-section");
  if (!el) return;

  if (data.source === "placeholder" || data.source === "error") {
    el.innerHTML = `
      <div class="gmail-header">Gmail</div>
      <div class="gmail-empty">${data.source === "error" ? "Gmail unavailable" : "Connect Gmail"}</div>`;
    return;
  }

  const count = data.unread_count || 0;
  const msgs = (data.important || []).slice(0, 3);

  if (count === 0 && msgs.length === 0) {
    el.innerHTML = `
      <div class="gmail-header">Gmail</div>
      <div class="gmail-empty">Inbox clear</div>`;
    return;
  }

  const countHtml = count > 0
    ? `<span class="gmail-count">${count} unread</span>`
    : "";

  const msgRows = msgs.map(m => {
    const from = (m.from || "").substring(0, 22);
    const subj = (m.subject || "").substring(0, 40);
    return `<div class="gmail-msg">
      <span class="gmail-from">${from}</span>
      <span class="gmail-subj">${subj}</span>
    </div>`;
  }).join("");

  el.innerHTML = `
    <div class="gmail-header-row">
      <span class="gmail-header">Gmail</span>
      ${countHtml}
    </div>
    ${msgRows}`;
}

async function pollGmail() {
  try {
    const res = await fetch("/api/gmail");
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderGmail(data);
  } catch {
    const el = document.getElementById("gmail-section");
    if (el) el.innerHTML = "";
  }
  setTimeout(pollGmail, 300000); // refresh every 5 min
}

/* ── TODAY card — "what matters today?" ─────────────────────── */
async function pollToday() {
  const bodyEl = document.getElementById("today-body");
  if (!bodyEl) return;

  try {
    const res = await fetch("/api/games_today");
    if (!res.ok) throw new Error();
    const d = await res.json();

    const leagues = d.leagues || [];
    const parts = [];

    // ── GAME ON TODAY ────────────────────────────────────────────
    const leagueBlocks = leagues.map(league => {
      const gameRows = league.games.map(g => {
        const isLive = g.status === "in";
        const connector = league.sport === "soccer" ? "vs" : "at";
        const awayLogo = g.away_logo ? `<img class="td-gt-logo" src="${g.away_logo}" alt="" loading="lazy" onerror="this.style.display='none'">` : "";
        const homeLogo = g.home_logo ? `<img class="td-gt-logo" src="${g.home_logo}" alt="" loading="lazy" onerror="this.style.display='none'">` : "";
        const statusLine = isLive
          ? `<div class="td-gt-status-line"><span class="td-gt-live">LIVE</span><span class="td-gt-detail"> · ${g.detail}</span></div>`
          : `<div class="td-gt-status-line"><span class="td-gt-time">${g.time}</span></div>`;
        return `<div class="td-gt-game${isLive ? " td-gt-live-row" : ""}">
          <div class="td-gt-matchup-row">
            ${awayLogo}
            <span class="td-gt-matchup">${g.away_name} <span class="td-gt-connector">${connector}</span> ${g.home_name}</span>
            ${homeLogo}
          </div>
          ${statusLine}
        </div>`;
      }).join("");

      return `<div class="td-gt-league">
        <div class="td-gt-league-label">${league.name}</div>
        ${gameRows}
      </div>`;
    });

    const sportsHtml = leagueBlocks.length
      ? leagueBlocks.join("")
      : `<div class="td-empty">No major games today</div>`;

    parts.push(`<div class="td-section td-section-games">
      <div class="td-section-label">Game On Today</div>
      ${sportsHtml}
    </div>`);

    bodyEl.innerHTML = parts.join("");

  } catch {
    console.warn("Sean Home: games_today unavailable");
    bodyEl.innerHTML = `<div class="td-empty">Unavailable</div>`;
  }

  setTimeout(pollToday, 120000);
}

/* ── Sports ──────────────────────────────────────────────────── */
const SPORTS_ORDER = ["phillies", "eagles", "sixers", "flyers", "world_cup"];

/* Country flag emoji lookup for World Cup matchups */
/* Inline SVG flags — no emoji, no external assets, works on Pi Chromium */
const WC_FLAGS = {
  AUT: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#ED2939"/><rect y="6.67" width="30" height="6.66" fill="#fff"/></svg>`,
  ESP: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/></svg>`,
  CRO: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="6.67" fill="#FF0000"/><rect y="6.67" width="30" height="6.66" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#0093DD"/><g transform="translate(11,3.5)"><rect width="1.14" height="1.14" fill="#FF0000"/><rect x="2.29" width="1.14" height="1.14" fill="#FF0000"/><rect x="4.57" width="1.14" height="1.14" fill="#FF0000"/><rect x="1.14" y="1.14" width="1.14" height="1.14" fill="#FF0000"/><rect x="3.43" y="1.14" width="1.14" height="1.14" fill="#FF0000"/><rect y="1.14" width="1.14" height="1.14" fill="#fff"/><rect x="2.29" y="1.14" width="1.14" height="1.14" fill="#fff"/><rect x="4.57" y="1.14" width="1.14" height="1.14" fill="#fff"/><rect x="1.14" y="2.29" width="1.14" height="1.14" fill="#fff"/><rect x="3.43" y="2.29" width="1.14" height="1.14" fill="#fff"/><rect y="2.29" width="1.14" height="1.14" fill="#FF0000"/><rect x="2.29" y="2.29" width="1.14" height="1.14" fill="#FF0000"/><rect x="4.57" y="2.29" width="1.14" height="1.14" fill="#FF0000"/></g></svg>`,
  POR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#FF0000"/><rect width="12" height="20" fill="#006600"/><circle cx="12" cy="10" r="3.5" fill="none" stroke="#FFD700" stroke-width="1"/><rect x="10.25" y="8.5" width="3.5" height="3" fill="#FFD700" opacity="0.7"/></svg>`,
  ALG: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#fff"/><rect width="15" height="20" fill="#006233"/><circle cx="16" cy="10" r="3.8" fill="#D21034"/><circle cx="17.2" cy="10" r="3.8" fill="#fff"/><polygon points="18,6.5 18.9,9.2 21.7,9.2 19.4,10.9 20.3,13.6 18,11.9 15.7,13.6 16.6,10.9 14.3,9.2 17.1,9.2" fill="#D21034" transform="translate(-1.5,0) scale(0.6) translate(2.5,0)"/></svg>`,
  SUI: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#FF0000"/><rect x="13" y="5" width="4" height="10" fill="#fff"/><rect x="8" y="8" width="14" height="4" fill="#fff"/></svg>`,
  EGY: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="6.67" fill="#CE1126"/><rect y="6.67" width="30" height="6.66" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#000"/><g transform="translate(13,7.5)"><ellipse cx="2" cy="2.5" rx="2" ry="1.5" fill="none" stroke="#C09300" stroke-width="0.6"/><line x1="2" y1="1" x2="2" y2="4" stroke="#C09300" stroke-width="0.5"/><line x1="0.3" y1="2.5" x2="3.7" y2="2.5" stroke="#C09300" stroke-width="0.5"/></g></svg>`,
  AUS: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#00008B"/><rect width="15" height="10" fill="#00008B"/><line x1="0" y1="0" x2="15" y2="10" stroke="#fff" stroke-width="2.5"/><line x1="15" y1="0" x2="0" y2="10" stroke="#fff" stroke-width="2.5"/><line x1="0" y1="0" x2="15" y2="10" stroke="#CC0000" stroke-width="1.5"/><line x1="15" y1="0" x2="0" y2="10" stroke="#CC0000" stroke-width="1.5"/><line x1="7.5" y1="0" x2="7.5" y2="10" stroke="#fff" stroke-width="2.5"/><line x1="0" y1="5" x2="15" y2="5" stroke="#fff" stroke-width="2.5"/><line x1="7.5" y1="0" x2="7.5" y2="10" stroke="#CC0000" stroke-width="1.5"/><line x1="0" y1="5" x2="15" y2="5" stroke="#CC0000" stroke-width="1.5"/></svg>`,
  CPV: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#003893"/><rect y="8" width="30" height="2" fill="#CF2027"/><rect y="11" width="30" height="1" fill="#fff"/><g transform="translate(9,11)"><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="scale(0.5)"/><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="translate(3,0) scale(0.5)"/><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="translate(6,0) scale(0.5)"/><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="translate(9,0) scale(0.5)"/><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="translate(1.5,2) scale(0.5)"/><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="translate(4.5,2) scale(0.5)"/><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="translate(7.5,2) scale(0.5)"/><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="translate(3,4) scale(0.5)"/><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="translate(6,4) scale(0.5)"/><polygon points="2,0 2.6,1.8 4.5,1.8 3,2.9 3.6,4.7 2,3.6 0.4,4.7 1,2.9 -0.5,1.8 1.4,1.8" fill="#FFD700" transform="translate(4.5,6) scale(0.5)"/></g></svg>`,
  ARG: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="6.67" fill="#74ACDF"/><rect y="6.67" width="30" height="6.66" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#74ACDF"/><circle cx="15" cy="10" r="2.5" fill="#F6B40E"/></svg>`,
  GHA: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="10" height="20" fill="#006B3F"/><rect x="10" width="10" height="20" fill="#FCD116"/><rect x="20" width="10" height="20" fill="#CE1126"/><polygon points="15,7 16.2,10.6 20,10.6 17,12.8 18.1,16.4 15,14.2 11.9,16.4 13,12.8 10,10.6 13.8,10.6" fill="#000"/></svg>`,
  COL: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="8" fill="#FCD116"/><rect y="8" width="30" height="6" fill="#003087"/><rect y="14" width="30" height="6" fill="#CE1126"/></svg>`,
  NOR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#EF2B2D"/><rect x="9" width="4" height="20" fill="#fff"/><rect y="8" width="30" height="4" fill="#fff"/><rect x="10" width="2" height="20" fill="#002868"/><rect y="9" width="30" height="2" fill="#002868"/></svg>`,
  FRA: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="10" height="20" fill="#002395"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ED2939"/></svg>`,
  SWE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#006AA7"/><rect x="9" width="4" height="20" fill="#FECC02"/><rect y="8" width="30" height="4" fill="#FECC02"/></svg>`,
  USA: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#fff"/><rect width="30" height="1.54" fill="#B22234"/><rect y="3.08" width="30" height="1.54" fill="#B22234"/><rect y="6.15" width="30" height="1.54" fill="#B22234"/><rect y="9.23" width="30" height="1.54" fill="#B22234"/><rect y="12.31" width="30" height="1.54" fill="#B22234"/><rect y="15.38" width="30" height="1.54" fill="#B22234"/><rect y="18.46" width="30" height="1.54" fill="#B22234"/><rect width="12" height="10.77" fill="#3C3B6E"/></svg>`,
  MEX: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="10" height="20" fill="#006847"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#CE1126"/><ellipse cx="15" cy="10" rx="2" ry="2.5" fill="#A0522D" opacity="0.7"/></svg>`,
  CAN: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#FF0000"/><rect x="22.5" width="7.5" height="20" fill="#FF0000"/><polygon points="15,3 16.2,7.5 21,7.5 17.2,10.2 18.7,14.7 15,12 11.3,14.7 12.8,10.2 9,7.5 13.8,7.5" fill="#FF0000"/></svg>`,
  BRA: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#009C3B"/><polygon points="15,2 28,10 15,18 2,10" fill="#FEDF00"/><circle cx="15" cy="10" r="4" fill="#002776"/></svg>`,
  GER: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.66" fill="#DD0000"/><rect y="13.33" width="30" height="6.67" fill="#FFCE00"/></svg>`,
  DZA: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#fff"/><rect width="15" height="20" fill="#006233"/><circle cx="16" cy="10" r="3.8" fill="#D21034"/><circle cx="17.2" cy="10" r="3.8" fill="#fff"/><polygon points="18,6.5 18.9,9.2 21.7,9.2 19.4,10.9 20.3,13.6 18,11.9 15.7,13.6 16.6,10.9 14.3,9.2 17.1,9.2" fill="#D21034" transform="translate(-1.5,0) scale(0.6) translate(2.5,0)"/></svg>`,
  BEL: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="10" height="20" fill="#000"/><rect x="10" width="10" height="20" fill="#FAE042"/><rect x="20" width="10" height="20" fill="#ED2939"/></svg>`,
};

/* Name → abbr for the live strip where we only have the full country name */
const WC_NAME_TO_ABBR = {
  austria:"AUT", spain:"ESP", croatia:"CRO", portugal:"POR",
  algeria:"ALG", switzerland:"SUI",
  egypt:"EGY", australia:"AUS", "cape verde":"CPV",
  argentina:"ARG", ghana:"GHA", colombia:"COL",
  norway:"NOR", france:"FRA", sweden:"SWE",
  "united states":"USA", usa:"USA", mexico:"MEX",
  canada:"CAN", brazil:"BRA", germany:"GER", belgium:"BEL",
};

function renderFlag(abbr) {
  if (!abbr) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#333"/></svg>`;
  const svg = WC_FLAGS[abbr.toUpperCase()];
  if (svg) return svg;
  /* Fallback: dark rectangle with 3-letter code */
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" class="wc-svg-flag"><rect width="30" height="20" fill="#333"/><text x="15" y="14" font-size="7" fill="#fff" text-anchor="middle" font-family="monospace">${abbr.toUpperCase()}</text></svg>`;
}

function renderFlagByName(name) {
  const abbr = WC_NAME_TO_ABBR[(name || "").toLowerCase()];
  return renderFlag(abbr || name);
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
    const scoreParts = (g.score || "0-0").split("-");
    const awayScore  = scoreParts[0]?.trim() ?? "0";
    const homeScore  = scoreParts[1]?.trim() ?? "0";
    const period = g.period || "";
    const half   = g.half   || "";
    const round  = g.round  ? ` · ${g.round}` : "";

    // Halftime / status detection
    const statusName  = g.status_name || "";
    const isHalftime  = statusName === "STATUS_HALFTIME";

    // Meta line: LIVE · 45'+3' · 1st Half (show what's available)
    const metaParts = ["LIVE"];
    if (period) metaParts.push(period);
    if (half)   metaParts.push(half);
    const metaText = metaParts.join(" · ");

    // Goal scorers — dedicated section, chronological, with team abbr
    const goals = g.goals || [];
    let scorersHtml = "";
    if (goals.length) {
      const rows = goals.map(goal => {
        const marker = goal.own_goal ? "OG" : goal.penalty ? "PK" : "⚽";
        const abbr   = (goal.abbr || "").toUpperCase();
        return `<div class="soccer-scorer-row">
          <span class="soccer-scorer-marker">${marker}</span>
          <span class="soccer-scorer-abbr">${abbr}</span>
          <span class="soccer-scorer-name">${goal.player}</span>
          <span class="soccer-scorer-min">${goal.minute}</span>
        </div>`;
      }).join("");
      scorersHtml = `<div class="soccer-scorers-section">${rows}</div>`;
    }

    // Upcoming today — other games not yet started
    const upcomingToday = (team.today_games || []).filter(tg => tg.matchup !== g.matchup && tg.state !== "post" && tg.state !== "in");
    const upcomingHtml = upcomingToday.length ? `
      <div class="soccer-upcoming-list">
        <span class="soccer-upcoming-label">Today</span>
        ${upcomingToday.map(tg => {
          const tm = parseMatchup(tg.matchup);
          return `<div class="soccer-upcoming-row">
            <span class="soccer-upcoming-flag">${renderFlag(tg.away_abbr)}</span>
            <span class="soccer-upcoming-name">${tm.away} vs ${tm.home}</span>
            <span class="soccer-upcoming-flag">${renderFlag(tg.home_abbr)}</span>
            <span class="soccer-upcoming-time">${tg.time}</span>
          </div>`;
        }).join("")}
      </div>` : "";

    return `
      <div class="sb-row sb-row-wc soccer-live-panel" data-team="world_cup">
        <div class="soccer-live-scoreline">
          <div class="soccer-team-side soccer-team-away">
            <span class="soccer-team-flag">${renderFlag(g.away_abbr)}</span>
            <span class="soccer-team-name">${m.away}</span>
          </div>
          <div class="soccer-score-center">
            <div class="soccer-score">${awayScore}</div>
            <div class="soccer-score-sep">–</div>
            <div class="soccer-score">${homeScore}</div>
          </div>
          <div class="soccer-team-side soccer-team-home">
            <span class="soccer-team-name">${m.home}</span>
            <span class="soccer-team-flag">${renderFlag(g.home_abbr)}</span>
          </div>
        </div>
        ${isHalftime
          ? `<div class="soccer-live-meta soccer-status-halftime"><span class="soccer-meta-text">HALFTIME</span></div>`
          : `<div class="soccer-live-meta"><span class="sb-live-dot"></span><span class="soccer-meta-text">${metaText}${round}</span></div>`
        }
        ${scorersHtml}
        ${upcomingHtml}
      </div>`;
  }
  if (team.next) {
    const g = team.next;
    const m = parseMatchup(g.matchup);
    const round = g.round ? `<span class="wc-round">${g.round}</span>` : "";

    // Other today's games (not the featured one)
    const todayGames = (team.today_games || []).filter(tg => tg.matchup !== g.matchup && tg.state !== "post");
    const moreHtml = todayGames.length ? `
      <div class="wc-more-today">
        ${todayGames.map(tg => {
          const tm = parseMatchup(tg.matchup);
          const stateTag = tg.state === "in"
            ? `<span class="wc-more-live">LIVE</span>`
            : `<span class="wc-more-time">${tg.time}</span>`;
          return `<div class="wc-more-row">
            <span class="wc-more-flag">${renderFlag(tg.away_abbr)}</span>
            <span class="wc-more-name">${tm.away} vs ${tm.home}</span>
            <span class="wc-more-flag">${renderFlag(tg.home_abbr)}</span>
            ${stateTag}
          </div>`;
        }).join("")}
      </div>` : "";

    return `
      <div class="sb-row sb-row-wc sb-row-wc-next" data-team="world_cup">
        <div class="wc-matchup-line">
          <div class="wc-team-away">
            <span class="wc-flag">${renderFlag(g.away_abbr)}</span>
            <span class="wc-name">${m.away}</span>
          </div>
          <div class="wc-score-center">
            <div class="wc-score-time">${g.time || "TBD"}</div>
          </div>
          <div class="wc-team-home">
            <span class="wc-name">${m.home}</span>
            <span class="wc-flag">${renderFlag(g.home_abbr)}</span>
          </div>
        </div>
        <div class="wc-status-line wc-status-next">⚽ World Cup${round ? " · " : ""}${round}</div>
        ${moreHtml}
      </div>`;
  }
  if (team.last) {
    const g = team.last;
    const m = parseMatchup(g.matchup);
    const scoreParts = (g.score || "0-0").split("-");
    const awayScore  = scoreParts[0]?.trim() ?? "–";
    const homeScore  = scoreParts[1]?.trim() ?? "–";
    const round      = g.round ? ` · ${g.round}` : "";

    const goals = g.goals || [];
    let finalScorersHtml = "";
    if (goals.length) {
      const rows = goals.map(goal => {
        const marker = goal.own_goal ? "OG" : goal.penalty ? "PK" : "⚽";
        const abbr   = (goal.abbr || "").toUpperCase();
        return `<div class="soccer-scorer-row">
          <span class="soccer-scorer-marker">${marker}</span>
          <span class="soccer-scorer-abbr">${abbr}</span>
          <span class="soccer-scorer-name">${goal.player}</span>
          <span class="soccer-scorer-min">${goal.minute}</span>
        </div>`;
      }).join("");
      finalScorersHtml = `<div class="soccer-scorers-section">${rows}</div>`;
    }

    const upcomingToday = (team.today_games || []).filter(tg => tg.matchup !== g.matchup && tg.state !== "post" && tg.state !== "in");
    const upcomingHtml = upcomingToday.length ? `
      <div class="soccer-upcoming-list">
        <span class="soccer-upcoming-label">Today</span>
        ${upcomingToday.map(tg => {
          const tm = parseMatchup(tg.matchup);
          return `<div class="soccer-upcoming-row">
            <span class="soccer-upcoming-flag">${renderFlag(tg.away_abbr)}</span>
            <span class="soccer-upcoming-name">${tm.away} vs ${tm.home}</span>
            <span class="soccer-upcoming-flag">${renderFlag(tg.home_abbr)}</span>
            <span class="soccer-upcoming-time">${tg.time}</span>
          </div>`;
        }).join("")}
      </div>` : "";

    return `
      <div class="sb-row sb-row-wc soccer-live-panel soccer-final-panel" data-team="world_cup">
        <div class="soccer-live-scoreline">
          <div class="soccer-team-side soccer-team-away">
            <span class="soccer-team-flag">${renderFlag(g.away_abbr)}</span>
            <span class="soccer-team-name">${m.away}</span>
          </div>
          <div class="soccer-score-center">
            <div class="soccer-score soccer-score-final">${awayScore}</div>
            <div class="soccer-score-sep">–</div>
            <div class="soccer-score soccer-score-final">${homeScore}</div>
          </div>
          <div class="soccer-team-side soccer-team-home">
            <span class="soccer-team-name">${m.home}</span>
            <span class="soccer-team-flag">${renderFlag(g.home_abbr)}</span>
          </div>
        </div>
        <div class="soccer-live-meta soccer-status-final">
          <span class="soccer-meta-text">FINAL${round}</span>
        </div>
        ${finalScorersHtml}
        ${upcomingHtml}
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
  union:     "https://a.espncdn.com/i/teamlogos/soccer/500/10739.png",
  chelsea:   "https://a.espncdn.com/i/teamlogos/soccer/500/363.png",
  st_josephs_mlax: "https://a.espncdn.com/i/teamlogos/ncaa/500/2603.png",
};

const TEAM_LEAGUES = {
  phillies: "mlb", eagles: "nfl", sixers: "nba", flyers: "nhl",
  union: "soccer", chelsea: "soccer", st_josephs_mlax: "ncaa",
};

function teamLogo(key) {
  const url = TEAM_LOGOS[key];
  if (!url) return "";
  return `<img class="sb-logo" src="${url}" alt="" loading="lazy" onerror="this.style.display='none'">`;
}

function oppLogo(abbr, league, id) {
  if (!league) return "";
  // ESPN's soccer logo CDN is keyed by numeric team id, not the 3-letter
  // abbreviation (which 404s) — prefer id for soccer opponents when present.
  const identifier = (league === "soccer" && id) ? id : abbr;
  if (!identifier) return "";
  const src = `https://a.espncdn.com/i/teamlogos/${league}/500/${identifier}.png`;
  return `<img class="sb-logo sb-logo-opp" src="${src}" alt="" loading="lazy" onerror="this.style.display='none'">`;
}

function renderPhilliesLiveDetail(team) {
  const g = team.live;
  const d = g.detail;

  const myScore  = d.my_score  ?? g.my_score  ?? "—";
  const oppScore = d.opp_score ?? g.opp_score ?? "—";
  const period   = g.period || "Live";
  const record   = team.record ? `<span class="sb-record">${team.record}</span>` : "";

  // Game state line
  const outsStr  = d.outs != null ? `${d.outs} OUT${d.outs !== 1 ? "S" : ""}` : "";
  const countStr = (d.balls != null && d.strikes != null) ? `${d.balls}-${d.strikes}` : "";
  const gameState = [period, outsStr, countStr].filter(Boolean).join(" · ");

  // Base diamond — lit = runner on base
  const b1 = d.on_first  ? "base-on" : "";
  const b2 = d.on_second ? "base-on" : "";
  const b3 = d.on_third  ? "base-on" : "";
  const diamond = `
    <div class="mlb-diamond">
      <div class="base base-2b ${b2}"></div>
      <div class="base base-1b ${b1}"></div>
      <div class="base base-3b ${b3}"></div>
      <div class="base base-home"></div>
    </div>`;

  const batterHtml = d.batter?.name ? `
    <div class="mlb-player-line">
      <span class="mlb-role">Batter</span>
      <span class="mlb-name">${d.batter.name}</span>
      ${d.batter.line ? `<span class="mlb-line">${d.batter.line}</span>` : ""}
    </div>` : "";

  const pitcherHtml = d.pitcher?.name ? `
    <div class="mlb-player-line">
      <span class="mlb-role">Pitcher</span>
      <span class="mlb-name">${d.pitcher.name}</span>
      ${d.pitcher.line ? `<span class="mlb-line">${d.pitcher.line}</span>` : ""}
    </div>` : "";

  // Real scoring-play context from ESPN's play-by-play log — preferred over
  // the generic last-play line when available; never inferred/paraphrased.
  const sp = d.last_scoring_play;
  const scoringPlayHtml = sp
    ? `<div class="mlb-scoring-play">
         <span class="mlb-scoring-label">Last Scoring Play</span>
         <span class="mlb-scoring-text">${sp.period} · ${sp.text} · PHI ${sp.my_score}-${sp.opp_score}</span>
       </div>`
    : "";

  const lastPlayHtml = (!sp && d.last_play)
    ? `<div class="mlb-last-play">Last: ${d.last_play}</div>` : "";

  const oppAbbr    = (g.opponent_abbr || "").toUpperCase();
  const oppLogoHtml = oppLogo(g.opponent_abbr, "mlb");

  return `
    <div class="sb-row sb-row-live sb-row-hero mlb-live-panel" data-team="phillies">

      <!-- Topbar: team name · LIVE badge · record -->
      <div class="mlb-topbar">
        <div class="mlb-topbar-left">
          <span class="mlb-title-team">PHILLIES</span>
          <span class="mlb-live-badge"><span class="sb-live-dot"></span>LIVE</span>
        </div>
        ${team.record ? `<span class="mlb-topbar-record">${team.record}</span>` : ""}
      </div>

      <!-- Scoreboard: PHI [left] | game state [center] | OPP [right] -->
      <div class="mlb-scoreboard-wide">
        <div class="mlb-team-side mlb-team-mine">
          ${teamLogo("phillies")}
          <div class="mlb-team-info">
            <span class="mlb-team-abbr">PHI</span>
            <span class="mlb-team-score mlb-score-mine">${myScore}</span>
          </div>
        </div>
        <div class="mlb-center-state">${gameState}</div>
        <div class="mlb-team-side mlb-team-opp">
          <div class="mlb-team-info mlb-team-info-right">
            <span class="mlb-team-score">${oppScore}</span>
            <span class="mlb-team-abbr">${oppAbbr || g.opponent || "OPP"}</span>
          </div>
          ${oppLogoHtml}
        </div>
      </div>

      <!-- Diamond (left) | batter/pitcher (right) -->
      <div class="mlb-detail-grid">
        <div class="mlb-diamond-wrap">
          <div class="mlb-diamond-large">
            <div class="base base-2b ${b2}"></div>
            <div class="base base-1b ${b1}"></div>
            <div class="base base-3b ${b3}"></div>
            <div class="base base-home"></div>
          </div>
        </div>
        <div class="mlb-info-block">
          ${batterHtml}
          ${pitcherHtml}
        </div>
      </div>

      ${scoringPlayHtml}
      ${lastPlayHtml}

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
    if (key === "phillies" && team.live.detail) {
      return renderPhilliesLiveDetail(team);
    }
    const g = team.live;
    const score  = g.score || `${g.my_score ?? "—"}-${g.opp_score ?? "—"}`;
    const period = g.period || "Live";
    const opp    = oppLogo(g.opponent_abbr, league, g.opponent_id);
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
    const opp   = oppLogo(g.opponent_abbr, league, g.opponent_id);
    const hawayWord = g.home_away === "home" ? "vs" : "at";
    const connector = `<span class="sb-matchup-connector">${hawayWord}</span>`;
    // Matchup line — team + opponent; record is dimmed secondary span.
    const recText = team.record ? team.record : "0-0";
    const recSpan = `<span class="sb-matchup-record">(${recText})</span>`;
    const matchupPrimary = g.opponent
      ? `${team.label.toUpperCase()} ${connector} ${g.opponent.toUpperCase()} ${recSpan}`
      : `${team.label.toUpperCase()} ${recSpan}`;
    const dateTimeLine = (g.date || g.time)
      ? `<div class="sb-sub sb-sub-date">${[g.date, g.time].filter(Boolean).join(" · ")}</div>`
      : "";
    const pitchers = (key === "phillies" && team.pitchers) ? buildPhilliesPitcherBlock(team.pitchers) : "";
    return `
      <div class="sb-row sb-row-mysports" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team sb-team-matchup">${matchupPrimary}</div>
          ${dateTimeLine}
          ${pitchers}
        </div>
        ${opp}
      </div>`;
  }

  // No upcoming game — one compact status line, real data only, no headline
  // clutter. "Offseason" when the backend already flagged it that way,
  // otherwise "No upcoming" + real standing if available.
  // A stale last result (older than 12h) is treated the same as no last result —
  // showing an end-of-season loss is not useful when there's no game coming up.
  const STALE_MS = 12 * 60 * 60 * 1000;
  const lastIsStale = !team.last || !team.last.game_utc ||
    (Date.now() - new Date(team.last.game_utc).getTime()) > STALE_MS;
  if (lastIsStale) {
    const isOffseason = team.standing === "Offseason";
    const label = isOffseason ? "Offseason" : "No upcoming";
    const extra = isOffseason ? team.record : team.standing;
    const statusLine = [label, extra].filter(Boolean).join(" · ");
    return `
      <div class="sb-row sb-row-collapsed" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}</div>
          <div class="sb-sub">${statusLine}</div>
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
    const opp      = oppLogo(g.opponent_abbr, league, g.opponent_id);
    return `
      <div class="sb-row sb-row-collapsed" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}</div>
          <div class="sb-sub ${subCls}">${subLabel}${record}</div>
        </div>
        ${opp}
        <div class="sb-score ${scoreCls}">${score}</div>
      </div>`;
  }

  // Nothing live/upcoming/recent/headline — safe fallback so the team never
  // just vanishes (e.g. a genuinely offseason team with no news source).
  if (team.standing) {
    return `
      <div class="sb-row sb-row-collapsed" ${teamAttr}>
        ${logo}
        <div class="sb-team-wrap">
          <div class="sb-team">${team.label}</div>
          <div class="sb-sub">${team.standing}${team.record ? " · " + team.record : ""}</div>
        </div>
      </div>`;
  }

  return "";
}

/* ── IN SEASON standings card ────────────────────────────────── */

function renderStandings(data) {
  const bodyEl = document.getElementById("standings-body");
  if (!bodyEl) return;

  if (!data || !data.sections || !data.sections.length) {
    bodyEl.innerHTML = `<p class="card-placeholder">Standings unavailable</p>`;
    return;
  }

  const sectionsHtml = data.sections.map(sec => {
    // Header logo — prefer API-supplied URL, fall back to TEAM_LOGOS constant
    const headerLogoSrc = sec.logo_url || TEAM_LOGOS[sec.team_key] || "";
    const headerLogoImg = headerLogoSrc
      ? `<img class="stg-logo stg-header-logo" src="${headerLogoSrc}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : "";

    // Main status line: "2nd NL East · 50-41 · 3 GB"
    const statusParts = [];
    if (sec.rank) {
      const rankLabel = sec.league_label
        ? `${ordinal(sec.rank)} ${sec.league_label}`
        : ordinal(sec.rank);
      statusParts.push(rankLabel);
    }
    if (sec.record) statusParts.push(sec.record);
    if (sec.overall && !sec.record) statusParts.push(sec.overall);
    if (sec.gb && sec.gb !== "-") statusParts.push(`${sec.gb} GB`);
    if (sec.points !== undefined && !sec.gb) statusParts.push(`${sec.points} pts`);
    const statusLine = statusParts.join(" · ");

    // Build mini-standings rows — trimmed, TV-readable
    // MLB: leader + our team + one below (max 3)
    // MLS: all non-gap rows returned by API (max 4)
    const dataRows = (sec.rows || []).filter(r => !r.gap);
    const ourIdx   = dataRows.findIndex(r => r.highlight);
    let showRows;
    if (sec.record !== undefined && ourIdx >= 0) {
      // MLB division (5 teams) — show all
      showRows = dataRows;
    } else {
      // MLS — top 3 + Union's neighbors (Union ±1), deduped, in order
      const idxSet = new Set();
      for (let i = 0; i < Math.min(3, dataRows.length); i++) idxSet.add(i);
      if (ourIdx >= 0) {
        [ourIdx - 1, ourIdx, ourIdx + 1].forEach(i => {
          if (i >= 0 && i < dataRows.length) idxSet.add(i);
        });
      }
      showRows = dataRows.filter((_, i) => idxSet.has(i));
    }

    const rowsHtml = showRows.map(row => {
      const cls = row.highlight ? "stg-row stg-row-highlight" : "stg-row";
      const rowLogoImg = row.logo_url
        ? `<img class="stg-row-logo-img" src="${row.logo_url}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : "";
      const logoCell = `<span class="stg-row-logo">${rowLogoImg}</span>`;
      if (row.w !== undefined) {
        // MLB: logo  abbr  W-L  GB
        const gbStr = row.gb && row.gb !== "-" ? row.gb : "";
        return `<div class="${cls}" data-abbr="${row.abbr}">
          ${logoCell}
          <span class="stg-abbr">${row.abbr}</span>
          <span class="stg-record">${row.w}-${row.l}</span>
          ${gbStr ? `<span class="stg-gb">${gbStr}</span>` : ""}
        </div>`;
      }
      // MLS: logo  abbr  record  pts
      return `<div class="${cls}" data-abbr="${row.abbr}">
        ${logoCell}
        <span class="stg-abbr">${row.abbr}</span>
        <span class="stg-record">${row.overall || ""}</span>
        <span class="stg-pts">${row.points} pts</span>
      </div>`;
    }).join("");

    return `
      <div class="stg-section" data-team="${sec.team_key}">
        <div class="stg-section-title">
          ${headerLogoImg}
          <div class="stg-title-text">
            <div class="stg-team-name">${sec.label}</div>
            <div class="stg-league-label">${sec.league_label || ""}</div>
          </div>
        </div>
        <div class="stg-status">${statusLine}</div>
        <div class="stg-rows">${rowsHtml}</div>
      </div>`;
  }).join("");

  bodyEl.innerHTML = sectionsHtml;
}

function ordinal(n) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function pollStandings() {
  try {
    const res = await fetch("/api/standings");
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderStandings(data);
  } catch {
    renderStandings(null);
  }
  setTimeout(pollStandings, 600000);
}

// ── Sports HQ countdown helpers ──────────────────────────────────────────────

function minutesUntilGame(utcIso) {
  if (!utcIso) return null;
  const delta = new Date(utcIso).getTime() - Date.now();
  if (delta <= 0) return null;
  return Math.floor(delta / 60000);
}

function fmtCountdown(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* Pitcher stat text from a parsed pitcher object — only real fields, never fabricated */
function formatPitcherInfo(p) {
  if (!p || !p.name || p.name === "TBD") return null;
  const parts = [];
  if (p.W && p.W !== "—" && p.L && p.L !== "—") parts.push(`${p.W}-${p.L}`);
  if (p.ERA && p.ERA !== "—") parts.push(`${p.ERA} ERA`);
  return { name: p.name, stat: parts.join(" · ") };
}

/* Compact probable-starters line for the Phillies countdown hero — hidden entirely if no real data */
function buildPhilliesPitcherBlock(pitchers) {
  if (!pitchers) return "";
  const isPhiHome = (pitchers.home_abbr || "").toLowerCase() === "phi";
  const us   = formatPitcherInfo(isPhiHome ? pitchers.home : pitchers.away);
  const them = formatPitcherInfo(isPhiHome ? pitchers.away : pitchers.home);
  if (!us && !them) return "";
  const side = (info) => info
    ? `<span class="phillies-pitcher-line"><span class="phillies-pitcher-name">${info.name}</span>${info.stat ? ` <span class="phillies-pitcher-stat">${info.stat}</span>` : ""}</span>`
    : "";
  const vs = (us && them) ? `<span class="phillies-pitcher-vs">vs</span>` : "";
  return `<div class="phillies-pitchers">${side(us)}${vs}${side(them)}</div>`;
}

function renderPhillyCountdownHero(team, key, minsUntil) {
  const g = team.next;
  const homeAway  = g.home_away === "home" ? "vs" : "@";
  const oppName   = (g.opponent || "").toUpperCase();
  const countdown = fmtCountdown(minsUntil);
  const cdHtml    = countdown ? `<div class="shq-countdown">Starts in <span class="shq-countdown-time">${countdown}</span></div>` : "";
  const record    = team.record ? `<span class="shq-hero-record">${team.record}</span>` : "";
  const pitcherHtml = key === "phillies" ? buildPhilliesPitcherBlock(team.pitchers) : "";
  return `
    <div class="shq-countdown-hero">
      <div class="shq-hero-teams">
        <div class="shq-hero-side shq-hero-us">
          ${teamLogo(key)}
          <span class="shq-hero-name">${key.toUpperCase()}</span>
          ${record}
        </div>
        <div class="shq-hero-vs-col">
          <span class="shq-hero-vs">${homeAway}</span>
        </div>
        <div class="shq-hero-side shq-hero-them">
          ${oppLogo(g.opponent_abbr, TEAM_LEAGUES[key] || "nhl", g.opponent_id)}
          <span class="shq-hero-name">${oppName}</span>
        </div>
      </div>
      <div class="shq-hero-time">${g.time}${g.date !== new Date().toLocaleDateString("en-US", {weekday:"short",month:"short",day:"numeric"}) ? " · " + g.date : ""}</div>
      ${cdHtml}
      ${pitcherHtml}
    </div>`;
}

function renderWCCountdownHero(wcTeam, minsUntil) {
  const g = wcTeam.next;
  if (!g) return "";
  const m = parseMatchup(g.matchup);
  const countdown = fmtCountdown(minsUntil);
  const cdHtml    = countdown ? `<div class="shq-countdown">Starts in <span class="shq-countdown-time">${countdown}</span></div>` : "";
  return `
    <div class="shq-countdown-hero shq-countdown-wc">
      <div class="shq-hero-teams shq-hero-teams-wc">
        <div class="shq-hero-side shq-hero-us">
          <span class="shq-hero-flag">${renderFlag(g.away_abbr)}</span>
          <span class="shq-hero-name">${m.away}</span>
        </div>
        <div class="shq-hero-vs-col">
          <span class="shq-hero-vs">vs</span>
        </div>
        <div class="shq-hero-side shq-hero-them">
          <span class="shq-hero-name">${m.home}</span>
          <span class="shq-hero-flag">${renderFlag(g.home_abbr)}</span>
        </div>
      </div>
      <div class="shq-hero-time">${g.time}</div>
      ${cdHtml}
    </div>`;
}

// Returns recent final items (today or within 12h, not currently live).
// Priority: Philly teams first, then World Cup.
function getRecentFinals(teams, todayLabel) {
  const MY_SPORTS_KEYS = ["phillies", "eagles", "sixers", "flyers", "union", "chelsea", "st_josephs_mlax"];
  const now = Date.now();
  const RECENT_WINDOW_MS = 12 * 60 * 60 * 1000;
  const results = [];

  for (const k of MY_SPORTS_KEYS) {
    const t = teams[k];
    if (!t?.last || t.live) continue;
    const last = t.last;
    const isToday  = last.date === todayLabel;
    const isRecent = last.game_utc && (now - new Date(last.game_utc).getTime()) < RECENT_WINDOW_MS;
    if (isToday || isRecent) results.push({ type: "philly", key: k, team: t, last });
  }

  if (!teams.world_cup?.live) {
    const wc = teams.world_cup;
    if (wc?.last) {
      const last = wc.last;
      const isToday  = last.date === todayLabel;
      const isRecent = last.game_utc && (now - new Date(last.game_utc).getTime()) < RECENT_WINDOW_MS;
      if (isToday || isRecent) results.push({ type: "world_cup", last, next: wc.next });
    }
  }

  return results;
}

function renderRecentFinalHero(item, todayLabel) {
  if (item.type === "philly") {
    const { key, team, last } = item;
    const sport   = TEAM_LEAGUES[key] || "nhl";
    const myScore = last.my_score  ?? "—";
    const oppScore= last.opp_score ?? "—";
    const oppName = (last.opponent || "").toUpperCase();
    const teamName= key.toUpperCase();
    const myCls   = last.result === "W" ? "shq-final-score-win" : last.result === "L" ? "shq-final-score-loss" : "";
    const oppCls  = last.result === "L" ? "shq-final-score-win" : last.result === "W" ? "shq-final-score-loss" : "";

    let nextHtml = "";
    if (team.next) {
      const n  = team.next;
      const ha = n.home_away === "home" ? "vs" : "@";
      const nd = n.date !== todayLabel ? ` · ${n.date}` : "";
      nextHtml = `<div class="shq-final-next">Next: ${teamName} ${ha} ${(n.opponent||"").toUpperCase()}${nd} · ${n.time}</div>`;
    }

    return `
      <div class="shq-recent-final shq-final-hero">
        <div class="shq-final-scoreboard">
          <div class="shq-final-team-row">
            <div class="shq-final-logo">${teamLogo(key)}</div>
            <span class="shq-final-name">${teamName}</span>
            <span class="shq-final-score ${myCls}">${myScore}</span>
          </div>
          <div class="shq-final-team-row">
            <div class="shq-final-logo">${oppLogo(last.opponent_abbr, sport, last.opponent_id)}</div>
            <span class="shq-final-name">${oppName}</span>
            <span class="shq-final-score ${oppCls}">${oppScore}</span>
          </div>
          <span class="shq-final-status">FINAL</span>
        </div>
        ${nextHtml}
      </div>`;
  }

  if (item.type === "world_cup") {
    const { last, next } = item;
    const m = parseMatchup(last.matchup || "");
    const scoreParts = (last.score || "").split("-");
    const awayScore  = scoreParts[0]?.trim() ?? "—";
    const homeScore  = scoreParts[1]?.trim() ?? "—";

    const goals = last.goals || [];
    let scorersHtml = "";
    if (goals.length) {
      const rows = goals.map(g => {
        const marker = g.own_goal ? "OG" : g.penalty ? "PK" : "⚽";
        return `<div class="shq-final-scorer-row">
          <span class="shq-final-scorer-marker">${marker}</span>
          <span class="shq-final-scorer-abbr">${(g.abbr||"").toUpperCase()}</span>
          <span class="shq-final-scorer-name">${g.player}</span>
          <span class="shq-final-scorer-min">${g.minute}</span>
        </div>`;
      }).join("");
      scorersHtml = `<div class="shq-final-scorers">${rows}</div>`;
    }

    let nextHtml = "";
    if (next) {
      const nm = parseMatchup(next.matchup || "");
      nextHtml = `<div class="shq-final-next">Next: ${nm.away} vs ${nm.home} · ${next.time}</div>`;
    }

    return `
      <div class="shq-recent-final shq-final-hero shq-final-hero-wc">
        <div class="shq-final-scoreline-wc">
          <div class="shq-final-side-wc">
            <span class="shq-final-flag">${renderFlag(last.away_abbr)}</span>
            <span class="shq-final-name-wc">${m.away || last.away || ""}</span>
            <span class="shq-final-score-wc">${awayScore}</span>
          </div>
          <div class="shq-final-divider-wc">
            <span class="shq-final-status-wc">FINAL</span>
          </div>
          <div class="shq-final-side-wc">
            <span class="shq-final-flag">${renderFlag(last.home_abbr)}</span>
            <span class="shq-final-name-wc">${m.home || last.home || ""}</span>
            <span class="shq-final-score-wc">${homeScore}</span>
          </div>
        </div>
        ${scorersHtml}
        ${nextHtml}
      </div>`;
  }

  return "";
}

function renderSportsHQ(teams) {
  const MY_SPORTS_KEYS = ["phillies", "eagles", "sixers", "flyers", "union", "chelsea", "st_josephs_mlax"];

  // Build today label matching backend format: "Thu Jul 2"
  const now = new Date();
  const days   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const todayLabel = `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;

  const phillyLive  = MY_SPORTS_KEYS.filter(k => teams[k]?.live);
  const wcLive      = !!(teams.world_cup?.live);
  const hasAnyLive  = phillyLive.length > 0 || wcLive;

  const phillyToday = MY_SPORTS_KEYS.filter(k => {
    const t = teams[k];
    return !t?.live && t?.next && t.next.date === todayLabel;
  });

  const wcTodayGames = (teams.world_cup?.today_games || []).filter(g => g.state !== "post");
  const hasWcToday   = !wcLive && wcTodayGames.length > 0;
  const wcLastToday  = !wcLive && !hasWcToday && !!(teams.world_cup?.last);

  // ── Recent Finals (today or within 12h) ────────────────────────────────
  // Philly finals shown even when WC is live; WC finals only when WC is not live.
  // Individual live-team guard is inside getRecentFinals (skips t.live teams).
  const recentFinals = getRecentFinals(teams, todayLabel);
  const recentFinalKeys = new Set(recentFinals.filter(r => r.type === "philly").map(r => r.key));
  const wcHasRecentFinal = recentFinals.some(r => r.type === "world_cup");

  // ── Countdown candidate (no live games only) ────────────────────────────
  const COUNTDOWN_THRESHOLD_MIN = 180;
  let countdownCandidate = null;
  if (!phillyLive.length && !wcLive) {
    for (const k of phillyToday) {
      const mins = minutesUntilGame(teams[k]?.next?.game_utc);
      if (mins != null && mins <= COUNTDOWN_THRESHOLD_MIN) {
        countdownCandidate = { type: "philly", key: k, team: teams[k], minsUntil: mins };
        break;
      }
    }
    if (!countdownCandidate) {
      const wcNext = wcTodayGames.find(g => g.state === "pre" && g.game_utc);
      if (wcNext) {
        const mins = minutesUntilGame(wcNext.game_utc);
        if (mins != null && mins <= COUNTDOWN_THRESHOLD_MIN) {
          countdownCandidate = { type: "world_cup", game: wcNext, minsUntil: mins };
        }
      }
    }
  }

  let html = "";

  // ── LIVE MODE ───────────────────────────────────────────────────────────
  if (phillyLive.length > 0) {
    html += `<div class="shq-section-hdr shq-hdr-live"><span class="shq-live-dot"></span>Live Now</div>`;
    for (const k of phillyLive) html += renderSportsRow(teams[k], k);
  }
  if (wcLive) {
    const wcHdrLabel = phillyLive.length > 0 ? "World Cup Live" : "Live Now";
    html += `<div class="shq-section-hdr shq-hdr-live shq-hdr-wc"><span class="shq-live-dot"></span>${wcHdrLabel}</div>`;
    html += renderWCRow(teams.world_cup);
  }

  // ── RECENT FINAL HEROES ─────────────────────────────────────────────────
  if (recentFinals.length > 0) {
    html += `<div class="shq-section-hdr shq-hdr-recent">Recent Final</div>`;
    for (const item of recentFinals) html += renderRecentFinalHero(item, todayLabel);
  }

  // ── COUNTDOWN HERO ──────────────────────────────────────────────────────
  if (countdownCandidate) {
    if (countdownCandidate.type === "philly") {
      html += `<div class="shq-section-hdr shq-hdr-next">Next Up</div>`;
      html += renderPhillyCountdownHero(countdownCandidate.team, countdownCandidate.key, countdownCandidate.minsUntil);
    } else {
      html += `<div class="shq-section-hdr shq-hdr-next shq-hdr-wc">World Cup · Next Up</div>`;
      html += renderWCCountdownHero(teams.world_cup, countdownCandidate.minsUntil);
    }
  }

  // ── WORLD CUP UP NEXT (World Cup logic untouched — kept separate) ───────
  if (hasWcToday && !countdownCandidate) {
    html += `<div class="shq-section-hdr shq-hdr-next">Up Next</div>`;
    html += renderWCRow(teams.world_cup);
  }

  // WC today games listed compactly below WC countdown hero
  if (countdownCandidate?.type === "world_cup" && wcTodayGames.length > 1) {
    const remaining = wcTodayGames.filter(g => g.game_utc !== countdownCandidate.game.game_utc && g.state !== "in");
    if (remaining.length) {
      html += `<div class="shq-section-hdr shq-hdr-next" style="font-size:1.3rem;padding:2px 14px 2px">Today</div>`;
      remaining.forEach(tg => {
        const tm = parseMatchup(tg.matchup);
        html += `<div class="sb-row sb-row-wc sb-row-wc-next" data-team="world_cup" style="padding:6px 14px">
          <div class="wc-matchup-line">
            <div class="wc-team-away"><span class="wc-flag">${renderFlag(tg.away_abbr)}</span><span class="wc-name" style="font-size:1.6rem">${tm.away}</span></div>
            <div class="wc-score-center"><div class="wc-score-time" style="font-size:1.6rem">${tg.time}</div></div>
            <div class="wc-team-home"><span class="wc-name" style="font-size:1.6rem">${tm.home}</span><span class="wc-flag">${renderFlag(tg.home_abbr)}</span></div>
          </div>
        </div>`;
      });
    }
  }

  // WC last/final that isn't covered by a recent final hero
  if (wcLastToday && !wcHasRecentFinal) {
    html += `<div class="shq-section-hdr shq-hdr-teams shq-hdr-wc">World Cup</div>`;
    html += renderWCRow(teams.world_cup);
  }

  // ── MY SPORTS SECTION — every tracked team not already shown above
  // (live / recent-final / countdown hero), sorted by soonest real upcoming
  // game. Teams with no real upcoming game (offseason, no reliable source)
  // sort to the bottom. Phillies gets its *next* game after whichever one is
  // already shown in the hero, so it never duplicates the hero's own game.
  let phillyHeroGameUtc = null;
  if (phillyLive.includes("phillies")) {
    phillyHeroGameUtc = teams.phillies?.live?.game_utc || null;
  } else if (recentFinalKeys.has("phillies")) {
    phillyHeroGameUtc = teams.phillies?.last?.game_utc || null;
  } else if (countdownCandidate?.type === "philly" && countdownCandidate.key === "phillies") {
    phillyHeroGameUtc = teams.phillies?.next?.game_utc || null;
  }

  const sectionRows = [];
  for (const k of MY_SPORTS_KEYS) {
    let team = teams[k];
    if (!team) continue;

    if (k === "phillies" && phillyHeroGameUtc) {
      const nextAfter = (team.upcoming || []).find(g => g.game_utc !== phillyHeroGameUtc);
      if (!nextAfter) continue; // no real next-after-current game — hide the extra row
      // Clear live/last so renderSportsRow falls through to the "next" branch
      // using the substitute game, instead of re-showing the hero's own game.
      team = { ...team, live: null, last: null, next: nextAfter, pitchers: nextAfter.pitchers };
    } else {
      if (phillyLive.includes(k)) continue;
      if (recentFinalKeys.has(k)) continue;
      if (countdownCandidate?.type === "philly" && countdownCandidate.key === k) continue;
    }

    const sortTime = team.next?.game_utc ? new Date(team.next.game_utc).getTime() : Infinity;
    sectionRows.push({ key: k, team, sortTime });
  }
  sectionRows.sort((a, b) => a.sortTime - b.sortTime);

  const sectionHtml = sectionRows.map(r => renderSportsRow(r.team, r.key)).filter(Boolean).join("");
  if (sectionHtml) {
    const showHdr = hasAnyLive || hasWcToday || wcLastToday || countdownCandidate || recentFinals.length > 0;
    html += (showHdr ? `<div class="shq-section-hdr shq-hdr-teams">My Sports</div>` : "")
          + `<div class="shq-idle-section">${sectionHtml}</div>`;
  }

  return html || `<div class="sb-placeholder">No games data</div>`;
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
      // Rename header once
      const cardHdr = document.querySelector('#sports-card .card-label');
      if (cardHdr) cardHdr.textContent = 'Sports HQ';

      listEl.innerHTML = renderSportsHQ(d.teams);
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

/* ── Gaming HQ ───────────────────────────────────────────────── */

function gamingSafeText(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]));
}

function renderGaming(data) {
  const body = document.getElementById("gaming-body");
  if (!body) return;

  const connected   = data && data.connected;
  const status      = gamingSafeText(data && data.status, "Not connected");
  const psnStatus   = gamingSafeText(data && data.psn_status, null);
  const game        = data && data.current_game ? gamingSafeText(data.current_game, null) : null;
  const lastOnline  = gamingSafeText(data && data.last_online, null);
  const trophyLevel = (data && data.trophy_level != null) ? data.trophy_level : null;
  const gold        = (data && data.gold_trophies != null) ? data.gold_trophies : null;
  const silver      = (data && data.silver_trophies != null) ? data.silver_trophies : null;
  const bronze      = (data && data.bronze_trophies != null) ? data.bronze_trophies : null;

  const statusCls = connected ? "gaming-status online" : "gaming-status offline";

  const gameHtml = game
    ? `<div class="gm-value">${game}</div>`
    : `<div class="gm-value gm-dim">${connected ? "No game running" : "PS5 offline"}</div>`;

  const trophyHtml = trophyLevel != null ? `
    <div class="gm-row">
      <span class="gm-label">Trophy Level</span>
      <span class="gm-value">${trophyLevel}</span>
    </div>
    ${gold != null || silver != null || bronze != null ? `
    <div class="gm-trophy-row">
      ${gold   != null ? `<span class="gm-trophy gm-gold">G ${gold}</span>`   : ""}
      ${silver != null ? `<span class="gm-trophy gm-silver">S ${silver}</span>` : ""}
      ${bronze != null ? `<span class="gm-trophy gm-bronze">B ${bronze}</span>` : ""}
    </div>` : ""}
  ` : "";

  // Friends online — only render if at least 1 friend is online
  const friendsList = Array.isArray(data && data.friends_online) ? data.friends_online : [];
  const friendsCount = (data && data.friends_online_count) || friendsList.length;
  let friendsHtml = "";
  if (friendsList.length > 0) {
    const rows = friendsList.slice(0, 3).map(f => {
      const name = gamingSafeText(f.name, "Unknown");
      const game = f.game ? gamingSafeText(f.game, null) : null;
      const plat = f.platform ? gamingSafeText(f.platform, null) : null;
      const parts = [game || "Online", plat].filter(Boolean);
      return `<div class="gm-friend-row">${name} · ${parts.join(" · ")}</div>`;
    }).join("");
    const more = friendsCount > 3 ? `<div class="gm-friend-more">+${friendsCount - 3} more</div>` : "";
    friendsHtml = `
      <div class="gm-friends-section">
        <div class="gm-row"><span class="gm-label">Friends Online</span><span class="gm-value">${friendsCount}</span></div>
        ${rows}${more}
      </div>`;
  }

  body.innerHTML = `
    <div class="${statusCls}">${status}</div>
    ${psnStatus ? `<div class="gm-row"><span class="gm-label">PSN Doggo215</span><span class="gm-value">${psnStatus}</span></div>` : ""}
    <div class="gm-row">
      <span class="gm-label">Now Playing</span>
      ${gameHtml}
    </div>
    ${lastOnline ? `<div class="gm-row"><span class="gm-label">Last Online</span><span class="gm-value gm-dim">${lastOnline}</span></div>` : ""}
    ${friendsHtml}
    ${trophyHtml}
  `;
}

async function pollGaming() {
  try {
    const r = await fetch("/api/gaming");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    renderGaming(data);
  } catch (e) {
    console.warn("Sean Home: gaming unavailable", e);
    renderGaming(null);
  }
  setTimeout(pollGaming, 60_000);
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

/* ── Daily midnight reload ───────────────────────────────────── */
// Reloads the page once after midnight so the date header and asset version
// stay current without a manual kiosk restart.
(function startDailyReloadWatcher() {
  function localDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }
  const loadedDate = localDateStr();
  let reloaded = false;
  setInterval(function () {
    if (reloaded) return;
    if (localDateStr() !== loadedDate) {
      reloaded = true;
      console.log("Sean Home: date rolled over — reloading dashboard");
      window.location.reload(true);
    }
  }, 60000);
})();

/* ── Boot ────────────────────────────────────────────────────── */
setTimeOfDayScene();
setInterval(setTimeOfDayScene, 3600000);

tickClock();
setInterval(tickClock, 1000);

pollSystemStatus();
setInterval(pollSystemStatus, 30000);

pollWeather();
setInterval(pollWeather, 600000);

// Live strip retired — Sports HQ is the live center
// pollLiveStrip();
pollCalendar();
pollGmail();
pollToday();
pollSports();
pollStandings();
pollMediaServer();
pollGaming();
