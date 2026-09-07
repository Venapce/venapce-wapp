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
  op: string // '==', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NOT NULL', ...
  val?: string | number | Array<string | number> | null
}

export interface QueryObject {
  columns: string[]
  metrics: AdhocMetric[]
  filters: QueryFilter[]
  row_limit: number
  orderby?: Array<[AdhocMetric, boolean]>
  order_desc?: boolean
}

export interface QueryContext {
  datasource: { id: number; type: 'table' }
  force: boolean
  queries: QueryObject[]
  form_data: Record<string, unknown>
  result_format: 'json'
  result_type: 'full'
}

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
  /** FloMorphic API access, from the backend env (FLOMORPHIC_URL + FLOMORPHIC_JWT_SECRET). */
  apiConfigured?: boolean
  /** The configured FloMorphic API base URL (value is safe to show). */
  apiUrl?: string
  /** Whether the HS256 signing secret is set (the value is never returned). */
  jwtSecretSet?: boolean
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

/** An enrolled system reported by osctrl (nodes.OsqueryNode, trimmed). */
export interface OsctrlNode {
  id?: number
  uuid: string
  hostname: string
  localname?: string
  ip_address?: string
  platform?: string
  platform_version?: string
  osquery_version?: string
  environment?: string
  last_seen?: string
  created_at?: string
  cpu?: string
  memory?: string
}

/** Full record for one node (osctrl GET /nodes/{env}/node/{uuid}, trimmed).
 *  Richer than the table row: adds the osquery config/enroll context and a few
 *  live counters osctrl tracks per node. */
export interface OsctrlNodeDetail extends OsctrlNode {
  node_key?: string
  username?: string
  hardware_serial?: string
  config_hash?: string
  daemon_hash?: string
  bytes_received?: number
  /** Last time osctrl saw a config pull / status log / result log from the node. */
  last_config?: string
  last_status?: string
  last_result?: string
  /** Operator-assigned tags on the node. */
  tags?: string[]
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

// ---- Issues (the Venapce axis table) ----
// `issues` is Venapce's single main table. Rather than a table per issue type,
// every row carries `tags`, and a saved sub-view is just a tag filter. Rows are
// produced and advanced by FloMorphic workflows (the auxiliary logic system);
// this front reads, filters, and displays them.

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Issue {
  id: number | string
  title: string
  summary?: string
  /** Lifecycle state, driven by FloMorphic (e.g. open, proceed, resolved). */
  status: string
  severity?: IssueSeverity
  /** The polymorphic axis: tag sets both classify a row and build sub-views. */
  tags: string[]
  /** Originating system / node / workflow. */
  source?: string
  assignee?: string
  createdAt?: string
  updatedAt?: string
  /** Free-form payload the workflow attached. */
  data?: Record<string, unknown>
}

/** Filter passed to GET /api/issues. */
export interface IssueQuery {
  tags?: string[]
  match?: 'any' | 'all'
  status?: string
  search?: string
}

/** A user-defined saved sub-view under the Issues menu: a named tag filter. */
export interface IssueView {
  id: string
  name: string
  tags: string[]
  match: 'any' | 'all'
}

// ---- Stage (the pipeline inbox that precedes Issues) ----
// Everything a pipeline feeds into FloMorphic lands on `stage` first — raw,
// un-triaged. A FloMorphic flow inspects each row and, if it meets the flow's
// criteria, promotes it into `issues` (attaching the issue's tags); otherwise it
// is dropped or held. Stage is therefore the waiting room ahead of the axis table.

/** Where a FloMorphic flow routed a staged row. */
export type StageDisposition = 'pending' | 'promoted' | 'dropped' | 'held' | string

export interface StageItem {
  id: number | string
  title?: string
  summary?: string
  /** Pipeline / connector the data arrived from. */
  source?: string
  /** The flow's routing decision for this row. */
  disposition: StageDisposition
  /** Issue this row became, once promoted (null while pending). */
  issueId?: number | string | null
  tags?: string[]
  /** Raw incoming payload the pipeline delivered. */
  data?: Record<string, unknown>
  receivedAt?: string
  updatedAt?: string
}

/** Filter passed to GET /api/stage. */
export interface StageQuery {
  disposition?: StageDisposition
  source?: string
  search?: string
}
