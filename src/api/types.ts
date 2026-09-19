// Shapes for the slice of the Superset REST API this sample touches.
// Kept deliberately small — extend as the Venapce front grows.

export interface SupersetDatabase {
  id: number
  database_name: string
  backend?: string
  expose_in_sqllab?: boolean
}

export interface DatasetColumn {
  column_name: string
  type?: string | null
  is_dttm?: boolean
  groupby?: boolean
  filterable?: boolean
}

export interface DatasetMetric {
  metric_name: string
  verbose_name?: string | null
  expression?: string
  d3format?: string | null
}

/** Summary row from GET /dataset/ */
export interface DatasetSummary {
  id: number
  table_name: string
  schema?: string | null
  database?: { id: number; database_name: string }
}

/** Body for POST /api/superset/datasets — register a table on an existing DB. */
export interface DatasetCreateInput {
  database: number
  schema?: string
  table_name: string
}

/** Full record from GET /dataset/{id} */
export interface DatasetDetail extends DatasetSummary {
  columns: DatasetColumn[]
  metrics: DatasetMetric[]
}

export interface DashboardSummary {
  id: number
  dashboard_title: string
  status?: string
  changed_on_delta_humanized?: string
  url?: string
}

// ---- Query context (what we POST to /chart/data) ----

export type AdhocMetric =
  | string // a saved metric name
  | {
      expressionType: 'SIMPLE'
      column: { column_name: string; type?: string | null }
      aggregate: string
      label: string
      hasCustomLabel?: boolean
    }
  | {
      expressionType: 'SQL'
      sqlExpression: string
      label: string
      hasCustomLabel?: boolean
    }

export interface QueryFilter {
  col: string
  op: string // '==', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'TEMPORAL_RANGE', 'IS NOT NULL', ...
  val?: string | number | Array<string | number> | null
}

/**
 * An ad-hoc column, i.e. a grouping expression that is more than a plain column
 * name. Superset uses this shape for the x-axis of a time-series chart: the
 * `BASE_AXIS` marker plus a `timeGrain` is what makes the backend bucket the
 * column (`DATE_TRUNC`-style) before grouping.
 */
export interface AdhocColumn {
  expressionType: 'SQL'
  sqlExpression: string
  label: string
  columnType?: 'BASE_AXIS' | 'SERIES'
  timeGrain?: string
}

export type QueryColumn = string | AdhocColumn

/** One entry of a query's `post_processing` chain (a pandas step run by Superset). */
export interface PostProcessingOp {
  operation: string
  options?: Record<string, unknown>
}

export interface QueryObject {
  columns: QueryColumn[]
  metrics: AdhocMetric[]
  filters: QueryFilter[]
  row_limit: number
  orderby?: Array<[AdhocMetric, boolean]>
  order_desc?: boolean
  /** Engine-level extras — `time_grain_sqla` buckets a temporal x-axis. */
  extras?: { time_grain_sqla?: string; where?: string; having?: string }
  /** True for a chart whose x-axis is time (Superset skips row-limit sorting then). */
  is_timeseries?: boolean
  /** Series breakdown columns, i.e. `columns` minus the base axis. */
  series_columns?: QueryColumn[]
  /** Keep only the top-N series (0 = all), ranked by `series_limit_metric`. */
  series_limit?: number
  series_limit_metric?: AdhocMetric
  /** Time shifts to fetch alongside the main series ('1 year ago', …). */
  time_offsets?: string[]
  /** Pandas steps Superset applies to the result frame (pivot / rolling / …). */
  post_processing?: PostProcessingOp[]
  annotation_layers?: unknown[]
}

export interface QueryContext {
  datasource: { id: number; type: 'table' }
  force: boolean
  queries: QueryObject[]
  form_data: Record<string, unknown>
  result_format: 'json'
  result_type: 'full'
}

/** Superset's `GenericDataType` — the per-column type tag in `coltypes`. */
export const COLTYPE_NUMERIC = 0
export const COLTYPE_STRING = 1
export const COLTYPE_TEMPORAL = 2
export const COLTYPE_BOOLEAN = 3

/** One entry of the /chart/data response `result` array. */
export interface ChartDataResult {
  data: Array<Record<string, unknown>>
  colnames: string[]
  coltypes?: number[]
  rowcount?: number
  error?: string | null
}

// ---- venapce-api shapes (our backend, not Superset) ----

/** What GET /api/settings/superset returns (never includes the password). */
export interface SupersetSettingsView {
  configured: boolean
  url?: string
  username?: string
  connected?: boolean
  connectedAs?: string
  connectionError?: string
  /** True when the connection is env-managed by the deploy (read-only in Settings). */
  managed?: boolean
}

