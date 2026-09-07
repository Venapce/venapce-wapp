// The Venapce icon set.
//
// One flat map of name → SVG body, drawn on a 24×24 grid in a single stroked
// style (round caps, 1.75 units, `currentColor`), so every icon sits on the
// same optical weight as the 13px UI text next to it. <Icon> supplies the
// wrapper; entries here supply only the geometry.
//
// Two families live here:
//   • UI icons     — the verbs of the app (add, remove, run, save, search…).
//   • Chart glyphs — one per catalogue entry (lib/vizCatalog.ts), each a tiny
//     picture of the chart it selects rather than an emoji stand-in.

export type IconName = keyof typeof ICONS

/* eslint-disable */
export const ICONS = {
  // ---- UI: verbs -----------------------------------------------------------
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  trash:
    '<path d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M18.5 6 17.6 19a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5.5 6"/><path d="M10 11v5M14 11v5"/>',
  pencil:
    '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 6 3 3"/>',
  save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 3v6h8V3"/><path d="M7 21v-7h10v7"/>',
  play: '<path d="M7 4.8v14.4a.6.6 0 0 0 .9.5l12-7.2a.6.6 0 0 0 0-1L7.9 4.3a.6.6 0 0 0-.9.5Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4-4"/>',
  filter: '<path d="M4 5h16l-6.2 7.3V19l-3.6 1.8v-8.5Z"/>',
  refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M21 3.5V9h-5.5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  arrowRight: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  code: '<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/><path d="M14 4.5 10 19.5"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M3 3.5 21 21"/><path d="M10.7 6.2A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17.6 17.6 0 0 1-3.3 3.9"/><path d="M6.7 8.3A16.9 16.9 0 0 0 2.5 12S6 18 12 18a9.6 9.6 0 0 0 3.4-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  sliders:
    '<path d="M4 7h4M12 7h8M4 12h10M18 12h2M4 17h6M14 17h6"/><circle cx="10" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="12" cy="17" r="2"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1Z"/>',
  grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  alert: '<path d="M10.3 4.3 2.7 17.6A2 2 0 0 0 4.4 20.6h15.2a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6h.01"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 12 12"/><path d="M18 14.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5"/>',
  // ---- UI: places ----------------------------------------------------------
  dashboard:
    '<rect x="3" y="3" width="8" height="9" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="14" width="8" height="7" rx="1.5"/>',
  monitor: '<rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  inbox: '<path d="M5.5 4.5h13l2.5 8.5v4.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V13Z"/><path d="M3 13h4.5l1.4 2.6h6.2L16.5 13H21"/>',
  flag: '<path d="M5.5 21.5V3.5"/><path d="M5.5 4.5h11l-1.7 3.6 1.7 3.6h-11Z"/>',
  hash: '<path d="M9.8 3.8 7.6 20.2M16.4 3.8l-2.2 16.4M4.2 9h15.6M3.4 15h15.6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',

  sparkle: '<path d="m12 3 2.1 5.4L19.5 10.5l-5.4 2.1L12 18l-2.1-5.4L4.5 10.5l5.4-2.1Z"/><path d="M19 17.5 19.8 19.7 22 20.5l-2.2.8L19 23.5l-.8-2.2L16 20.5l2.2-.8Z"/>',

  // ---- Chart glyphs: evolution --------------------------------------------
  chartLine: '<path d="M4 4v16h16" opacity=".45"/><path d="m6.5 16 3.5-4.5 3.5 2.5L20 7"/>',
  chartSmooth: '<path d="M4 4v16h16" opacity=".45"/><path d="M6 16.5c2.5 0 2.5-8 6-8s3.5 5.5 8-1"/>',
  chartBar:
    '<path d="M4 4v16h16" opacity=".45"/><rect x="6.5" y="12" width="3.2" height="6" rx=".8"/><rect x="11.7" y="7.5" width="3.2" height="10.5" rx=".8"/><rect x="16.9" y="14" width="3.2" height="4" rx=".8"/>',
  chartBarH:
    '<path d="M4 4v16h16" opacity=".45"/><rect x="6" y="6" width="10.5" height="3.2" rx=".8"/><rect x="6" y="10.4" width="6" height="3.2" rx=".8"/><rect x="6" y="14.8" width="13" height="3.2" rx=".8"/>',
  chartArea:
    '<path d="M4 4v16h16" opacity=".45"/><path d="M6.5 18v-5.5L10 9l3.5 2.5L20 5.5V18Z"/>',
  chartStep: '<path d="M4 4v16h16" opacity=".45"/><path d="M6 17h3.5v-5H14V8.5h6"/>',
  chartScatter:
    '<path d="M4 4v16h16" opacity=".45"/><circle cx="9" cy="15.5" r="1.5"/><circle cx="12.5" cy="10" r="1.5"/><circle cx="17" cy="13" r="1.5"/><circle cx="19" cy="7.5" r="1.5"/>',
  chartBubble:
    '<path d="M4 4v16h16" opacity=".45"/><circle cx="9.5" cy="15" r="2.3"/><circle cx="14" cy="9.5" r="3.2"/><circle cx="19" cy="15" r="1.6"/>',
  chartMixed:
    '<path d="M4 4v16h16" opacity=".45"/><rect x="6.5" y="12.5" width="3" height="5.5" rx=".7"/><rect x="11.5" y="10" width="3" height="8" rx=".7"/><rect x="16.5" y="14" width="3" height="4" rx=".7"/><path d="m6 12 4-5 4.5 3 5.5-4.5" opacity=".8"/>',
  chartPercent: '<path d="M19 5.5 5 18.5"/><circle cx="7.8" cy="7.8" r="2.4"/><circle cx="16.2" cy="16.2" r="2.4"/>',
  chartClock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.4 2.2"/>',
  chartWaterfall:
    '<path d="M4 4v16h16" opacity=".45"/><rect x="6" y="13" width="3" height="5" rx=".7"/><rect x="10.5" y="9" width="3" height="4.5" rx=".7"/><rect x="15" y="9" width="3" height="5" rx=".7"/><path d="M9 13h1.5M13.5 9H15M18 14h1.5" opacity=".6"/>',
  chartHorizon:
    '<path d="M3.5 8.5h17M3.5 13h17M3.5 17.5h17" opacity=".35"/><path d="M4 17c3-6 5.5 1.5 8.5-3.5S17 12 20 8"/>',
  chartCompare: '<path d="M7.5 20V6"/><path d="m4.5 9 3-3 3 3"/><path d="M16.5 4v14"/><path d="m13.5 15 3 3 3-3"/>',
  chartTrendline:
    '<path d="M4.5 9.5 7 7.8V15"/><path d="M11.5 8.6a2.3 2.3 0 1 1 4 1.6L11.5 15h4.6"/><path d="m3.5 20 4.5-3.2 4 2 4-4.5 4.5 2.7" opacity=".65"/>',
  chartBigNumber:
    '<path d="M5 8.8 8 6.8V17"/><path d="M13 9.4a2.7 2.7 0 1 1 4.6 1.9L13 17h5.4"/>',

  // ---- Chart glyphs: distribution / correlation ----------------------------
  chartHistogram:
    '<path d="M4 4v16h16" opacity=".45"/><rect x="6" y="14.5" width="3" height="3.5"/><rect x="9" y="10.5" width="3" height="7.5"/><rect x="12" y="7.5" width="3" height="10.5"/><rect x="15" y="12" width="3" height="6"/>',
  chartBoxplot:
    '<path d="M4 4v16h16" opacity=".45"/><path d="M9 6v2.5M9 15.5V18"/><rect x="6.6" y="8.5" width="4.8" height="7" rx=".8"/><path d="M6.6 12.4h4.8"/><path d="M17 7.5v2M17 15v2.5"/><rect x="14.6" y="9.5" width="4.8" height="5.5" rx=".8"/><path d="M14.6 12.2h4.8"/>',
  chartHeatmap:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><rect x="6" y="6" width="4" height="4" rx=".6" fill="currentColor" stroke="none" opacity=".85"/><rect x="11" y="6" width="4" height="4" rx=".6" fill="currentColor" stroke="none" opacity=".35"/><rect x="6" y="11" width="4" height="4" rx=".6" fill="currentColor" stroke="none" opacity=".45"/><rect x="11" y="11" width="4" height="4" rx=".6" fill="currentColor" stroke="none" opacity=".75"/><rect x="16" y="11" width="2.5" height="4" rx=".6" fill="currentColor" stroke="none" opacity=".25"/><rect x="6" y="16" width="4" height="2.5" rx=".6" fill="currentColor" stroke="none" opacity=".2"/>',
  chartCalendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><rect x="6.5" y="13" width="3" height="3" rx=".5" fill="currentColor" stroke="none" opacity=".8"/><rect x="10.5" y="13" width="3" height="3" rx=".5" fill="currentColor" stroke="none" opacity=".35"/><rect x="14.5" y="13" width="3" height="3" rx=".5" fill="currentColor" stroke="none" opacity=".6"/>',
  chartParallel:
    '<path d="M5.5 4v16M12 4v16M18.5 4v16" opacity=".45"/><path d="m5.5 9 6.5 6 6.5-4"/><path d="m5.5 16 6.5-7 6.5 6.5"/>',
  chartTtest: '<path d="M7.5 4.5v11a2.5 2.5 0 0 0 2.5 2.5h1"/><path d="M4.8 9h5.4"/><path d="M14.5 11.5h5.5M17.2 8.8v5.4"/><path d="M14.5 17.5h5.5"/>',

  // ---- Chart glyphs: part of a whole ---------------------------------------
  chartPie: '<circle cx="12" cy="12" r="8.5"/><path d="M12 12V3.5A8.5 8.5 0 0 1 19.6 8.2Z" fill="currentColor" stroke="none" opacity=".55"/><path d="M12 3.5V12l7.6-3.8"/>',
  chartDonut:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.8"/><path d="M12 3.5A8.5 8.5 0 0 1 19.6 8.2L15 10.5A3.8 3.8 0 0 0 12 7.7Z" fill="currentColor" stroke="none" opacity=".55"/>',
  chartRose:
    '<circle cx="12" cy="12" r="8.5" opacity=".35"/><path d="M12 12V4a8 8 0 0 1 5.7 2.3Z"/><path d="M12 12h6.6a6.6 6.6 0 0 1-1.9 4.7Z"/><path d="M12 12v4.6a4.6 4.6 0 0 1-3.3-1.4Z"/>',
  chartTreemap:
    '<rect x="3.5" y="3.5" width="9.5" height="9" rx="1.2"/><rect x="14.5" y="3.5" width="6" height="5" rx="1.2"/><rect x="14.5" y="10" width="6" height="10.5" rx="1.2"/><rect x="3.5" y="14" width="9.5" height="6.5" rx="1.2"/>',
  chartSunburst:
    '<circle cx="12" cy="12" r="3"/><path d="M12 6.5a5.5 5.5 0 0 1 4.8 2.8"/><path d="M16.8 14.7A5.5 5.5 0 0 1 12 17.5"/><path d="M7.2 14.7a5.5 5.5 0 0 1 0-5.4"/><path d="M12 3a9 9 0 0 1 7.8 4.5" opacity=".55"/><path d="M19.8 16.5A9 9 0 0 1 12 21" opacity=".55"/><path d="M4.2 16.5a9 9 0 0 1 0-9" opacity=".55"/>',
  chartFunnel: '<path d="M3.5 5h17l-4.5 5.5H8Z"/><path d="M8.6 12.6h6.8l-2.4 3.6h-2Z"/><path d="M11.3 18.3h1.4l-.3 2.7h-.8Z"/>',
  chartPartition:
    '<rect x="3.5" y="4" width="17" height="3.6" rx="1"/><rect x="3.5" y="9.2" width="10" height="3.6" rx="1"/><rect x="14.5" y="9.2" width="6" height="3.6" rx="1"/><rect x="3.5" y="14.4" width="5.5" height="3.6" rx="1"/><rect x="10" y="14.4" width="4" height="3.6" rx="1"/>',

  // ---- Chart glyphs: flow ---------------------------------------------------
  chartTree:
    '<rect x="9" y="3" width="6" height="4" rx="1.2"/><rect x="3" y="16.5" width="6" height="4" rx="1.2"/><rect x="15" y="16.5" width="6" height="4" rx="1.2"/><path d="M12 7v4.5M6 16.5v-5h12v5"/>',
  chartSankey:
    '<rect x="3" y="4.5" width="2.6" height="6" rx="1"/><rect x="3" y="13" width="2.6" height="6.5" rx="1"/><rect x="18.4" y="6" width="2.6" height="5.5" rx="1"/><rect x="18.4" y="14" width="2.6" height="5.5" rx="1"/><path d="M5.6 7.5c6.5 0 6.5 1.3 12.8 1.3"/><path d="M5.6 16.2c6.5 0 6.5.5 12.8.5"/>',
  chartGraph:
    '<circle cx="6" cy="7" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="14" r="2.5"/><circle cx="5.5" cy="18.5" r="2"/><path d="m7.6 8.5 2.7 3.4M16.4 7.6l-2.6 4.1M10.4 15.7 7.2 17.5"/>',
  chartChord: '<circle cx="12" cy="12" r="8.5"/><path d="M6.2 5.8c5.5 3 5.5 9.5 12 6.5"/><path d="M8.5 20c.8-6.8 5.8-9 9.5-13.2"/>',
  chartEventFlow:
    '<circle cx="5.5" cy="7" r="1.9"/><circle cx="12" cy="7" r="1.9"/><circle cx="18.5" cy="7" r="1.9"/><path d="M7.4 7h2.7M13.9 7h2.7"/><circle cx="5.5" cy="16.5" r="1.9"/><circle cx="14" cy="16.5" r="1.9"/><path d="M7.4 16.5h4.7"/>',

  // ---- Chart glyphs: KPI ----------------------------------------------------
  chartGauge: '<path d="M3.8 17.5a8.5 8.5 0 1 1 16.4 0"/><path d="m12 17.5 4-5.5"/><circle cx="12" cy="17.5" r="1.3" fill="currentColor" stroke="none"/>',
  chartBullet: '<rect x="3" y="8.5" width="18" height="7" rx="1.5" opacity=".45"/><rect x="3" y="10.5" width="10.5" height="3" rx="1" fill="currentColor" stroke="none"/><path d="M16.5 7v10"/>',

  // ---- Chart glyphs: table / text ------------------------------------------
  chartTable: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M9.5 9.5V20"/><path d="M3 15h18" opacity=".55"/>',
  chartPivot:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M9.5 4v16"/><path d="M15 9.5V20M3 15h18" opacity=".55"/>',
  chartTimeTable: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M11 9.5V20"/><path d="m13.5 16.5 2-2.5 1.7 1.3 1.8-2.6"/>',
  chartWordCloud: '<path d="M4 7.5h8.5M15 7.5h5"/><path d="M6 12h6.5M15 12h3.5"/><path d="M4 16.5h4.5M11 16.5h9"/>',
  chartMarkup: '<path d="M5 5.5h14M5 10.5h14M5 15.5h9"/>',
  chartSeparator: '<path d="M4 12h16"/><path d="M7 7h10M7 17h10" opacity=".4"/>',
  chartBraces:
    '<path d="M9 3.5H8a2 2 0 0 0-2 2V9a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3.5a2 2 0 0 0 2 2h1"/><path d="M15 3.5h1a2 2 0 0 1 2 2V9a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3.5a2 2 0 0 1-2 2h-1"/>',
  chartFilterBox: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8.5h10l-3.8 4.4V17l-2.4 1.2v-5.3Z"/>',
  chartRadar:
    '<path d="m12 3 8.6 6.2-3.3 10.1H6.7L3.4 9.2Z"/><path d="m12 7.4 4.9 3.6-1.9 5.8H9L7.1 11Z" opacity=".55"/>',

  // ---- Chart glyphs: maps ---------------------------------------------------
  chartWorldMap: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18Z"/>',
  chartCountryMap: '<path d="m9 3.8 6 2.4 5.5-2.4v14.4L15 20.6l-6-2.4-5.5 2.4V6.2Z"/><path d="M9 3.8v14.4M15 6.2v14.4"/>',
  chartMapPin: '<path d="M12 21.2s7-6 7-11.2a7 7 0 1 0-14 0c0 5.2 7 11.2 7 11.2Z"/><circle cx="12" cy="10" r="2.6"/>',
  chartMapGrid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  chartMapHex: '<path d="m12 3 7.5 4.3v8.4L12 20l-7.5-4.3V7.3Z"/><path d="m12 8.2 3.2 1.9v3.8L12 15.8l-3.2-1.9v-3.8Z" opacity=".55"/>',
  chartMapPath: '<circle cx="5.5" cy="18" r="2.3"/><circle cx="18.5" cy="6" r="2.3"/><path d="M7.8 18h4.4a4 4 0 0 0 4-4V8.3"/>',
  chartMapPolygon: '<path d="m12 3.2 8.6 5.6-3.3 11H6.7l-3.3-11Z"/><circle cx="12" cy="3.2" r="1.2" fill="currentColor" stroke="none"/>',
  chartMapArc: '<path d="M4 18a8 8 0 0 1 16 0"/><circle cx="4" cy="18" r="1.8"/><circle cx="20" cy="18" r="1.8"/>',
  chartMapHeat: '<path d="M12 3.2s4.8 4.4 4.8 8.8a4.8 4.8 0 0 1-9.6 0c0-2 1-3.2 1-3.2s.9 1.5 1.9 1.5S12 6.4 12 3.2Z"/>',
  chartMapContour: '<circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="12" r="5.6" opacity=".65"/><circle cx="12" cy="12" r="9" opacity=".4"/>',
  chartMapLayers: '<path d="m12 3 8.5 4.7L12 12.4 3.5 7.7Z"/><path d="m3.5 12.2 8.5 4.7 8.5-4.7" opacity=".7"/><path d="m3.5 16.6 8.5 4.7 8.5-4.7" opacity=".45"/>',
} as const
/* eslint-enable */

/** Fallback glyph for a name the set doesn't carry (a dot, never nothing). */
export const FALLBACK_ICON = '<circle cx="12" cy="12" r="3.5"/>'

export const iconBody = (name: string): string =>
  (ICONS as Record<string, string>)[name] ?? FALLBACK_ICON

export const hasIcon = (name: string): boolean => name in ICONS
