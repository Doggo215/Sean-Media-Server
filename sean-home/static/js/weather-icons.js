// Sean Home — Animated SVG Weather Icons
// Pi 4 safe: no CSS filters, transform+opacity animations only.
// All SVGs use width="1em" height="1em" so they scale with parent font-size.

(function () {
  'use strict';

  /* ── Shared cloud path (three circles + base rect) ─────────────── */
  // cx/cy in 160×160 viewBox, cloud fills roughly y=55–120
  function cloudShape(color, x1, y1, r1, x2, y2, r2, x3, y3, r3) {
    var lx = Math.min(x1 - r1, x3 - r3) - 2;
    var rx = Math.max(x1 + r1, x3 + r3) + 2;
    var top = Math.min(y1 - r1, y2 - r2);
    var bot = Math.max(y1 + r1, y3 + r3) + 4;
    return [
      '<circle cx="' + x1 + '" cy="' + y1 + '" r="' + r1 + '" fill="' + color + '"/>',
      '<circle cx="' + x2 + '" cy="' + y2 + '" r="' + r2 + '" fill="' + color + '"/>',
      '<circle cx="' + x3 + '" cy="' + y3 + '" r="' + r3 + '" fill="' + color + '"/>',
      '<rect x="' + lx + '" y="' + (top + r2 + 2) + '" width="' + (rx - lx) + '" height="' + (bot - top - r2 - 2) + '" fill="' + color + '"/>',
    ].join('');
  }

  /* ── 1. Clear / Sunny ──────────────────────────────────────────── */
  function wxSunny() {
    return '<svg width="1em" height="1em" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">' +
      '<style>' +
        '.ws-r{animation:ws-spin 22s linear infinite;transform-origin:80px 80px}' +
        '.ws-h{animation:ws-glow 4s ease-in-out infinite}' +
        '@keyframes ws-spin{to{transform:rotate(45deg)}}' +
        '@keyframes ws-glow{0%,100%{opacity:.07}50%{opacity:.18}}' +
      '</style>' +
      '<circle class="ws-h" cx="80" cy="80" r="54" fill="#fbbf24"/>' +
      '<g class="ws-r" stroke="#fde68a" stroke-width="8" stroke-linecap="round">' +
        '<line x1="80" y1="36" x2="80" y2="18"/>' +
        '<line x1="80" y1="124" x2="80" y2="142"/>' +
        '<line x1="36" y1="80" x2="18" y2="80"/>' +
        '<line x1="124" y1="80" x2="142" y2="80"/>' +
        '<line x1="108" y1="52" x2="121" y2="39"/>' +
        '<line x1="52" y1="108" x2="39" y2="121"/>' +
        '<line x1="108" y1="108" x2="121" y2="121"/>' +
        '<line x1="52" y1="52" x2="39" y2="39"/>' +
      '</g>' +
      '<circle cx="80" cy="80" r="33" fill="#fbbf24"/>' +
      '<circle cx="80" cy="80" r="24" fill="#fde68a" opacity=".45"/>' +
      '</svg>';
  }

  /* ── 2. Partly Cloudy / Mostly Clear ──────────────────────────── */
  function wxPartlyCloudy() {
    return '<svg width="1em" height="1em" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">' +
      '<style>' +
        '.wp-c{animation:wp-float 5s ease-in-out infinite}' +
        '.wp-s{animation:wp-glow 4s ease-in-out infinite}' +
        '@keyframes wp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}' +
        '@keyframes wp-glow{0%,100%{opacity:.8}50%{opacity:1}}' +
      '</style>' +
      '<circle class="wp-s" cx="50" cy="52" r="28" fill="#fbbf24"/>' +
      '<g class="wp-s" stroke="#fde68a" stroke-width="6" stroke-linecap="round">' +
        '<line x1="50" y1="14" x2="50" y2="24"/>' +
        '<line x1="50" y1="80" x2="50" y2="90"/>' +
        '<line x1="12" y1="52" x2="22" y2="52"/>' +
        '<line x1="78" y1="52" x2="88" y2="52"/>' +
        '<line x1="24" y1="26" x2="31" y2="33"/>' +
        '<line x1="69" y1="71" x2="76" y2="78"/>' +
        '<line x1="76" y1="26" x2="69" y2="33"/>' +
        '<line x1="24" y1="78" x2="31" y2="71"/>' +
      '</g>' +
      '<g class="wp-c">' +
        cloudShape('#cbd5e1', 68, 104, 24, 93, 92, 30, 118, 104, 22) +
      '</g>' +
      '</svg>';
  }

  /* ── 3. Cloudy / Overcast ──────────────────────────────────────── */
  function wxCloudy() {
    return '<svg width="1em" height="1em" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">' +
      '<style>' +
        '.wc-b{animation:wc-d1 7s ease-in-out infinite}' +
        '.wc-f{animation:wc-d2 5s ease-in-out infinite}' +
        '@keyframes wc-d1{0%,100%{transform:translateX(0)}50%{transform:translateX(8px)}}' +
        '@keyframes wc-d2{0%,100%{transform:translateX(0)}50%{transform:translateX(-6px)}}' +
      '</style>' +
      '<g class="wc-b">' + cloudShape('#64748b', 56, 82, 24, 83, 68, 30, 110, 82, 22) + '</g>' +
      '<g class="wc-f">' + cloudShape('#94a3b8', 56, 98, 26, 83, 84, 33, 112, 98, 24) + '</g>' +
      '</svg>';
  }

  /* ── 4. Fog / Mist / Haze ─────────────────────────────────────── */
  function wxFog() {
    return '<svg width="1em" height="1em" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">' +
      '<style>' +
        '.wf-l{animation:wf-d 3.5s ease-in-out infinite}' +
        '.wf-l:nth-child(2){animation-delay:.5s;animation-duration:4s}' +
        '.wf-l:nth-child(3){animation-delay:1s;animation-duration:3s}' +
        '.wf-l:nth-child(4){animation-delay:.25s;animation-duration:4.5s}' +
        '.wf-l:nth-child(5){animation-delay:.75s;animation-duration:3.8s}' +
        '@keyframes wf-d{0%,100%{transform:translateX(0);opacity:.55}50%{transform:translateX(12px);opacity:.85}}' +
      '</style>' +
      '<g stroke="#94a3b8" stroke-width="9" stroke-linecap="round">' +
        '<line class="wf-l" x1="18" y1="50" x2="140" y2="50"/>' +
        '<line class="wf-l" x1="28" y1="72" x2="132" y2="72"/>' +
        '<line class="wf-l" x1="14" y1="94" x2="146" y2="94"/>' +
        '<line class="wf-l" x1="28" y1="116" x2="132" y2="116"/>' +
        '<line class="wf-l" x1="18" y1="138" x2="140" y2="138"/>' +
      '</g>' +
      '</svg>';
  }

  /* ── 5. Drizzle / Light Rain ───────────────────────────────────── */
  function wxDrizzle() {
    return '<svg width="1em" height="1em" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">' +
      '<style>' +
        '.wd-d{animation:wd-r 1.6s ease-in-out infinite}' +
        '.wd-d:nth-child(2){animation-delay:.32s}' +
        '.wd-d:nth-child(3){animation-delay:.64s}' +
        '.wd-d:nth-child(4){animation-delay:.96s}' +
        '.wd-d:nth-child(5){animation-delay:1.28s}' +
        '@keyframes wd-r{0%,100%{opacity:0;transform:translateY(-4px)}30%{opacity:.8}80%{opacity:.5}99%{transform:translateY(22px)}}' +
      '</style>' +
      cloudShape('#94a3b8', 58, 76, 24, 83, 62, 30, 108, 76, 22) +
      '<g stroke="#60a5fa" stroke-width="4" stroke-linecap="round">' +
        '<line class="wd-d" x1="50" y1="112" x2="47" y2="128"/>' +
        '<line class="wd-d" x1="70" y1="116" x2="67" y2="132"/>' +
        '<line class="wd-d" x1="90" y1="112" x2="87" y2="128"/>' +
        '<line class="wd-d" x1="110" y1="116" x2="107" y2="132"/>' +
        '<line class="wd-d" x1="130" y1="112" x2="127" y2="128"/>' +
      '</g>' +
      '</svg>';
  }

  /* ── 6. Rain / Heavy Rain / Showers ───────────────────────────── */
  function wxRain() {
    return '<svg width="1em" height="1em" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">' +
      '<style>' +
        '.wr-d{animation:wr-r 1s ease-in infinite}' +
        '.wr-d:nth-child(2){animation-delay:.2s}' +
        '.wr-d:nth-child(3){animation-delay:.4s}' +
        '.wr-d:nth-child(4){animation-delay:.6s}' +
        '.wr-d:nth-child(5){animation-delay:.8s}' +
        '.wr-d:nth-child(6){animation-delay:.1s}' +
        '.wr-d:nth-child(7){animation-delay:.5s}' +
        '@keyframes wr-r{0%{opacity:0;transform:translateY(0)}25%{opacity:.9}90%{opacity:.6}100%{opacity:0;transform:translateY(28px)}}' +
      '</style>' +
      cloudShape('#64748b', 55, 74, 26, 82, 60, 32, 110, 74, 24) +
      '<g stroke="#3b82f6" stroke-width="5" stroke-linecap="round">' +
        '<line class="wr-d" x1="44" y1="108" x2="40" y2="126"/>' +
        '<line class="wr-d" x1="63" y1="112" x2="59" y2="130"/>' +
        '<line class="wr-d" x1="82" y1="108" x2="78" y2="126"/>' +
        '<line class="wr-d" x1="101" y1="112" x2="97" y2="130"/>' +
        '<line class="wr-d" x1="120" y1="108" x2="116" y2="126"/>' +
        '<line class="wr-d" x1="53" y1="128" x2="49" y2="146"/>' +
        '<line class="wr-d" x1="92" y1="128" x2="88" y2="146"/>' +
      '</g>' +
      '</svg>';
  }

  /* ── 7. Snow / Blizzard / Ice ──────────────────────────────────── */
  function wxSnow() {
    return '<svg width="1em" height="1em" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">' +
      '<style>' +
        '.wsn-f{animation:wsn-fall 2.4s ease-in infinite}' +
        '.wsn-f:nth-child(2){animation-delay:.4s}' +
        '.wsn-f:nth-child(3){animation-delay:.8s}' +
        '.wsn-f:nth-child(4){animation-delay:1.2s}' +
        '.wsn-f:nth-child(5){animation-delay:1.6s}' +
        '.wsn-f:nth-child(6){animation-delay:2.0s}' +
        '@keyframes wsn-fall{0%{opacity:0;transform:translateY(0)}25%{opacity:.9}85%{opacity:.6}100%{opacity:0;transform:translateY(30px)}}' +
      '</style>' +
      cloudShape('#94a3b8', 56, 72, 24, 82, 58, 30, 108, 72, 22) +
      '<g fill="#bfdbfe">' +
        '<circle class="wsn-f" cx="47" cy="112" r="5.5"/>' +
        '<circle class="wsn-f" cx="73" cy="118" r="4.5"/>' +
        '<circle class="wsn-f" cx="100" cy="112" r="5.5"/>' +
        '<circle class="wsn-f" cx="127" cy="118" r="4.5"/>' +
        '<circle class="wsn-f" cx="60" cy="134" r="4.5"/>' +
        '<circle class="wsn-f" cx="113" cy="134" r="5"/>' +
      '</g>' +
      '</svg>';
  }

  /* ── 8. Thunderstorm ───────────────────────────────────────────── */
  function wxStorm() {
    return '<svg width="1em" height="1em" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">' +
      '<style>' +
        '.wst-b{animation:wst-flash 2.8s ease-in-out infinite}' +
        '@keyframes wst-flash{0%,100%{opacity:.15}18%,20%{opacity:1}38%,40%{opacity:.2}58%,60%{opacity:.9}78%{opacity:.15}}' +
      '</style>' +
      cloudShape('#475569', 54, 72, 26, 82, 58, 33, 112, 72, 24) +
      '<g stroke="#60a5fa" stroke-width="3" stroke-linecap="round" opacity=".5">' +
        '<line x1="46" y1="106" x2="43" y2="120"/>' +
        '<line x1="122" y1="106" x2="119" y2="120"/>' +
      '</g>' +
      '<polygon class="wst-b" points="92,100 79,124 88,124 74,150 108,116 97,116 110,100" fill="#fbbf24"/>' +
      '</svg>';
  }

  /* ── Public API ─────────────────────────────────────────────────── */
  window.getWeatherIcon = function (condition) {
    var c = (condition || '').toLowerCase();
    if (c.includes('thunder') || c.includes('storm'))              return wxStorm();
    if (c.includes('blizzard'))                                     return wxSnow();
    if (c.includes('snow') || c.includes('ice') || c.includes('sleet') || c.includes('flurr')) return wxSnow();
    if (c.includes('rain') || c.includes('shower'))                 return wxRain();
    if (c.includes('drizzle'))                                      return wxDrizzle();
    if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return wxFog();
    if (c.includes('overcast'))                                     return wxCloudy();
    if (c.includes('partly') || c.includes('mostly clear'))         return wxPartlyCloudy();
    if (c.includes('cloud') || c.includes('mostly cloudy'))         return wxCloudy();
    if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) return wxSunny();
    return wxSunny();
  };
})();
