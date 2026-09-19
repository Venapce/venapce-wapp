// Operations — the browser side of the package manager.
//
// An operation package is a folder: `operation.json` (the manifest, schema in
// public/schemas/venapce-operation.schema.json), one or more FloMorphic
// workflow exports it points at, and a README. This module reads such a folder
// from wherever the operator points — a GitHub tree URL, any static folder
// URL, a folder picked in the file dialog, or pasted text — into one
// {@link OperationBundle} the backend stores, and does the manifest checks
// that are worth doing before a byte reaches the server: shape validation,
// param substitution, and a first readiness pass against what the panel
// already knows (osctrl / plugin state), so the import dialog can show the
// operator what will and will not run before they confirm.

import type {
  OperationBundle,
  OperationFlowRole,
  OperationManifest,
  OperationParamSpec,
  OperationScale,
  OperationSource,
  ReadinessCheck,
} from '@/api/types'

export const MANIFEST_FILE = 'operation.json'
export const CATALOG_FILE = 'catalog.json'

export const SCALE_LABEL: Record<OperationScale, string> = {
  workstation: 'Workstations',
  smb: 'Small business',
  vps: 'A few servers',
  fleet: 'Fleet',
  enterprise: 'Enterprise',
  network: 'Network gear',
  cloud: 'Cloud',
}

export const ROLE_LABEL: Record<OperationFlowRole, string> = {
  entry: 'Entry — originates rows',
  'on-row': 'On a row',
  helper: 'Helper',
}
export const ROLE_ICON: Record<OperationFlowRole, string> = { entry: 'play', 'on-row': 'target', helper: 'workflow' }
export const ROLE_CLASS: Record<OperationFlowRole, string> = {
  entry: 'bg-accent-soft text-accent',
  'on-row': 'bg-surface-2 text-fg-muted',
  helper: 'bg-surface-2 text-fg-subtle',
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const ROLES: OperationFlowRole[] = ['entry', 'on-row', 'helper']
const PARAM_TYPES = ['string', 'number', 'boolean', 'string[]', 'json']

/**
 * Parse manifest text and report every problem at once (the dialog lists them
 * all rather than making the author fix one per round-trip). Returns the
 * manifest even when it has errors, so a preview can still show what it can.
 */
export function parseManifest(text: string): { manifest: OperationManifest | null; errors: string[] } {
  const errors: string[] = []
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { manifest: null, errors: [`operation.json is not valid JSON: ${(e as Error).message}`] }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { manifest: null, errors: ['operation.json must be a JSON object'] }
  const m = raw as OperationManifest

  if (m.schema !== 1) errors.push(`"schema" must be 1 (got ${JSON.stringify(m.schema)})`)
  if (typeof m.id !== 'string' || !SLUG.test(m.id)) errors.push('"id" must be a slug (lower-case letters, digits, dashes)')
  if (typeof m.name !== 'string' || !m.name.trim()) errors.push('"name" is required')
  if (typeof m.version !== 'string' || !SEMVER.test(m.version)) errors.push('"version" must be semver (1.2.3)')
  if (!Array.isArray(m.flows) || m.flows.length === 0) errors.push('"flows" must list at least one workflow')
  else {
    const keys = new Set<string>()
    m.flows.forEach((f, i) => {
      const at = `flows[${i}]`
      if (typeof f.key !== 'string' || !SLUG.test(f.key)) errors.push(`${at}.key must be a slug`)
      else if (keys.has(f.key)) errors.push(`${at}.key "${f.key}" is used twice`)
      else keys.add(f.key)
      if (typeof f.file !== 'string' || !f.file) errors.push(`${at}.file is required`)
      if (!ROLES.includes(f.role)) errors.push(`${at}.role must be one of ${ROLES.join(' | ')}`)
      if (f.role === 'on-row' && !f.subject?.length) errors.push(`${at} is on-row but names no subject (stage | finding | issue)`)
      if (f.step !== undefined && (!Number.isInteger(f.step) || f.step < 1)) errors.push(`${at}.step must be a positive integer`)
    })
  }
  if (m.readme !== undefined && (typeof m.readme !== 'string' || !m.readme.trim())) errors.push('"readme" must be a file path (or be omitted for README.md)')
  if (m.params && typeof m.params === 'object') {
    for (const [name, spec] of Object.entries(m.params)) {
      if (!spec || !PARAM_TYPES.includes(spec.type)) errors.push(`params.${name}.type must be one of ${PARAM_TYPES.join(' | ')}`)
    }
  }
  for (const p of m.requires?.plugins ?? []) {
    if (!p.name || !p.actions?.length) errors.push(`requires.plugins: every entry needs a name and at least one action`)
  }
  return { manifest: m, errors }
}

/** The flows an operator starts by hand (the Run buttons). */
export function entryFlows(m: OperationManifest) {
  return m.flows.filter((f) => f.role === 'entry')
}

/** The package's README path — required: it carries the mission and one section per flow. */
export function readmePath(m: OperationManifest): string {
  return m.readme || 'README.md'
}

/** Flows in mission order: numbered steps first (stable within a step), unnumbered after. */
export function flowsByStep<T extends { step?: number }>(flows: T[]): T[] {
  return [...flows].sort((a, b) => (a.step ?? Infinity) - (b.step ?? Infinity))
}

/** Every file path the manifest points at, relative to its folder. */
export function manifestFiles(m: OperationManifest): string[] {
  const out = new Set<string>()
  out.add(readmePath(m))
  m.flows.forEach((f) => {
    if (f.file) out.add(f.file)
    if (f.doc) out.add(f.doc)
  })
  m.provides?.dashboards?.forEach((d) => d.file && out.add(d.file))
  return [...out]
}

// ---- params ----------------------------------------------------------------

const PLACEHOLDER = /\$\{param\.([A-Za-z0-9_-]+)\}/g

/** The effective value of every param: operator value, else the default. */
export function effectiveParams(m: OperationManifest, values: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, spec] of Object.entries(m.params ?? {})) {
    out[name] = values[name] !== undefined && values[name] !== '' ? values[name] : spec.default
  }
  return out
}

