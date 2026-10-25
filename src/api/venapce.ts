import axios, { type AxiosError, type AxiosInstance } from 'axios'
import type { BuilderState } from '@/lib/builder'
import type {
  Chart,
  ChartDataResult,
  Dashboard,
  DashboardCell,
  DashboardSummary,
  DatasetCreateInput,
  DatasetDetail,
  DatasetSummary,
  ExamplesStatus,
  PreferencesBundle,
  PreferencesImportMode,
  PreferencesReport,
  PreferencesSection,
  FlomorphicAccessResult,
  FlomorphicCheckResult,
  FlomorphicConnectResult,
  FlomorphicSettingsView,
  Finding,
  FindingDetail,
  FindingInput,
  FindingQuery,
  Issue,
  IssueDetail,
  IssueInput,
  IssueQuery,
  OsctrlEnrollValues,
  OsctrlEnvironment,
  OsctrlLinkAction,
  OsctrlLinkTarget,
  OsctrlNodeDetail,
  OsctrlNodesPage,
  OsctrlSettingsView,
  OsspaceResult,
  QueryContext,
  PromoteInput,
  StageDetail,
  StageInput,
  StageItem,
  StageQuery,
  SavedView,
  SavedViewInput,
  SavedViewTable,
  SupersetDatabase,
  SupersetSettingsView,
  Activity,
  ActivityDetail,
  ActivityInput,
  ActivityQuery,
  FlowEntryView,
  FlowSummary,
  FlowTagFacets,
  RunFlowInput,
  RunFlowResult,
  Operation,
  OperationBundle,
  OperationDetail,
  OperationImportInput,
  OperationPreview,
  OperationRunInput,
  OperationSettingsPlan,
  PackInput,
} from './types'

// The Venapce backend base URL. In dev the API runs on :8091 (see venapce-api/.env);
// override with VITE_VENAPCE_API_URL for other environments.
const API_BASE = import.meta.env.VITE_VENAPCE_API_URL || 'http://localhost:8091'

export interface ChartInput {
  title: string
  vizType: string
  queryContext: QueryContext
  builderState: BuilderState
}

export interface DashboardInput {
  title: string
  slug?: string
  layout: DashboardCell[]
}

/**
 * Client for the Venapce backend. The browser talks only to this — the backend
 * holds the Superset service account and proxies Superset's data endpoints, so
 * the Superset token never reaches the browser (integration study §4).
 *
 * The Superset-proxy methods keep the same names/shapes the old in-browser
 * SupersetClient exposed, so the chart builder and datasets views port over with
 * minimal change.
 */
export class VenapceClient {
  readonly base: string
  private http: AxiosInstance

  constructor(base = API_BASE) {
    this.base = base.replace(/\/+$/, '')
    this.http = axios.create({ baseURL: this.base })
  }

  /** The backend's build identity (its stamped release version). */
  async apiVersion(): Promise<string> {
    const { data } = await this.http.get('/api/version')
    return data?.version ?? ''
  }

  // ---- settings ----
  async supersetSettings(): Promise<SupersetSettingsView> {
    const { data } = await this.http.get('/api/settings/superset')
    return data
  }
  async saveSuperset(body: { url: string; username: string; password?: string }): Promise<SupersetSettingsView> {
    const { data } = await this.http.put('/api/settings/superset', body)
    return data
  }
  async testSuperset(): Promise<SupersetSettingsView> {
    const { data } = await this.http.post('/api/settings/superset/test', {})
    return data
  }
  /** Revert an external-Superset override back to the built-in (env-managed) connection. */
  async resetSuperset(): Promise<SupersetSettingsView> {
    const { data } = await this.http.post('/api/settings/superset/reset', {})
    return data
  }
  /** Current state of the on-demand example-data (demo) load. */
  async examplesStatus(): Promise<ExamplesStatus> {
    const { data } = await this.http.get('/api/settings/superset/examples/status')
    return data
  }
  /** Trigger a background load of Superset's example datasets. Idempotent. */
  async loadExamples(): Promise<ExamplesStatus> {
    const { data } = await this.http.post('/api/settings/superset/examples', {})
    return data
  }

  // ---- preferences in and out ----
  // The configuration an operator builds, as one JSON file: the charts, the
  // dashboards they sit on, the saved views. No pipeline rows, no credentials
  // — see types.ts.

