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
  Issue,
  IssueQuery,
  OsctrlEnrollValues,
  OsctrlEnvironment,
  OsctrlNode,
  OsctrlSettingsView,
  QueryContext,
  StageItem,
  StageQuery,
  SupersetDatabase,
  SupersetSettingsView,
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

  // ---- osctrl proxy (backend holds the JWT; browser never sees it) ----
  async osctrlEnvironments(): Promise<OsctrlEnvironment[]> {
    const { data } = await this.http.get('/api/osctrl/environments')
    return data
  }
  async osctrlNodes(env: string, search = ''): Promise<OsctrlNode[]> {
    const { data } = await this.http.get('/api/osctrl/nodes', {
      params: { env, ...(search ? { search } : {}) },
    })
    return data
  }
  async osctrlEnroll(env: string, target = 'osquery'): Promise<OsctrlEnrollValues> {
    const { data } = await this.http.get('/api/osctrl/enroll', { params: { env, target } })
    return data
  }

  // ---- Issues (the axis table) ----
  async listIssues(q: IssueQuery = {}): Promise<Issue[]> {
    const params: Record<string, string> = {}
    if (q.tags?.length) params.tags = q.tags.join(',')
    if (q.match) params.match = q.match
    if (q.status) params.status = q.status
    if (q.search) params.search = q.search
    const { data } = await this.http.get('/api/issues', { params })
    return data
  }
  /** Distinct tags across all issues, for the tag picker when defining a view. */
  async issueTags(): Promise<string[]> {
    const { data } = await this.http.get('/api/issues/tags')
    return data
  }

  // ---- Stage (the pipeline inbox ahead of Issues) ----
  async listStage(q: StageQuery = {}): Promise<StageItem[]> {
    const params: Record<string, string> = {}
    if (q.disposition) params.disposition = q.disposition
    if (q.source) params.source = q.source
    if (q.search) params.search = q.search
    const { data } = await this.http.get('/api/stage', { params })
    return data
  }
}

/** Pull a human message out of a backend error ({ "error": ... }) or axios error. */
export function apiErr(e: unknown): string {
  const err = e as AxiosError<{ error?: string }>
  if (err.response?.data?.error) return err.response.data.error
  if (err.message?.includes('Network')) return 'Cannot reach the Venapce backend — is venapce-api running?'
  return (e as Error).message ?? 'Request failed'
}
