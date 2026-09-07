# Venapce · Web App (`venapce-wapp`)

The **Vue 3 panel** for [Venapce](https://inflowenger.com/venapce) — the *face* of the
system. Fleet view, security posture, the issue pipeline, and a native BI surface, all
in one app. It renders **Superset data natively** — Apache ECharts via `vue-echarts`,
**no iframe, no embedded SDK** — and reads everything else (nodes, stage, issues) from
the Venapce backend.

> Venapce is built the **FloMorphic way**: all business logic lives in
> [FloMorphic](https://inflowenger.com/flomorphic) workflows, and this app is only the
> view over the data those workflows produce. Background:
> [the write-up](https://inflowenger.com/blog/venapce-a-nervous-system-for-security) ·
> [product page](https://inflowenger.com/venapce).

## Stack

Vue 3.5 · Vite · TypeScript · Vue Router · Pinia · Tailwind CSS ·
`echarts` + `vue-echarts` · `grid-layout-plus` · axios.

## Architecture

The browser talks to **one** service: the **Venapce backend** (`venapce-api`, Go + Fiber
+ Postgres). The backend holds the Superset and osctrl service accounts and proxies their
data endpoints, so **no upstream token ever reaches the browser**. Connections are
configured once in **Settings**; point the app at the backend with `VITE_VENAPCE_API_URL`
(default `http://localhost:8091`).

```
Senses (osquery agents, plugins)  →  FloMorphic workflows  →  Venapce backend  →  this app
        raw data frames               correlate & evaluate      proxy + native tables    the view
```

## The main menu

| Area | What it shows |
|------|----------------|
| **Visualizations** | Native dashboards — drop in saved charts and **arrange** them on a drag/resize grid, then view them rendered natively (no iframe). |
| **Chart Builder** | Pick a dataset → per-chart controls → builds a `query_context`, renders with ECharts. Five common types sit inline; **View all charts** opens the full Superset catalogue (74 types, deprecated ones flagged). **Save** persists the chart for dashboards to use. |
| **Datasets** | Browse the instance's databases and datasets, via the backend proxy. |
| **Nodes** | The fleet — enrolled osquery systems (Linux/macOS/Windows) from **osctrl**, with online status and search, plus **Enroll** commands for new nodes. |
| **Stage** | The pipeline inbox: raw, un-triaged rows every pipeline feeds in. A FloMorphic flow routes each (`pending` / `promoted` / `held` / `dropped`). |
| **Issues** | The single issues table — enriched, promoted signal. Every row carries **tags**; a saved sub-view is just a named tag filter. FloMorphic produces and advances the rows. |
| **Settings** | Configure the Superset and osctrl connections (stored & encrypted server-side, login probed) and optionally load Superset's demo datasets. |

> The Nodes and Stage/Issues views fall back to a built-in **sample data** set (with a
> banner) when the backend isn't reachable, so the UI stays reviewable during development.

## Run

Start the backend first (`venapce-api`), then:

```bash
npm install
cp .env.example .env      # set VITE_VENAPCE_API_URL if the backend isn't on :8091
npm run dev               # http://localhost:5173
```

Open the app → dashboard/chart pages funnel to **Settings** until Superset is configured.
Enter the Superset URL + admin credentials, Save, then build charts and assemble
dashboards. Nodes and Issues have their own data sources and don't require Superset.

Other scripts: `npm run build` (type-check + production build), `npm run preview`,
`npm run typecheck`.

## Where to look

The native-render pipeline (Superset data → ECharts pixels):

```
ChartBuilderView.vue        builder UI (dataset, viz type, per-family controls)
  └─ lib/builder.ts         BuilderState → Superset query_context (+ post_processing)
       └─ api/venapce.ts    POST /api/superset/chart/data  (backend proxy)
            └─ lib/echartsOption.ts   dispatch → lib/viz/<family>.ts → ECharts `option`
                 └─ ChartRenderer.vue  <v-chart :option> / table / big-number
```

### Chart types

The picker mirrors Superset's: five common types inline, the rest behind **View all
charts**. Superset's viz registry is compile-time (no REST endpoint enumerates it), so
[src/lib/vizCatalog.ts](src/lib/vizCatalog.ts) mirrors it — every type with its real
`viz_type` key, category and deprecation flag. Entries marked *native* are rendered here;
the rest are listed but not selectable, so the gap is visible rather than hidden.

| Family | Engine | What it supports |
|--------|--------|------------------|
| **Time-series** (line / smooth / bar / area / step / scatter / big number with trendline) | [lib/viz/timeseries.ts](src/lib/viz/timeseries.ts) | Temporal x-axis with time grain and time range, series breakdown with a series limit, and the advanced analytics that become `post_processing` steps on the query — contribution mode, rolling window (mean/sum/std/cumsum), time shift with values/difference/percentage/ratio comparison, and resampling. Plus stacking, markers, value labels, log axis, bounds, zoom slider, legend placement. |
| **Scatter / Bubble** | [lib/viz/scatter.ts](src/lib/viz/scatter.ts) | X, Y and an optional size metric (area-proportional bubbles), entity and colour dimensions, log axes, per-series least-squares trend line. |
| **Histogram** | [lib/viz/histogram.ts](src/lib/viz/histogram.ts) | Shared bin edges across groups, grouped/stacked/overlaid display, normalisation and cumulative mode. Binned in the browser from the raw column, so it works against any Superset version. |
| **Box plot** | [lib/viz/boxplot.ts](src/lib/viz/boxplot.ts) | Quartiles by interpolation, 1.5·IQR whiskers, outliers as points — one box per group. Shares the histogram's raw-value query. |
| **Tree** | [lib/viz/tree.ts](src/lib/viz/tree.ts) | id/parent/name adjacency lists, orthogonal or radial layout, expand depth, pan &amp; zoom — with multi-root and cyclic-edge handling. |
| **Categorical** (bar / line / area / pie / rose / funnel / radar / waterfall / treemap / sunburst / heatmap / sankey / graph / word cloud / gauge / table / pivot table / big number) | [lib/viz/categorical.ts](src/lib/viz/categorical.ts) | One query — N metrics over up to three dimensions — read a dozen ways. Bars flip horizontal and stack; pies turn into donuts and roses; treemap and sunburst roll the dimension list into a hierarchy; heatmap, sankey and graph cross two dimensions (the sankey drops cycle-closing links rather than failing); the pivot table cross-tabs with row totals; the word cloud is DOM, not canvas. |

The raw query result is kept in the builder, so display-only controls (formats, bin count,
tree layout, colours) re-render instantly — only query changes need a re-run.

- [src/api/venapce.ts](src/api/venapce.ts) — the whole backend API surface (Superset proxy, charts, dashboards, nodes, stage, issues).
- [src/lib/builder.ts](src/lib/builder.ts) — builder state, per-family `query_context` building, viz engines.
- [src/lib/vizCatalog.ts](src/lib/vizCatalog.ts) — the chart-type catalogue behind the picker.
- [src/lib/viz/](src/lib/viz/) — one row→`option` transform per chart family (`theme.ts` paints them light/dark).
- [src/components/builder/](src/components/builder/) — the control panels, one per family, plus the chart-type dialog and the saved-chart library (open / remove).
- [src/lib/icons.ts](src/lib/icons.ts) + [src/components/Icon.vue](src/components/Icon.vue) — the icon set: UI verbs and one drawn glyph per catalogue entry, all on one 24×24 stroked grid.
- [src/components/AppShell.vue](src/components/AppShell.vue) — the main menu / layout.
- [src/router/index.ts](src/router/index.ts) — routes and the Superset-config guard.