/** On-demand load of Superset's example datasets (demo data), reported by the backend. */
export type ExamplesState = 'idle' | 'running' | 'loaded' | 'failed'
export interface ExamplesStatus {
  state: ExamplesState
  message?: string
  updatedAt?: string
}

/** A native Venapce chart persisted in venapce-api. */
export interface Chart {
  id: number
  title: string
  vizType: string
  queryContext: QueryContext
  builderState: import('@/lib/builder').BuilderState
  createdAt: string
  updatedAt: string
}

/** One placed chart on a dashboard grid (12-column, row units). */
export interface DashboardCell {
  chartId: number
  x: number
  y: number
  w: number
  h: number
}

/** A native Venapce dashboard: a title plus a grid arrangement of charts. */
export interface Dashboard {
  id: number
  title: string
  slug: string
  layout: DashboardCell[]
  createdAt: string
  updatedAt: string
}

// ---- osctrl (Nodes) shapes ----
// The Nodes area is backed by osctrl. As with Superset, the backend holds the
// osctrl API credentials and proxies its endpoints; the browser never sees the
// JWT. These match osctrl's /api/v1 shapes (see osctrl-api.yaml).

/** What GET /api/settings/osctrl returns (never includes the password). */
export interface OsctrlSettingsView {
  configured: boolean
  url?: string
  username?: string
  environment?: string
  connected?: boolean
  connectedAs?: string
  connectionError?: string
  /** True when this connection is a managed inflowenger osctrl space (read-only). */
  managed?: boolean
}

/** Live state of the in-process venapce plugin's connection to infra. */
export interface PluginStatus {
  /** Latched: we started the plugin and hold its connection. */
  running: boolean
  /** Live probe of the NATS socket to infra (re-evaluated on each read). */
  connected: boolean
  /** NATS connection state name: CONNECTED / RECONNECTING / CLOSED / … */
  connState?: string
  pluginId?: string
  error?: string
}

/** Plugin connectivity as FloMorphic sees it — a live @actions round-trip through
 *  FloMorphic (the reference for whether the plugin is connected). */
export interface PluginProbe {
  reachable: boolean
  /** How many palette actions the plugin exposes (when reachable). */
  actions?: number
  error?: string
}

/** What GET /api/settings/flomorphic returns (the venapce plugin registration). */
export interface FlomorphicSettingsView {
  configured: boolean
  /** FloMorphic extension row id (present once registered). */
  extensionId?: string
  pluginId?: string
  infraBase?: string
  /** True when a managed osctrl space has been provisioned + wired up. */
  osctrlManaged?: boolean
  /** Live status of the in-process plugin (present once registered). */
  plugin?: PluginStatus
  /** FloMorphic API access: env defaults (FLOMORPHIC_URL + FLOMORPHIC_JWT_SECRET +
   *  INFRA_HOST), overridden by whatever was saved in Settings. */
  apiConfigured?: boolean
  /** The configured FloMorphic API base URL (value is safe to show). */
  apiUrl?: string
  /** Whether the HS256 signing secret is set (the value is never returned). */
  jwtSecretSet?: boolean
  /** Host infra answers on — NATS :4222 for the plugin, osspace :8022 for osctrl. */
  infraHost?: string
  /** True while these come straight from the backend environment (nothing saved
   *  here yet), so the card can label them and offer "reset to environment". */
  apiFromEnv?: boolean
}

/** Outcome of saving/testing/resetting the FloMorphic access (the .../api routes).
 *  Carries the same public-safe view plus whether FloMorphic actually answered. */
export interface FlomorphicAccessResult {
  apiConfigured?: boolean
  apiUrl?: string
  jwtSecretSet?: boolean
  infraHost?: string
  apiFromEnv?: boolean
  /** Whether a live probe reached FloMorphic and it accepted the signed token. */
  reachable?: boolean
  /** Why the probe failed (absent when reachable). */
  reachError?: string
}

/** Outcome of registering/refreshing venapce in FloMorphic (PUT settings, or the
 *  refresh route): the extension + plugin ids, how many palette nodes the sync
 *  wrote, and any per-step error (registration is saved even when a later step
 *  fails). */
export interface FlomorphicConnectResult {
  configured: boolean
  extensionId?: string
  pluginId?: string
  /** Palette nodes written by the sync. */
  nodes?: number
  /** The plugin connected but sync failed (e.g. FloMorphic could not reach it). */
  syncError?: string
  /** The plugin failed to connect; nothing was synced. */
  pluginError?: string
  plugin?: PluginStatus
  probe?: PluginProbe
}

