// ECharts paints on a canvas, so it can't inherit the CSS variables the rest of
// the UI runs on. Each transform therefore returns a theme-free `option`, and
// this module lays the light/dark chrome (axes, grid lines, labels, tooltip)
// over it at render time — which is also what makes the theme toggle live.

const LIGHT = {
  fg: '#0b0a10',
  fgMuted: '#5c5566',
  fgSubtle: '#8b8595',
  line: '#e6e5ea',
  lineStrong: '#d6d5db',
  surface: '#ffffff',
  tooltipBg: 'rgba(255,255,255,.96)',
}

const DARK = {
  fg: '#f2f2f5',
  fgMuted: '#9ca0ac',
  fgSubtle: '#6c707c',
  line: '#2a2c36',
  lineStrong: '#383b47',
  surface: '#16171d',
  tooltipBg: 'rgba(28,30,38,.96)',
}

type Dict = Record<string, unknown>

const isPlain = (v: unknown): v is Dict => !!v && typeof v === 'object' && !Array.isArray(v)

/** Merge `base` under `over` — `over` (the chart's own option) always wins. */
function under(base: Dict, over: unknown): Dict {
  if (!isPlain(over)) return { ...base }
  const out: Dict = { ...base }
  for (const [k, v] of Object.entries(over)) {
    out[k] = isPlain(v) && isPlain(base[k]) ? under(base[k] as Dict, v) : v
  }
  return out
}

/** A themed copy of `option`. Safe to call on any chart family. */
export function applyChartTheme(option: Record<string, unknown>, dark: boolean): Record<string, unknown> {
  const c = dark ? DARK : LIGHT

  const axis = {
    axisLine: { lineStyle: { color: c.lineStrong } },
    axisTick: { lineStyle: { color: c.lineStrong } },
    axisLabel: { color: c.fgMuted, fontSize: 11 },
    nameTextStyle: { color: c.fgSubtle, fontSize: 11 },
    splitLine: { lineStyle: { color: c.line, type: 'dashed' } },
    minorSplitLine: { lineStyle: { color: c.line, opacity: 0.5 } },
  }

  const themed: Record<string, unknown> = {
    ...option,
    textStyle: under({ color: c.fg, fontFamily: 'inherit' }, option.textStyle),
    legend: under({ textStyle: { color: c.fgMuted, fontSize: 11 }, inactiveColor: c.fgSubtle }, option.legend),
    tooltip: under(
      {
        backgroundColor: c.tooltipBg,
        borderColor: c.line,
        borderWidth: 1,
        padding: [6, 10],
        textStyle: { color: c.fg, fontSize: 12 },
        extraCssText: 'backdrop-filter:blur(6px);box-shadow:0 4px 14px rgba(0,0,0,.18)',
      },
      option.tooltip,
    ),
  }

  if (option.xAxis) themed.xAxis = under(axis, option.xAxis)
  if (option.yAxis) themed.yAxis = under(axis, option.yAxis)
  if (option.dataZoom) themed.dataZoom = themeDataZoom(option.dataZoom, c)

  // The heatmap's colour scale and the radar's web are chrome too: both default
  // to near-black text and light-grey lines, which vanish in dark mode.
  if (option.visualMap) {
    themed.visualMap = under({ textStyle: { color: c.fgMuted, fontSize: 10 } }, option.visualMap)
  }
  if (option.radar) {
    themed.radar = under(
      {
        axisName: { color: c.fgMuted },
        axisLine: { lineStyle: { color: c.line } },
        splitLine: { lineStyle: { color: c.line } },
        splitArea: { areaStyle: { color: [c.surface, 'transparent'] } },
      },
      option.radar,
    )
  }
  if (Array.isArray(option.series)) themed.series = option.series.map((s) => themeSeries(s, c))

  return themed
}

function themeDataZoom(zoom: unknown, c: typeof LIGHT): unknown {
  const style = {
    borderColor: c.line,
    backgroundColor: 'transparent',
    fillerColor: dim(c.lineStrong),
    handleStyle: { color: c.surface, borderColor: c.lineStrong },
    moveHandleStyle: { color: c.lineStrong },
    textStyle: { color: c.fgSubtle },
    dataBackground: { lineStyle: { color: c.lineStrong }, areaStyle: { color: c.line } },
  }
  return Array.isArray(zoom) ? zoom.map((z) => under(style, z)) : under(style, zoom)
}

/** Series-level chrome: the slice/label colours that must contrast with the ground. */
function themeSeries(series: unknown, c: typeof LIGHT): unknown {
  if (!isPlain(series)) return series
  const type = series.type

  // Families that paint labels *inside* a filled shape keep ECharts' own
  // white-on-colour labels — recolouring them to the page's muted grey is what
  // makes a treemap unreadable. Only their borders follow the theme.
  if (type === 'treemap' || type === 'sunburst' || type === 'funnel') {
    return under({ itemStyle: { borderColor: c.surface } }, series)
  }
  if (type === 'pie') {
    return under({ itemStyle: { borderColor: c.surface }, label: { color: c.fgMuted } }, series)
  }
  if (type === 'tree') {
    return under({ label: { color: c.fg }, lineStyle: { color: c.lineStrong } }, series)
  }
  if (type === 'sankey' || type === 'graph' || type === 'heatmap') {
    return under({ label: { color: c.fg } }, series)
  }
  if (type === 'gauge') {
    return under(
      {
        axisLine: { lineStyle: { color: [[1, c.line]] } },
        axisLabel: { color: c.fgSubtle },
        axisTick: { lineStyle: { color: c.lineStrong } },
        splitLine: { lineStyle: { color: c.lineStrong } },
        title: { color: c.fgMuted },
        detail: { color: c.fg },
      },
      series,
    )
  }
  if (type === 'boxplot') {
    return under({ itemStyle: { borderColor: c.fgMuted } }, series)
  }
  return under({ label: { color: c.fgMuted } }, series)
}

const dim = (hex: string): string => `${hex}33`