  /** This install's preferences. `sections` narrows what comes back; empty
   *  means every section. */
  async exportPreferences(sections: PreferencesSection[] = [], label = ''): Promise<PreferencesBundle> {
    const params: Record<string, string> = {}
    if (sections.length) params.include = sections.join(',')
    if (label) params.label = label
    const { data } = await this.http.get('/api/settings/preferences', { params })
    return data
  }

  /**
   * Apply a preferences file.
   *
   * `dryRun` applies the whole file inside a transaction and rolls it back, so
   * the report is the real one — same conflicts, same skips — with nothing
   * kept. That is what the panel shows before anyone commits to the import.
   */
  async importPreferences(
    bundle: PreferencesBundle,
    opts: { include?: PreferencesSection[]; mode?: PreferencesImportMode; dryRun?: boolean } = {},
  ): Promise<PreferencesReport> {
    const { data } = await this.http.post('/api/settings/preferences/import', {
      bundle,
      include: opts.include?.length ? opts.include : undefined,
      mode: opts.mode ?? 'merge',
      dryRun: !!opts.dryRun,
    })
    return data
  }

  // ---- Superset proxy (mirrors the old SupersetClient surface) ----
  async databases(): Promise<SupersetDatabase[]> {
    const { data } = await this.http.get('/api/superset/databases')
    return data
  }
  async datasets(search = ''): Promise<DatasetSummary[]> {
    const { data } = await this.http.get('/api/superset/datasets', { params: search ? { search } : {} })
    return data
  }
  async dataset(id: number): Promise<DatasetDetail> {
    const { data } = await this.http.get(`/api/superset/datasets/${id}`)
    return { id, ...data }
  }
  /** Schema names on an existing database connection (for the Add Dataset picker). */
  async databaseSchemas(dbId: number): Promise<string[]> {
    const { data } = await this.http.get(`/api/superset/databases/${dbId}/schemas`)
    return data ?? []
  }
  /** Table names in a schema on a database connection. */
  async databaseTables(dbId: number, schema = ''): Promise<string[]> {
    const { data } = await this.http.get(`/api/superset/databases/${dbId}/tables`, {
      params: schema ? { schema } : {},
    })
    // Superset returns [{ value, type, ... }]; keep just the names.
    return (data ?? []).map((t: { value?: string } | string) => (typeof t === 'string' ? t : t.value ?? ''))
  }
  /** Register a physical dataset (table) on an existing database connection. */
  async createDataset(body: DatasetCreateInput): Promise<{ id: number }> {
    const { data } = await this.http.post('/api/superset/datasets', body)
    return data
  }
  async supersetDashboards(): Promise<DashboardSummary[]> {
    const { data } = await this.http.get('/api/superset/dashboards')
    return data
  }
  async chartData(ctx: QueryContext): Promise<ChartDataResult> {
    const { data } = await this.http.post('/api/superset/chart/data', ctx)
    const first = data.result?.[0]
    if (!first) throw new Error('Superset returned no result payload')
    if (first.error) throw new Error(first.error)
    return first
  }

  // ---- native charts ----
  async listCharts(): Promise<Chart[]> {
    const { data } = await this.http.get('/api/charts')
    return data
  }
  async getChart(id: number): Promise<Chart> {
    const { data } = await this.http.get(`/api/charts/${id}`)
    return data
  }
  async createChart(body: ChartInput): Promise<Chart> {
    const { data } = await this.http.post('/api/charts', body)
    return data
  }
  async updateChart(id: number, body: ChartInput): Promise<Chart> {
    const { data } = await this.http.put(`/api/charts/${id}`, body)
    return data
  }
  async deleteChart(id: number): Promise<void> {
    await this.http.delete(`/api/charts/${id}`)
  }

  // ---- native dashboards ----
  async listDashboards(): Promise<Dashboard[]> {
    const { data } = await this.http.get('/api/dashboards')
    return data
  }
  async getDashboard(id: number): Promise<Dashboard> {
    const { data } = await this.http.get(`/api/dashboards/${id}`)
    return data
  }
  async createDashboard(body: DashboardInput): Promise<Dashboard> {
    const { data } = await this.http.post('/api/dashboards', body)
    return data
  }
  async updateDashboard(id: number, body: DashboardInput): Promise<Dashboard> {
    const { data } = await this.http.put(`/api/dashboards/${id}`, body)
    return data
  }
  async deleteDashboard(id: number): Promise<void> {
    await this.http.delete(`/api/dashboards/${id}`)
  }

