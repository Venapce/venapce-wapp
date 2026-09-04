# Venapce · Dashboard Builder (sample front)

A **headless** Vue 3 front that renders **Superset data natively** — Apache ECharts
via `vue-echarts`, **no iframe, no embedded SDK**. It's the proof-of-concept for the
Venapce dashboard/chart builder and the seed of the future Venapce main menu.

> Companion to [`../aio-superset/SUPERSET-INTEGRATION-STUDY.md`](../aio-superset/SUPERSET-INTEGRATION-STUDY.md).
> This sample implements **reuse strategy A** ("Superset for data, our ECharts for
> pixels") and the **`POST /api/v1/chart/data`** path described there.

## Stack

Vue 3.5 · Vite · TypeScript · Vue Router · Pinia · Tailwind CSS · `echarts` + `vue-echarts` · axios.

## Architecture note

The browser no longer talks to Superset directly. It talks to the **Venapce
backend** (`../venapce-api`, Go + Fiber + Postgres), which holds the Superset
service account and proxies Superset's data endpoints. The old "Connect to
Superset" login is gone — Superset is configured once in **Settings** and the
token never reaches the browser (integration study §4). Set
`VITE_VENAPCE_API_URL` to point at the backend (default `http://localhost:8091`).

## What it does

| Page | What it shows |
|------|----------------|
| **Settings** | Enter the Superset URL + credentials → saved & encrypted by the backend, which probes the login |
| **Chart Builder** ⭐ | Pick a dataset → dimensions / metrics / filters → builds a `query_context`, renders with ECharts (bar/line/area/pie/table/big-number). **Save** persists the chart to the backend so dashboards can use it. |
| **Datasets** | Browse the instance's databases and datasets (via the backend proxy) |
| **Dashboards** ⭐ | Create a native dashboard, **drop in saved charts and arrange** them on a drag/resize grid, then **view** them rendered natively in the Venapce panel |

## Run

Start the backend first (`../venapce-api` — see its README), then:

```bash
npm install
cp .env.example .env      # set VITE_VENAPCE_API_URL if the backend isn't on :8091
npm run dev               # http://localhost:5173
```

Open the app → it lands on **Settings** until Superset is configured. Enter the
Superset URL + admin credentials, Save, then build charts and assemble dashboards.

## ⚠️ Make your Superset instance reachable from the browser

Because this front calls Superset's API **directly from the browser** (the headless
model), the instance must permit this origin. Add to your **`superset_config.py`** and
restart Superset:

```python
# --- Allow the Vue dev origin to call the API ---
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["/api/*"],
    "origins": ["http://localhost:5173"],   # add your deployed origin here too
}

# --- Simplest auth for a headless client (DEV): drop CSRF on the API ---
# Superset's CSRF is session-cookie based; for a token (Bearer) client the
# cleanest path is to exempt the API. Pick ONE of these:
WTF_CSRF_ENABLED = False
# ...or keep CSRF globally and exempt just the data endpoint:
# WTF_CSRF_EXEMPT_LIST = ["superset.charts.data.api.ChartDataRestApi.data"]

# --- Per-space multi-tenancy (see the study §6); harmless to enable now ---
FEATURE_FLAGS = {"DASHBOARD_RBAC": True}
```

The client sends the JWT as `Authorization: Bearer …` and, when CSRF is enabled,
also `X-CSRFToken` with `withCredentials` so the CSRF cookie rides along. Exempting
the API (above) removes the cookie dance entirely — recommended for the sample.

### Alternative: avoid CORS with the Vite dev proxy

Instead of the CORS block, route calls through Vite:

```bash
VITE_SUPERSET_PROXY_TARGET=http://localhost:8088 npm run dev
```

Then Connect using base URL **`/superset`** (same-origin → no CORS, no cookie fuss).

## How the crux works (where to look)

```
ChartBuilderView.vue          builder UI (dataset, dims, metrics, filters, viz type)
  └─ lib/builder.ts           BuilderState → Superset query_context   (like Superset's buildQuery.ts)
       └─ api/superset.ts     POST /api/v1/chart/data                 (the data endpoint)
            └─ lib/echartsOption.ts   result rows → ECharts `option`  (like Superset's transformProps.ts)
                 └─ ChartRenderer.vue  <v-chart :option> / table / big-number
```

- **`lib/builder.ts`** — swap/extend viz types, aggregates, filter ops here.
- **`lib/echartsOption.ts`** — the transforms. For *pixel-identical* Superset output,
  this is where you'd instead call Superset's own `transformProps` (study §2, strategy B).
- **`api/superset.ts`** — the whole API surface; auth, refresh, catalog, `chartData`.

## Notes / next steps

- **Auth topology:** the sample talks to Superset **directly** for simplicity. In
  Venapce proper, proxy the API through the FloMorphic backend so the service token
  never reaches the browser and each request is **scoped to the caller's space**
  (study §4, §6). The `api/superset.ts` client would then point at the Venapce proxy
  instead of Superset.
- **Persist built charts** back via `POST /api/v1/chart/` (not yet wired) so they also
  live inside Superset.
- **Session storage:** tokens are kept in `localStorage` for dev convenience. Fine for
  a sample; the production front should hold them server-side (proxy model above).
- **Dashboards:** reconstruct the grid from `position_json` + per-chart `query_context`
  using the same renderer — the natural follow-on to the builder.