/** Params that are required and have neither a value nor a default. */
export function missingParams(m: OperationManifest, values: Record<string, unknown> = {}): string[] {
  const eff = effectiveParams(m, values)
  return Object.entries(m.params ?? {})
    .filter(([name, spec]) => spec.required && (eff[name] === undefined || eff[name] === null || eff[name] === ''))
    .map(([name]) => name)
}

/**
 * Substitute `${param.x}` placeholders into a parsed flow document. A string
 * that IS a placeholder takes the param's own type (an array param becomes the
 * `tags` array); a placeholder inside a longer string is interpolated as text.
 * Unknown params are left as they are, so an author sees them in FloMorphic.
 */
export function substituteParams<T>(doc: T, params: Record<string, unknown>): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const whole = /^\$\{param\.([A-Za-z0-9_-]+)\}$/.exec(v)
      if (whole) return params[whole[1]!] !== undefined ? params[whole[1]!] : v
      return v.replace(PLACEHOLDER, (all, name: string) => {
        const p = params[name]
        if (p === undefined) return all
        return typeof p === 'string' ? p : JSON.stringify(p)
      })
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = walk(x)
      return o
    }
    return v
  }
  return walk(doc) as T
}

/** Coerce a form's text value into the param's declared type. */
export function coerceParam(spec: OperationParamSpec, raw: unknown): unknown {
  switch (spec.type) {
    case 'number': {
      const n = Number(raw)
      return raw === '' || raw == null || Number.isNaN(n) ? undefined : n
    }
    case 'boolean':
      return raw === true || raw === 'true'
    case 'string[]':
      if (Array.isArray(raw)) return raw
      return String(raw ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    case 'json':
      if (typeof raw !== 'string') return raw
      try {
        return raw.trim() ? JSON.parse(raw) : undefined
      } catch {
        return raw
      }
    default:
      return raw == null ? undefined : String(raw)
  }
}

// ---- sources -----------------------------------------------------------------

/** What a pasted URL turned out to be, and where its files are fetched from. */
export interface ResolvedUrl {
  source: OperationSource
  /** Base URL the package files are read from (ends with /). */
  rawBase: string
  /** When the URL is a repository root, the catalog to read first. */
  catalogAt?: string
}

/**
 * Turn the URL an operator pastes into a fetchable folder. Understood:
 *   https://github.com/org/repo                          → repo root (catalog or single package), branch guessed
 *   https://github.com/org/repo/tree/<ref>/<path>        → that folder
 *   https://github.com/org/repo/blob/<ref>/<path>/operation.json
 *   https://raw.githubusercontent.com/org/repo/<ref>/<path>/operation.json
 *   https://host/any/folder/  or  …/operation.json       → a static folder
 */
export function resolveUrl(input: string, ref = 'main'): ResolvedUrl | null {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    return null
  }
  const strip = (p: string) => p.replace(/\/+$/, '').replace(new RegExp(`/${MANIFEST_FILE}$`), '')

  if (u.hostname === 'github.com') {
    const seg = u.pathname.split('/').filter(Boolean)
    const [org, repo] = seg
    if (!org || !repo) return null
    let r = ref
    let path = ''
    if ((seg[2] === 'tree' || seg[2] === 'blob') && seg[3]) {
      r = seg[3]
      path = strip(seg.slice(4).join('/'))
    }
    const rawBase = `https://raw.githubusercontent.com/${org}/${repo}/${r}/${path ? path + '/' : ''}`
    return {
      source: { kind: 'url', url: `https://github.com/${org}/${repo}`, ref: r, path: path || undefined },
      rawBase,
      catalogAt: path ? undefined : rawBase + CATALOG_FILE,
    }
  }
  if (u.hostname === 'raw.githubusercontent.com') {
    const seg = u.pathname.split('/').filter(Boolean)
    const [org, repo, r] = seg
    if (!org || !repo || !r) return null
    const path = strip(seg.slice(3).join('/'))
    return {
      source: { kind: 'url', url: `https://github.com/${org}/${repo}`, ref: r, path: path || undefined },
      rawBase: `https://raw.githubusercontent.com/${org}/${repo}/${r}/${path ? path + '/' : ''}`,
    }
  }
  // Any other host: treat as a static folder.
  const folder = strip(u.pathname)
  const base = `${u.origin}${folder}/`
  return { source: { kind: 'url', url: base }, rawBase: base }
}