  // ---- osctrl connection settings (mirrors the Superset settings surface) ----
  async osctrlSettings(): Promise<OsctrlSettingsView> {
    const { data } = await this.http.get('/api/settings/osctrl')
    return data
  }
  async saveOsctrl(body: {
    url: string
    username: string
    password?: string
    environment?: string
  }): Promise<OsctrlSettingsView> {
    const { data } = await this.http.put('/api/settings/osctrl', body)
    return data
  }
  async testOsctrl(): Promise<OsctrlSettingsView> {
    const { data } = await this.http.post('/api/settings/osctrl/test', {})
    return data
  }

  // ---- FloMorphic plugin registration + the osctrl-space broker ----
  async flomorphicSettings(): Promise<FlomorphicSettingsView> {
    const { data } = await this.http.get('/api/settings/flomorphic')
    return data
  }
  /**
   * Save where FloMorphic is — API base, shared JWT secret, infra host — overriding
   * the backend environment's values. Takes effect immediately (the live client is
   * rebuilt) and survives a container recreate. A blank `jwtSecret` keeps the one
   * already stored.
   */
  async saveFlomorphicAccess(body: {
    url: string
    jwtSecret?: string
    infraHost?: string
    /** Where the panel answers in a browser, for the "open in FloMorphic" links. */
    panelUrl?: string
  }): Promise<FlomorphicAccessResult> {
    const { data } = await this.http.put('/api/settings/flomorphic/api', body)
    return data
  }
  /** Probe FloMorphic without saving — pass values to try, or {} for the live ones. */
  async testFlomorphicAccess(body: {
    url?: string
    jwtSecret?: string
  } = {}): Promise<FlomorphicAccessResult> {
    const { data } = await this.http.post('/api/settings/flomorphic/api/test', body)
    return data
  }
  /** Drop the saved override and go back to the backend environment's values. */
  async resetFlomorphicAccess(): Promise<FlomorphicAccessResult> {
    const { data } = await this.http.post('/api/settings/flomorphic/api/reset', {})
    return data
  }
  /**
   * Register venapce as a FloMorphic plugin: create the extension row, mint its
   * credential, connect the in-process plugin, and sync its actions into palette
   * nodes. Reuses the stored row on repeat calls.
   */
  async connectFlomorphic(): Promise<FlomorphicConnectResult> {
    const { data } = await this.http.put('/api/settings/flomorphic', {})
    return data
  }
  /**
   * Redefine venapce in FloMorphic: delete the extension row (and its synced
   * nodes), then register afresh and re-sync. The "clear and re-add" path.
   */
  async refreshFlomorphic(): Promise<FlomorphicConnectResult> {
    const { data } = await this.http.post('/api/settings/flomorphic/plugin/refresh', {})
    return data
  }
  /** Check plugin connectivity as FloMorphic sees it (live @actions round-trip). */
  async checkFlomorphicPlugin(): Promise<FlomorphicCheckResult> {
    const { data } = await this.http.post('/api/settings/flomorphic/plugin/check', {})
    return data
  }
  /**
   * Drive infra's osspace flow. Idempotent + pollable: returns `pending` with a
   * Google-OAuth `redirect` url the user must open, then `connected` once the
   * space is provisioned and wired up as a managed osctrl connection.
   */
  async connectOsspace(): Promise<OsspaceResult> {
    const { data } = await this.http.post('/api/settings/flomorphic/osspace', {})
    return data
  }