/** Outcome of the plugin/check route: connectivity as FloMorphic sees it. */
export interface FlomorphicCheckResult {
  probe?: PluginProbe
  plugin?: PluginStatus
}

/** One extra env var shipped in the minted plugin env. */
export interface FlomorphicEnvVar {
  key: string
  value: string
}

/** Outcome of POST /api/settings/flomorphic/osspace (the osctrl-space broker). */
export interface OsspaceResult {
  status: 'pending' | 'connected'
  /** When pending: the Google-OAuth url the user must open to provision a space. */
  redirect?: string
  environment?: string
  hostname?: string
  connected?: boolean
  connectedAs?: string
  connectionError?: string
}

/** An osctrl environment — a fleet/tenant nodes enroll into. */
export interface OsctrlEnvironment {
  uuid: string
  name: string
  hostname?: string
  type?: string
  icon?: string
}

/** A tag osctrl carries on a node (tags.AdminTag). Tags are records, not bare
 *  strings: each one brings its own colour and icon, and `custom_tag` says what
 *  kind it is — "env" for the environment's own tag, "tag" for the rest. */
export interface OsctrlTag {
  id: number
  name: string
  description?: string
  color?: string
  icon?: string
  created_by?: string
  custom_tag?: string
  /** True when osctrl attached it itself (e.g. the detected platform). */
  auto_tag?: boolean
  environment_id?: number
  tag_type?: number
  cohort?: boolean
  created_at?: string
  updated_at?: string
}

/** osctrl's own triage state for a node (types.NodeHealth). Computed server-side
 *  from the environment's inactive threshold (plus posture, where enabled), so
 *  the front reports what osctrl reports instead of guessing from last_seen. */
export interface OsctrlNodeHealth {
  /** healthy | attention | at_risk | offline */
  status?: string
  reason?: string
  signals?: string[]
}

/** Node uptime, present only when osctrl's posture collection is enabled. */
export interface OsctrlNodeUptime {
  days: number
  hours: number
  minutes: number
  seconds: number
  total_seconds?: number
  last_seen?: string
}

/** Compact posture summary; detailed controls live on osctrl's posture tab. */
export interface OsctrlNodePosture {
  risk_level?: string
}

/** The parsed, sanitized subset of the osquery enrollment payload that osctrl
 *  serves under `system_info` (types.NodeEnrichment). Absent when the node has
 *  no stored enrollment or it could not be parsed — every part is optional. */
export interface OsctrlNodeEnrichment {
  system?: {
    hardware_vendor?: string
    hardware_model?: string
    hardware_version?: string
    hardware_serial?: string
    cpu_brand?: string
    cpu_type?: string
    cpu_subtype?: string
    cpu_physical_cores?: string
    cpu_logical_cores?: string
    physical_memory?: string
    computer_name?: string
    local_hostname?: string
  }
  /** BIOS / firmware metadata (osquery calls this "platform_info"). */
  bios?: {
    vendor?: string
    version?: string
    date?: string
    revision?: string
    address?: string
    size?: string
    volume_size?: string
  }
  os?: {
    name?: string
    version?: string
    codename?: string
    major?: string
    minor?: string
    patch?: string
    platform?: string
    platform_like?: string
  }
  /** Runtime/build metadata of the osquery daemon that enrolled. */
  osquery?: {
    version?: string
    build_platform?: string
    build_distro?: string
    extensions?: string
    start_time?: string
    config_valid?: string
  }
}

/** An enrolled system as osctrl serves it (types.NodeView: nodes.OsqueryNode
 *  plus the projected extras). The list and the detail endpoint return the same
 *  shape — detail only adds the admin-only node key. */
export interface OsctrlNode {
  id?: number
  uuid: string
  hostname: string
  localname?: string
  ip_address?: string
  username?: string
  osquery_user?: string
  platform?: string
  platform_version?: string
  osquery_version?: string
  environment?: string
  environment_id?: number
  last_seen?: string
  created_at?: string
  updated_at?: string
  cpu?: string
  /** Physical memory in bytes, as a string — osquery reports it that way. */
  memory?: string
  hardware_serial?: string
  config_hash?: string
  daemon_hash?: string
  bytes_received?: number
  extra_data?: string
  /** ISO-3166 alpha-2 for ip_address, when osctrl has GeoIP configured. */
  country_code?: string
  tags?: OsctrlTag[]
  health?: OsctrlNodeHealth
  uptime?: OsctrlNodeUptime
  posture?: OsctrlNodePosture
  system_info?: OsctrlNodeEnrichment
}