async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
  return res.text()
}

/** An entry of a catalog, as the URL importer lists them. */
export interface CatalogEntry {
  id: string
  path: string
  name?: string
  version?: string
  description?: string
  tags?: string[]
  scale?: string[]
}

/** Read the catalog at a repository root, if it ships one. */
export async function fetchCatalog(resolved: ResolvedUrl): Promise<{ name?: string; operations: CatalogEntry[] } | null> {
  if (!resolved.catalogAt) return null
  const text = await fetchText(resolved.catalogAt)
  if (!text) return null
  const cat = JSON.parse(text) as { name?: string; operations?: CatalogEntry[] }
  return { name: cat.name, operations: cat.operations ?? [] }
}

/**
 * Fetch a package folder into a bundle: the manifest, then every file it names.
 * A missing flow file is an error (the operation cannot install); a missing
 * README is not.
 */
export async function fetchBundle(rawBase: string): Promise<{ bundle: OperationBundle; errors: string[] }> {
  const text = await fetchText(rawBase + MANIFEST_FILE)
  if (!text) throw new Error(`No ${MANIFEST_FILE} at ${rawBase}`)
  const { manifest, errors } = parseManifest(text)
  if (!manifest) throw new Error(errors.join('; '))
  const files: Record<string, string> = {}
  await Promise.all(
    manifestFiles(manifest).map(async (path) => {
      const body = await fetchText(rawBase + path)
      if (body != null) files[path] = body
      else errors.push(missingFile(manifest, path))
    }),
  )
  return { bundle: { manifest, files }, errors }
}

/**
 * Read a folder picked with <input webkitdirectory> into a bundle. The manifest
 * is the shallowest operation.json in the selection; the other files are keyed
 * by their path relative to it. Only text files the manifest names are kept —
 * a PNG next to the README never leaves the browser.
 */
export async function readFolder(list: FileList | File[]): Promise<{ bundle: OperationBundle; errors: string[]; folder: string }> {
  const files = Array.from(list)
  const rel = (f: File) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/\\/g, '/')
  const manifests = files.filter((f) => f.name === MANIFEST_FILE).sort((a, b) => rel(a).split('/').length - rel(b).split('/').length)
  const mf = manifests[0]
  if (!mf) throw new Error(`The folder holds no ${MANIFEST_FILE}`)
  const dir = rel(mf).slice(0, -MANIFEST_FILE.length) // "pkg/" or ""
  const { manifest, errors } = parseManifest(await mf.text())
  if (!manifest) throw new Error(errors.join('; '))
  const byPath = new Map(files.map((f) => [rel(f), f]))
  const out: Record<string, string> = {}
  for (const path of manifestFiles(manifest)) {
    const f = byPath.get(dir + path)
    if (f) out[path] = await f.text()
    else errors.push(missingFile(manifest, path))
  }
  const folder = dir.replace(/\/$/, '').split('/').pop() || manifest.id
  return { bundle: { manifest, files: out }, errors, folder }
}