  // ---- osctrl proxy (backend holds the JWT; browser never sees it) ----
  async osctrlEnvironments(): Promise<OsctrlEnvironment[]> {
    const { data } = await this.http.get('/api/osctrl/environments')
    return data
  }
  /**
   * One page of enrolled nodes for an environment. The backend proxies osctrl's
   * paginated endpoint, so the browser pages through large environments instead
   * of pulling every node at once. `search` maps to osctrl's `q` free-text match.
   */
  async osctrlNodes(
    env: string,
    opts: { page?: number; pageSize?: number; search?: string } = {},
  ): Promise<OsctrlNodesPage> {
    const params: Record<string, string | number> = { env }
    if (opts.page) params.page = opts.page
    if (opts.pageSize) params.page_size = opts.pageSize
    if (opts.search) params.q = opts.search
    const { data } = await this.http.get('/api/osctrl/nodes', { params })
    return data
  }
  /** Full detail for one node (osctrl exposes a rich per-node record). */
  async osctrlNode(env: string, uuid: string): Promise<OsctrlNodeDetail> {
    const { data } = await this.http.get(`/api/osctrl/nodes/${encodeURIComponent(uuid)}`, {
      params: { env },
    })
    return data
  }
  async osctrlEnroll(env: string, target = 'osquery'): Promise<OsctrlEnrollValues> {
    const { data } = await this.http.get('/api/osctrl/enroll', { params: { env, target } })
    return data
  }
  /**
   * Act on an environment's enroll/remove link: rotate the secret, extend the
   * expiration (osctrl uses a fixed period), expire it now, or clear the
   * expiration. Returns the refreshed enroll values so the page reflects the
   * new state.
   */
  async osctrlEnrollAction(
    env: string,
    target: OsctrlLinkTarget,
    action: OsctrlLinkAction,
  ): Promise<OsctrlEnrollValues> {
    const { data } = await this.http.post('/api/osctrl/enroll/actions', {
      env,
      target,
      action,
    })
    return data
  }

  // ---- Saved views ----
  // A view is a named tag filter over one of the pipeline tables; the table's
  // own list endpoint then does the filtering with the view's tags + match.
  async listViews(table?: SavedViewTable): Promise<SavedView[]> {
    const { data } = await this.http.get('/api/views', { params: table ? { table } : {} })
    return data
  }
  async createView(input: SavedViewInput & { name: string; tags: string[] }): Promise<SavedView> {
    const { data } = await this.http.post('/api/views', input)
    return data
  }
  async updateView(id: number | string, input: SavedViewInput): Promise<SavedView> {
    const { data } = await this.http.put(`/api/views/${id}`, input)
    return data
  }
  async deleteView(id: number | string): Promise<void> {
    await this.http.delete(`/api/views/${id}`)
  }

  // ---- Pipeline: Stage → Findings → Issues ----
  // Three tables, one vocabulary (see types.ts). Every level has list / get /
  // create / update (partial) / delete, and a promote that makes the next-level
  // row and links both ways.

  // ---- Issues (the axis table) ----
  async listIssues(q: IssueQuery = {}): Promise<Issue[]> {
    const params: Record<string, string> = {}
    if (q.tags?.length) params.tags = q.tags.join(',')
    if (q.match) params.match = q.match
    if (q.status) params.status = q.status
    if (q.severity) params.severity = q.severity
    if (q.search) params.search = q.search
    const { data } = await this.http.get('/api/issues', { params })
    return data
  }
  /** Distinct tags across all issues, for the tag picker when defining a view. */
  async issueTags(): Promise<string[]> {
    const { data } = await this.http.get('/api/issues/tags')
    return data
  }
  async getIssue(id: number | string): Promise<IssueDetail> {
    const { data } = await this.http.get(`/api/issues/${id}`)
    return data
  }
  async createIssue(input: IssueInput & { title: string }): Promise<Issue> {
    const { data } = await this.http.post('/api/issues', input)
    return data
  }
  async updateIssue(id: number | string, input: IssueInput): Promise<Issue> {
    const { data } = await this.http.put(`/api/issues/${id}`, input)
    return data
  }
  async deleteIssue(id: number | string): Promise<void> {
    await this.http.delete(`/api/issues/${id}`)
  }