/** One node from osctrl GET /nodes/{env}/node/{node} — the environment is part
 *  of the path, so the front must pass the selected env alongside the uuid. */
export interface OsctrlNodeDetail extends OsctrlNode {
  /** Admin-only, and only on this endpoint — the list omits it. */
  node_key?: string
}

/** One page of enrolled nodes (osctrl GET /nodes/{env}, its canonical paginated
 *  endpoint). The front pages through this rather than pulling every node at once,
 *  since an environment can hold far more than one screenful. */
export interface OsctrlNodesPage {
  items: OsctrlNode[]
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

/** An action osctrl accepts on an enroll/remove link for an environment. */
export type OsctrlLinkAction = 'rotate' | 'extend' | 'expire' | 'notexpire'

/** Which link an action targets — the enroll one or the remove/uninstall one. */
export type OsctrlLinkTarget = 'enroll' | 'remove'

/** Live state of an environment's enroll (or remove) link. These are real,
 *  configurable values on the environment — not just documentation.
 *  Enroll and remove are independent links with their own secret and expiry. */
export interface OsctrlLinkState {
  /** False once expired / manually disabled: the one-liner stops working. */
  enabled: boolean
  /** ISO expiry; absent means "never expires". */
  expires?: string
  /** The link's own secret path segment in the script URL —
   *  `https://{host}/{envUUID}/{path}/enroll.sh`. Rotating replaces it. */
  path?: string
}

/** A pre-built osquery package osctrl publishes for an environment. */
export interface OsctrlPackage {
  /** deb | rpm | pkg | msi */
  format: string
  arch?: string
  url: string
}

/** Enrollment helper values for an environment (osctrl ApiDataResponse.data). */
export interface OsctrlEnrollValues {
  secret?: string
  flags?: string
  certificate?: string
  /** Ready-to-run enroll one-liners keyed by platform (linux/windows/darwin). */
  oneLiner?: Record<string, string>
  /** Ready-to-run remove/uninstall one-liners keyed by platform — osctrl serves a
   *  remove.sh / remove.ps1 that stops osqueryd and de-enrolls the node. */
  removeOneLiner?: Record<string, string>
  /** TLS hostname the enrolled node reports to (for the tutorial). */
  hostname?: string
  /** The environment UUID that forms the first path segment of the script URLs. */
  envUUID?: string
  /** Live, editable state of the enroll and remove links for this environment. */
  enroll?: OsctrlLinkState
  remove?: OsctrlLinkState
  /** Optional pre-built packages (DEB/RPM/PKG/MSI) for manual installs. */
  packages?: OsctrlPackage[]
  [k: string]: unknown
}

// ---- Pipeline: Stage → Findings → Issues ----
// Three tables that evaluate data at three levels. The pipeline between them
// is fully OPTIONAL: a FloMorphic flow (the expert user's own rules) decides
// where a row lands. Raw data usually arrives on `stage`; a later process may
// turn a staged row into a `finding` when it shows some aspect worth tracking;
// a finding that needs validating / fixing / a mission becomes an `issue`. But
// a flow may just as well write straight to findings or issues — nothing forces
// the order. The tables are here to see and evaluate data, not to enforce a
// sequence. They share one vocabulary so every row is self-describing:
//
//   source   where the underlying DATA came from (connector / node / feed)
//   origin   which PROCESS produced this row (flow, query, api, manual …)
//   ref      structured provenance — how the row was made (flow id, run, rule,
//            upstream ids …). Any shape.
//   data     the payload / evidence itself. Any shape.
//   meta     enrichment / context attached by later processes. Any shape.
//   *Id      typed links between the tables (0 / absent = not linked)
//
// `data`, `meta` and `ref` are free-form JSON precisely because every producer
// has its own model; the UI renders them as an explorable tree (JsonTree).

/** A free-form JSON document column. Any shape — object, array or scalar. */
export type JsonDoc = unknown

/** Fields every pipeline row shares. */
export interface PipelineRow {
  id: number | string
  title: string
  summary?: string
  /** The polymorphic axis: tag sets both classify a row and build sub-views. */
  tags: string[]
  /** Where the underlying data came from (connector / node / feed). */
  source?: string
  /** Which process produced this row (a flow, a query, the API, a person). */
  origin?: string
  /** Structured provenance — how the row was made. */
  ref?: JsonDoc
  /** The payload / evidence. */
  data?: JsonDoc
  /** Enrichment / context attached by later processes. */
  meta?: JsonDoc
  updatedAt?: string
}

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

// ---- Issues (the Venapce axis table) ----
// `issues` is Venapce's single main table. Rather than a table per issue type,
// every row carries `tags`, and a saved sub-view is just a tag filter. Rows are
// produced and advanced by FloMorphic workflows (the auxiliary logic system) —
// directly, or by promoting a finding / staged row.

export interface Issue extends PipelineRow {
  /** Lifecycle state, driven by FloMorphic (e.g. open, proceed, resolved). */
  status: string
  severity?: IssueSeverity
  assignee?: string
  /** The finding / staged row this issue was promoted from, when it was. */
  findingId?: number | string | null
  stageId?: number | string | null
  createdAt?: string
}

/** Filter passed to GET /api/issues. */
export interface IssueQuery {
  tags?: string[]
  match?: 'any' | 'all'
  status?: string
  severity?: string
  search?: string
}

/** GET /api/issues/:id — the issue with its pipeline neighbours. */
export interface IssueDetail {
  item: Issue
  /** Findings that point at this issue. */
  findings: Finding[]
  /** The staged row the chain started from, if any. */
  stage: StageItem | null
}

/** Editable subset sent on PUT /api/issues/:id (partial — absent = keep). */
export type IssueInput = Partial<
  Pick<Issue, 'title' | 'summary' | 'status' | 'severity' | 'tags' | 'source' | 'origin' | 'assignee' | 'ref' | 'data' | 'meta'>
> & { findingId?: number; stageId?: number }

/** A user-defined saved sub-view under the Issues menu: a named tag filter. */
export interface IssueView {
  id: string
  name: string
  tags: string[]
  match: 'any' | 'all'
}

// ---- Findings (the middle level) ----
// What a process concluded from data: an observation with a severity, a
// confidence and a target, still to be validated. Every finding carries where
// it came from (source), which process made it (origin) and how (ref).

export type FindingStatus = 'new' | 'triaged' | 'confirmed' | 'false_positive' | 'promoted' | 'dismissed' | string

export interface Finding extends PipelineRow {
  status: FindingStatus
  severity?: IssueSeverity
  /** How sure the producer is (low / medium / high — free text). */
  confidence?: string
  /** Finding class: anomaly, vulnerability, misconfiguration, malware, policy … */
  category?: string
  /** The affected asset: node hostname / uuid, identity, service … */
  target?: string
  /** Producer-chosen dedup key (e.g. rule + target) so repeats are recognisable. */
  fingerprint?: string
  /** Staged row it was made from / issue it became. */
  stageId?: number | string | null
  issueId?: number | string | null
  createdAt?: string
}

/** Filter passed to GET /api/findings. */
export interface FindingQuery {
  tags?: string[]
  match?: 'any' | 'all'
  status?: string
  severity?: string
  category?: string
  source?: string
  target?: string
  search?: string
}

/** GET /api/findings/:id — the finding with its pipeline neighbours. */
export interface FindingDetail {
  item: Finding
  stage: StageItem | null
  issue: Issue | null
}

/** Editable subset sent on PUT /api/findings/:id (partial — absent = keep). */
export type FindingInput = Partial<
  Pick<
    Finding,
    | 'title' | 'summary' | 'status' | 'severity' | 'confidence' | 'category' | 'tags'
    | 'source' | 'origin' | 'target' | 'fingerprint' | 'ref' | 'data' | 'meta'
  >
> & { stageId?: number; issueId?: number }

// ---- Stage (the pipeline inbox) ----
// Raw, un-triaged rows. A FloMorphic flow inspects each row and routes it via
// `disposition`; a promoted row records what it became in findingId / issueId.

/** Where a FloMorphic flow routed a staged row. */
export type StageDisposition = 'pending' | 'promoted' | 'dropped' | 'held' | string

export interface StageItem extends PipelineRow {
  /** The flow's routing decision for this row. */
  disposition: StageDisposition
  /** What this row became once promoted (absent while pending). */
  findingId?: number | string | null
  issueId?: number | string | null
  receivedAt?: string
}

/** Filter passed to GET /api/stage. */
export interface StageQuery {
  disposition?: StageDisposition
  source?: string
  search?: string
}

/** GET /api/stage/:id — the staged row with the findings made from it. */
export interface StageDetail {
  item: StageItem
  findings: Finding[]
}

/** Editable subset sent on PUT /api/stage/:id (partial — absent = keep). */
export type StageInput = Partial<
  Pick<StageItem, 'title' | 'summary' | 'source' | 'origin' | 'disposition' | 'tags' | 'ref' | 'data' | 'meta'>
> & { findingId?: number; issueId?: number }

/** Overrides accepted when promoting a row to the next level. */
export interface PromoteInput extends FindingInput {
  assignee?: string
}