/** The error for a file the manifest names but the package lacks — the README gets the fuller sentence, since it is the one people forget. */
function missingFile(m: OperationManifest, path: string): string {
  if (path === readmePath(m))
    return `Missing "${path}": every package must ship a README that explains the mission and each flow's part in it`
  return `Missing file "${path}" named by the manifest`
}

/** Validate the flow files of a bundle: each must be a FloMorphic workflow export. */
export function checkFlowFiles(bundle: OperationBundle): string[] {
  const errors: string[] = []
  for (const f of bundle.manifest.flows) {
    const text = bundle.files[f.file]
    if (text == null) continue
    try {
      const doc = JSON.parse(text) as { nodes?: unknown; flomorphic?: { kind?: string } }
      if (!Array.isArray(doc.nodes)) errors.push(`${f.file}: not a FloMorphic workflow export (no "nodes")`)
      else if (doc.flomorphic && doc.flomorphic.kind !== 'workflow') errors.push(`${f.file}: flomorphic.kind is "${doc.flomorphic.kind}", expected "workflow"`)
    } catch (e) {
      errors.push(`${f.file}: invalid JSON (${(e as Error).message})`)
    }
  }
  return errors
}

/** The plugin actions the flow files actually call, per file — what the readiness
 *  check verifies even when the manifest forgot to declare a plugin. */
export function referencedActions(bundle: OperationBundle): Set<string> {
  const actions = new Set<string>()
  for (const f of bundle.manifest.flows) {
    const text = bundle.files[f.file]
    if (!text) continue
    try {
      const doc = JSON.parse(text) as { nodes?: { kind?: string; data?: { action?: string } }[] }
      for (const n of doc.nodes ?? []) if (n.kind === 'plugin' && n.data?.action) actions.add(n.data.action)
    } catch {
      /* reported by checkFlowFiles */
    }
  }
  return actions
}

// ---- readiness ---------------------------------------------------------------

/** What the panel knows locally, for the first readiness pass. */
export interface LocalState {
  osctrl: { configured: boolean; connected: boolean | null }
  flomorphic: { configured: boolean; pluginRunning: boolean }
  /** Keys of the operations already installed. */
  installed: string[]
}

/** Actions the venapce plugin itself provides — satisfied by the plugin being registered. */
export function isVenapceAction(action: string): boolean {
  return /^(db|osquery|osctrl)\./.test(action)
}

/**
 * Readiness computed in the browser from the stores. The backend recomputes
 * it against FloMorphic's live plugin table (which turns the `unknown` plugin
 * checks into ok / missing); this pass is what the import preview shows.
 */