  // ---- Findings (the middle level) ----
  async listFindings(q: FindingQuery = {}): Promise<Finding[]> {
    const params: Record<string, string> = {}
    if (q.tags?.length) params.tags = q.tags.join(',')
    if (q.match) params.match = q.match
    if (q.status) params.status = q.status
    if (q.severity) params.severity = q.severity
    if (q.category) params.category = q.category
    if (q.source) params.source = q.source
    if (q.target) params.target = q.target
    if (q.search) params.search = q.search
    const { data } = await this.http.get('/api/findings', { params })
    return data
  }
  async findingTags(): Promise<string[]> {
    const { data } = await this.http.get('/api/findings/tags')
    return data
  }
  async getFinding(id: number | string): Promise<FindingDetail> {
    const { data } = await this.http.get(`/api/findings/${id}`)
    return data
  }
  async createFinding(input: FindingInput & { title: string }): Promise<Finding> {
    const { data } = await this.http.post('/api/findings', input)
    return data
  }
  async updateFinding(id: number | string, input: FindingInput): Promise<Finding> {
    const { data } = await this.http.put(`/api/findings/${id}`, input)
    return data
  }
  async deleteFinding(id: number | string): Promise<void> {
    await this.http.delete(`/api/findings/${id}`)
  }
  /** The finding was validated: open an issue from it (overrides optional). */
  async promoteFinding(id: number | string, input: PromoteInput = {}): Promise<{ finding: Finding; issue: Issue }> {
    const { data } = await this.http.post(`/api/findings/${id}/promote`, input)
    return data
  }

  // ---- Stage (the pipeline inbox) ----
  async listStage(q: StageQuery = {}): Promise<StageItem[]> {
    const params: Record<string, string> = {}
    if (q.tags?.length) params.tags = q.tags.join(',')
    if (q.match) params.match = q.match
    if (q.disposition) params.disposition = q.disposition
    if (q.source) params.source = q.source
    if (q.search) params.search = q.search
    const { data } = await this.http.get('/api/stage', { params })
    return data
  }
  async stageTags(): Promise<string[]> {
    const { data } = await this.http.get('/api/stage/tags')
    return data
  }
  async getStage(id: number | string): Promise<StageDetail> {
    const { data } = await this.http.get(`/api/stage/${id}`)
    return data
  }
  async updateStage(id: number | string, input: StageInput): Promise<StageItem> {
    const { data } = await this.http.put(`/api/stage/${id}`, input)
    return data
  }
  async deleteStage(id: number | string): Promise<void> {
    await this.http.delete(`/api/stage/${id}`)
  }
  /**
   * Promote a staged row to the next level: `finding` (the usual next step) or
   * straight to `issue`. Returns the staged row (now `promoted`, linked) and
   * the row it became.
   */
  async promoteStage(
    id: number | string,
    to: 'finding' | 'issue',
    input: PromoteInput = {},
  ): Promise<{ stage: StageItem; finding?: Finding; issue?: Issue }> {
    const { data } = await this.http.post(`/api/stage/${id}/promote`, { ...input, to }, { params: { to } })
    return data
  }

  // ---- Activities (history + flow outcomes) ----
  // Every change to a pipeline row is an activity on it; a `run` is a
  // FloMorphic flow executed on the row, completed in the background.

  /**
   * The FloMorphic flows an operator can run a row through.
   *
   * `tags` is a match-ANY label filter applied by FloMorphic, not here: pass an
   * operation's labels to see only its flows, pass nothing for every flow. A
   * filter narrows what FloMorphic returns rather than the 200-row page the
   * API already truncated, so an operation's flows cannot fall off the end.
   */
  async listFlows(search = '', tags: string[] = []): Promise<FlowSummary[]> {
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (tags.length) params.tags = tags.join(',')
    const { data } = await this.http.get('/api/flows', { params })
    return data
  }

  /** The run picker's operation filter menu — installed operations and the
   *  labels each stamped on its flows. Derived from installed packages, so it
   *  answers even when FloMorphic itself is unreachable. */
  async listFlowTags(): Promise<FlowTagFacets> {
    const { data } = await this.http.get('/api/flows/tags')
    return data
  }

