import axios, { AxiosError, type AxiosInstance } from 'axios'
import type {
  ChartDataResult,
  DashboardSummary,
  DatasetDetail,
  DatasetSummary,
  QueryContext,
  SupersetDatabase,
} from './types'

/**
 * Minimal Superset REST client for a *headless* front (no iframe).
 *
 * Auth flow (see SUPERSET-INTEGRATION-STUDY.md §1):
 *   1. POST /security/login   -> access_token (+ refresh_token)
 *   2. GET  /security/csrf_token/ (Bearer) -> csrf token for mutating calls
 *   3. every call: Authorization: Bearer <token>  (+ X-CSRFToken on writes)
 *
 * `withCredentials` is on so the CSRF session cookie rides along when the
 * server enforces CSRF. If you exempt the API from CSRF (simplest for a
 * headless client — see README), Bearer alone is enough.
 */
export class SupersetClient {
  readonly baseUrl: string
  private http: AxiosInstance
  accessToken = ''
  refreshToken = ''
  csrfToken = ''
  private refreshing: Promise<void> | null = null

  constructor(baseUrl: string, tokens?: { accessToken?: string; refreshToken?: string; csrfToken?: string }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.accessToken = tokens?.accessToken ?? ''
    this.refreshToken = tokens?.refreshToken ?? ''
    this.csrfToken = tokens?.csrfToken ?? ''

    this.http = axios.create({ baseURL: `${this.baseUrl}/api/v1`, withCredentials: true })

    this.http.interceptors.request.use((cfg) => {
      if (this.accessToken) cfg.headers.set('Authorization', `Bearer ${this.accessToken}`)
      const method = (cfg.method ?? 'get').toLowerCase()
      if (this.csrfToken && !['get', 'head', 'options'].includes(method)) {
        cfg.headers.set('X-CSRFToken', this.csrfToken)
      }
      return cfg
    })

    // Transparent single-shot refresh on 401.
    this.http.interceptors.response.use(
      (r) => r,
      async (error: AxiosError) => {
        const original = error.config
        const status = error.response?.status
        if (status === 401 && this.refreshToken && original && !(original as any)._retried) {
          ;(original as any)._retried = true
          await this.ensureRefreshed()
          return this.http.request(original)
        }
        throw error
      },
    )
  }

  // ---- auth ----

  async login(username: string, password: string): Promise<void> {
    const { data } = await this.http.post('/security/login', {
      username,
      password,
      provider: 'db',
      refresh: true,
    })
    this.accessToken = data.access_token
    this.refreshToken = data.refresh_token
    await this.fetchCsrf()
  }

  async fetchCsrf(): Promise<void> {
    // Non-fatal: if CSRF is disabled/exempted on the server, this may 404/401.
    try {
      const { data } = await this.http.get('/security/csrf_token/')
      this.csrfToken = data.result
    } catch {
      this.csrfToken = ''
    }
  }

  private ensureRefreshed(): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = this.http
        .post('/security/refresh', {}, { headers: { Authorization: `Bearer ${this.refreshToken}` } })
        .then(({ data }) => {
          this.accessToken = data.access_token
        })
        .finally(() => {
          this.refreshing = null
        })
    }
    return this.refreshing
  }

  /** Cheap authenticated call to confirm the token still works. */
  async me(): Promise<{ username?: string; first_name?: string; last_name?: string }> {
    const { data } = await this.http.get('/me/')
    return data.result ?? data
  }

  // ---- catalog ----

  async databases(): Promise<SupersetDatabase[]> {
    const { data } = await this.http.get('/database/', { params: { q: rison({ page_size: 200 }) } })
    return data.result
  }

  async datasets(search = ''): Promise<DatasetSummary[]> {
    const q: RisonQuery = { page_size: 200, order_column: 'changed_on_delta_humanized', order_direction: 'desc' }
    if (search) q.filters = [{ col: 'table_name', opr: 'ct', value: search }]
    const { data } = await this.http.get('/dataset/', { params: { q: rison(q) } })
    return data.result
  }

  async dataset(id: number): Promise<DatasetDetail> {
    const { data } = await this.http.get(`/dataset/${id}`)
    return { id, ...data.result }
  }

  async dashboards(): Promise<DashboardSummary[]> {
    const { data } = await this.http.get('/dashboard/', {
      params: { q: rison({ page_size: 100, order_column: 'changed_on', order_direction: 'desc' }) },
    })
    return data.result
  }

  // ---- the crux: fetch computed data for native rendering ----

  async chartData(ctx: QueryContext): Promise<ChartDataResult> {
    const { data } = await this.http.post('/chart/data', ctx)
    const first = data.result?.[0]
    if (!first) throw new Error('Superset returned no result payload')
    if (first.error) throw new Error(first.error)
    return first
  }
}

// ---- tiny Rison encoder for Superset's `q=` list params ----
// Superset list endpoints accept Rison-encoded query objects. We only need a
// small subset (page_size, order, simple filters), so this hand-rolled encoder
// avoids pulling in the rison package.

interface RisonFilter {
  col: string
  opr: string
  value: string | number
}
interface RisonQuery {
  page?: number
  page_size?: number
  order_column?: string
  order_direction?: 'asc' | 'desc'
  filters?: RisonFilter[]
}

function rison(q: RisonQuery): string {
  const parts: string[] = []
  if (q.page != null) parts.push(`page:${q.page}`)
  if (q.page_size != null) parts.push(`page_size:${q.page_size}`)
  if (q.order_column) parts.push(`order_column:${q.order_column}`)
  if (q.order_direction) parts.push(`order_direction:${q.order_direction}`)
  if (q.filters?.length) {
    const fs = q.filters
      .map((f) => `(col:${f.col},opr:${f.opr},value:${risonScalar(f.value)})`)
      .join(',')
    parts.push(`filters:!(${fs})`)
  }
  return `(${parts.join(',')})`
}

function risonScalar(v: string | number): string {
  if (typeof v === 'number') return String(v)
  // Rison strings with no special chars can be bare; quote to be safe.
  return `'${String(v).replace(/'/g, "!'")}'`
}