export function localReadiness(
  manifest: OperationManifest,
  state: LocalState,
  params: Record<string, unknown> = {},
  bundle?: OperationBundle,
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = []
  const req = manifest.requires ?? {}

  if (req.osctrl?.required !== false && (req.osctrl || bundle === undefined || [...referencedActions(bundle)].some((a) => a.startsWith('osquery.')))) {
    const ok = state.osctrl.configured && state.osctrl.connected !== false
    checks.push({
      kind: 'osctrl',
      label: 'osctrl fleet manager',
      status: ok ? 'ok' : 'missing',
      detail: ok
        ? req.osctrl?.note || 'Connected'
        : state.osctrl.configured
          ? 'Configured but the last login failed — check Settings'
          : 'Not configured — run your own osctrl or create a managed space (Settings → FloMorphic)',
      fix: 'settings',
    })
    if (ok && req.osctrl?.minNodes) {
      checks.push({
        kind: 'osctrl',
        label: `At least ${req.osctrl.minNodes} enrolled node${req.osctrl.minNodes === 1 ? '' : 's'}`,
        status: 'unknown',
        detail: req.osctrl.targets?.length ? `Targets: ${req.osctrl.targets.join(', ')}` : undefined,
        fix: 'nodes',
      })
    }
  }

  // Plugins: the manifest's declared list, plus anything the flow files call
  // that the manifest did not declare.
  const declared = new Map<string, { name: string; actions: string[]; repo?: string }>()
  for (const p of req.plugins ?? []) declared.set(p.name, { name: p.name, actions: p.actions, repo: p.repo })
  const undeclared = new Set<string>()
  if (bundle) {
    const known = new Set([...declared.values()].flatMap((p) => p.actions))
    for (const a of referencedActions(bundle)) if (!known.has(a)) undeclared.add(a)
  }
  const venapceActions = [...declared.values()].flatMap((p) => p.actions).concat([...undeclared]).filter(isVenapceAction)
  const otherPlugins = [...declared.values()].filter((p) => !p.actions.every(isVenapceAction))
  const otherUndeclared = [...undeclared].filter((a) => !isVenapceAction(a))

  if (venapceActions.length || declared.has('venapce')) {
    const ok = state.flomorphic.configured && state.flomorphic.pluginRunning
    checks.push({
      kind: 'plugin',
      label: 'venapce plugin in FloMorphic',
      status: ok ? 'ok' : 'missing',
      detail: ok
        ? `Provides ${[...new Set(venapceActions)].sort().join(', ')}`
        : state.flomorphic.configured
          ? 'Registered but the in-process plugin is not running — restart it from Settings'
          : 'Register venapce as a FloMorphic plugin in Settings',
      fix: 'settings',
    })
  }
  for (const p of otherPlugins) {
    checks.push({
      kind: 'plugin',
      label: `${p.name} plugin`,
      status: 'unknown',
      detail: `Needs ${p.actions.join(', ')}${p.repo ? ` — install from ${p.repo}` : ''}`,
      href: p.repo,
    })
  }
  if (otherUndeclared.length) {
    checks.push({
      kind: 'plugin',
      label: 'Undeclared plugin actions',
      status: 'unknown',
      detail: `The flows call ${otherUndeclared.join(', ')} but the manifest does not say which plugin provides them`,
    })
  }

  for (const s of req.settings ?? []) {
    checks.push({
      kind: 'settings',
      label: `${s.kind} settings profile${s.for ? ` for ${s.for}` : ''}`,
      status: 'unknown',
      detail: s.note || 'Pick a Node Settings profile on the node after the flow is installed in FloMorphic',
    })
  }

  for (const dep of req.operations ?? []) {
    const key = dep.split('@')[0]!
    const ok = state.installed.includes(key)
    checks.push({
      kind: 'operation',
      label: `Operation "${dep}"`,
      status: ok ? 'ok' : 'missing',
      detail: ok ? 'Installed' : 'Install it first',
      fix: 'operations',
    })
  }

  for (const d of req.datasets ?? []) {
    checks.push({ kind: 'dataset', label: `Dataset "${d}"`, status: 'unknown', detail: 'Registered under Visualizations → Datasets', fix: 'datasets' })
  }

  for (const name of missingParams(manifest, params)) {
    checks.push({
      kind: 'param',
      label: `Parameter "${manifest.params?.[name]?.label || name}"`,
      status: 'missing',
      detail: 'Required, and it has no default — set it before installing',
    })
  }

  return checks
}

export function readinessSummary(checks: ReadinessCheck[]): { ok: number; missing: number; unknown: number; ready: boolean } {
  const ok = checks.filter((c) => c.status === 'ok').length
  const missing = checks.filter((c) => c.status === 'missing').length
  const unknown = checks.filter((c) => c.status === 'unknown').length
  return { ok, missing, unknown, ready: missing === 0 }
}

/** Human line for a 5-field cron, for the few shapes manifests actually use. */
export function describeCron(expr?: string): string {
  if (!expr) return ''
  const [min, hour, dom, mon, dow] = expr.trim().split(/\s+/)
  if (!min || !hour) return expr
  const every = (f: string) => /^\*\/(\d+)$/.exec(f)?.[1]
  if (hour === '*' && every(min)) return `every ${every(min)} min`
  if (dom === '*' && mon === '*' && dow === '*' && every(hour) && min === '0') return `every ${every(hour)} h`
  if (dom === '*' && mon === '*' && dow === '*' && /^\d+$/.test(hour) && /^\d+$/.test(min)) return `daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`
  if (dom === '*' && mon === '*' && dow && dow !== '*' && /^\d+$/.test(hour)) return `weekly (${dow}) at ${hour.padStart(2, '0')}:${(min ?? '0').padStart(2, '0')} UTC`
  return expr
}

/** Route location for an operation's detail page. */
export function operationRoute(id: number | string) {
  return { name: 'operation-detail', params: { id: String(id) } }
}