  /**
   * The input one flow asks for before it runs, resolved for a launch: the form
   * its designer declared, the context path the answers land at, and the values
   * the fields should start at.
   *
   * `entry: null` is the answer for a flow that asks for nothing — run it the
   * way it always ran. The resolve is FloMorphic's, not this app's, so the
   * dialog's fields start where an agent and the designer's own run button
   * start them.
   *
   * `subject` asks for `last` — what the previous run of this flow was given —
   * scoped to that row's own history first. Pass it when a dialog is launching
   * one row; the answer falls back to the flow's last run anywhere.
   */
  async getFlowEntry(id: string, subject?: { kind: string; id: number | string }): Promise<FlowEntryView> {
    const params: Record<string, string> = {}
    if (subject) {
      params.subjectKind = subject.kind
      params.subjectId = String(subject.id)
    }
    const { data } = await this.http.get(`/api/flows/${encodeURIComponent(id)}/entry`, { params })
    return data
  }
  async listActivities(q: ActivityQuery = {}): Promise<Activity[]> {
    const params: Record<string, string> = {}
    if (q.subjectKind) params.subjectKind = q.subjectKind
    if (q.subjectId != null) params.subjectId = String(q.subjectId)
    if (q.kind) params.kind = q.kind
    if (q.status) params.status = q.status
    if (q.flowId) params.flowId = q.flowId
    if (q.tags?.length) params.tags = q.tags.join(',')
    if (q.match) params.match = q.match
    if (q.search) params.search = q.search
    if (q.limit) params.limit = String(q.limit)
    const { data } = await this.http.get('/api/activities', { params })
    return data
  }
  async activityTags(): Promise<string[]> {
    const { data } = await this.http.get('/api/activities/tags')
    return data
  }
  async getActivity(id: number | string): Promise<ActivityDetail> {
    const { data } = await this.http.get(`/api/activities/${id}`)
    return data
  }
  /** Record a manual activity (a note, a conclusion of one's own) on a row. */
  async createActivity(input: ActivityInput & { subjectKind: string; subjectId: number | string }): Promise<Activity> {
    const { data } = await this.http.post('/api/activities', input)
    return data
  }
  async updateActivity(id: number | string, input: ActivityInput): Promise<Activity> {
    const { data } = await this.http.put(`/api/activities/${id}`, input)
    return data
  }
  async deleteActivity(id: number | string): Promise<void> {
    await this.http.delete(`/api/activities/${id}`)
  }
  /** Pull the run's current state from FloMorphic now. */
  async syncActivity(id: number | string): Promise<Activity> {
    const { data } = await this.http.post(`/api/activities/${id}/sync`)
    return data
  }
  /** Stop the run on the engine. */
  async stopActivity(id: number | string): Promise<Activity> {
    const { data } = await this.http.post(`/api/activities/${id}/stop`)
    return data
  }
  /** Send one or more rows through a flow; returns the started activities. */
  async runFlow(input: RunFlowInput): Promise<RunFlowResult> {
    const { data } = await this.http.post('/api/activities/run', input)
    return data
  }

  // ---- Operations (packaged flows that originate data) ----
  // A package is imported from a URL (the backend fetches the folder) or from
  // a bundle the browser read off a local folder; the backend keeps the
  // manifest + files, binds each manifest flow to a FloMorphic flow, computes
  // readiness against the live osctrl / plugin state, and starts entry runs.

