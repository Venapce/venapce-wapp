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
| **Chart Builder** | Pick a dataset → dimensions / metrics / filters → builds a `query_context`, renders with ECharts (bar/line/area/pie/table/big-number). **Save** persists the chart for dashboards to use. |
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
ChartBuilderView.vue        builder UI (dataset, dims, metrics, filters, viz type)
  └─ lib/builder.ts         BuilderState → Superset query_context
       └─ api/venapce.ts    POST /api/superset/chart/data  (backend proxy)
            └─ lib/echartsOption.ts   result rows → ECharts `option`
                 └─ ChartRenderer.vue  <v-chart :option> / table / big-number
```

- [src/api/venapce.ts](src/api/venapce.ts) — the whole backend API surface (Superset proxy, charts, dashboards, nodes, stage, issues).
- [src/lib/builder.ts](src/lib/builder.ts) — swap/extend viz types, aggregates, filter ops.
- [src/lib/echartsOption.ts](src/lib/echartsOption.ts) — the row→chart transforms.
- [src/components/AppShell.vue](src/components/AppShell.vue) — the main menu / layout.
- [src/router/index.ts](src/router/index.ts) — routes and the Superset-config guard.