  async listOperations(): Promise<Operation[]> {
    const { data } = await this.http.get('/api/operations')
    return data
  }
  async getOperation(id: number | string): Promise<OperationDetail> {
    const { data } = await this.http.get(`/api/operations/${id}`)
    return data
  }
  /** The plugins and node settings profiles an installed operation still needs
   *  bound in FloMorphic, with its bound flows read back. Its own call because
   *  it is several FloMorphic round trips. */
  async getOperationSettings(id: number | string): Promise<OperationSettingsPlan> {
    const { data } = await this.http.get(`/api/operations/${id}/settings`)
    return settingsPlan(data)
  }
  /** Resolve + validate a package without installing it (`dryRun`), or install it. */
  async previewOperation(input: OperationImportInput): Promise<OperationPreview> {
    const { data } = await this.http.post('/api/operations/import', { ...input, dryRun: true })
    return { ...data, settings: data.settings ? settingsPlan(data.settings) : undefined }
  }
  async importOperation(input: OperationImportInput): Promise<OperationDetail> {
    const { data } = await this.http.post('/api/operations/import', { ...input, dryRun: false })
    return data
  }
  /** Re-fetch the package from its source and re-install a newer version. */
  async updateOperation(id: number | string): Promise<OperationDetail> {
    const { data } = await this.http.post(`/api/operations/${id}/update`)
    return data
  }
  async saveOperationParams(id: number | string, params: Record<string, unknown>): Promise<OperationDetail> {
    const { data } = await this.http.put(`/api/operations/${id}/params`, { params })
    return data
  }
  async deleteOperation(id: number | string): Promise<void> {
    await this.http.delete(`/api/operations/${id}`)
  }
  /** Push one manifest flow (params substituted) into FloMorphic and bind the key to the created flow. */
  async installOperationFlow(id: number | string, flowKey: string): Promise<OperationDetail> {
    const { data } = await this.http.post(`/api/operations/${id}/flows/${encodeURIComponent(flowKey)}/install`)
    return data
  }
  /**
   * Stamp this operation's flow labels on the flows it is already bound to,
   * without re-pushing their graphs. Labels are applied at install time, so a
   * package installed before labels existed — or one whose `flowTags` changed
   * since — has bound flows the Run-flow picker's filter cannot see. Merges,
   * so a flow's own labels survive.
   */
  async relabelOperationFlows(id: number | string): Promise<{ labelled: number; labels: string[]; failed: Record<string, string> }> {
    const { data } = await this.http.post(`/api/operations/${id}/flows/relabel`)
    return data
  }
  /** Bind a manifest flow key to a flow that already exists in FloMorphic. */
  async linkOperationFlow(id: number | string, flowKey: string, flowId: string): Promise<OperationDetail> {
    const { data } = await this.http.put(`/api/operations/${id}/flows/${encodeURIComponent(flowKey)}`, { flowId })
    return data
  }
  /** The flow file as it would be installed — params substituted — for a manual import into FloMorphic. */
  async operationFlowFile(id: number | string, flowKey: string): Promise<string> {
    const { data } = await this.http.get(`/api/operations/${id}/flows/${encodeURIComponent(flowKey)}/file`, {
      responseType: 'text',
      transformResponse: (r) => r,
    })
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  }
  /** Start an entry flow of the operation; the run is an activity on the operation. */
  async runOperation(id: number | string, input: OperationRunInput): Promise<RunFlowResult> {
    const { data } = await this.http.post(`/api/operations/${id}/run`, input)
    return data
  }

  // ---- the export side: package flows built on the canvas ----

  /** A FloMorphic flow as its portable document (what a package file holds). */
  async exportFlow(flowId: string): Promise<Record<string, unknown>> {
    const { data } = await this.http.get(`/api/flows/${encodeURIComponent(flowId)}/export`)
    return data
  }
  /** Build a package from canvas flows: the bundle (preview), or install it bound to those flows. */
  async packOperation(input: PackInput): Promise<OperationBundle> {
    const { data } = await this.http.post('/api/operations/pack', input)
    return data
  }
  async packAndInstallOperation(input: PackInput): Promise<OperationDetail> {
    const { data } = await this.http.post('/api/operations/pack', { ...input, install: true })
    return data
  }
  /** The package as a zip (one top-level folder, the catalog layout). */
  async packOperationZip(input: PackInput): Promise<Blob> {
    const { data } = await this.http.post('/api/operations/pack', { ...input, format: 'zip' }, { responseType: 'blob' })
    return data
  }
  /** Download URL of an installed operation's package. */
  operationPackageUrl(id: number | string): string {
    return `${this.base}/api/operations/${id}/package.zip`
  }
  /** Replace the package's flow file with the bound flow as it is on the canvas now. */
  async pullOperationFlow(id: number | string, flowKey: string): Promise<OperationDetail> {
    const { data } = await this.http.post(`/api/operations/${id}/flows/${encodeURIComponent(flowKey)}/pull`)
    return data
  }
}

/** A settings plan whose lists are lists. An older backend marshals an empty
 *  slice as `null` — a plugin grouped from builtin nodes has no action names —
 *  and the plan is rendered straight, so a null there takes the view down. */
function settingsPlan(p: OperationSettingsPlan): OperationSettingsPlan {
  return {
    ...p,
    plugins: (p?.plugins ?? []).map((pl) => ({ ...pl, actions: pl.actions ?? [], missing: pl.missing ?? [] })),
    needs: (p?.needs ?? []).map((n) => ({ ...n, profiles: n.profiles ?? [] })),
  }
}

/** Pull a human message out of a backend error ({ "error": ... }) or axios error. */
export function apiErr(e: unknown): string {
  const err = e as AxiosError<{ error?: string }>
  if (err.response?.data?.error) return err.response.data.error
  if (err.message?.includes('Network')) return 'Cannot reach the Venapce backend — is venapce-api running?'
  return (e as Error).message ?? 'Request failed'
}
