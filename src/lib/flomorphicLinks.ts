import { useFlomorphicStore } from '@/stores/flomorphic'
import { readValue, writeValue } from '@/lib/localStore'

/**
 * Deep links into the FloMorphic panel.
 *
 * Every flow Venapce runs lives there, and an operator reading a run's outcome
 * here — above all one that came back with errors — needs the flow itself: the
 * canvas that shows which node the failing one is, the run list, the context
 * document the run read and wrote. So anywhere Venapce names a flow, a run or
 * a context, it is a link.
 *
 * The address is the panel's, not the API's: the browser reaches it directly,
 * often through a different host name than the backend uses. It comes from
 * Settings → FloMorphic (FLOMORPHIC_PANEL_URL, overridable at runtime). Until
 * someone sets it there, a per-browser value asked for once stands in, so the
 * links work before anyone has been to Settings.
 */

/** Per-browser fallback, kept from before the backend knew the panel address. */
const PANEL_KEY = 'flomorphicPanelUrl'

function trim(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/** The configured panel base, or '' when neither the backend nor this browser
 *  has one. */
export function panelBase(): string {
  const configured = trim(useFlomorphicStore().panelUrl ?? '')
  return configured || trim(readValue<string>(PANEL_KEY, ''))
}

/** Save a panel address for this browser only — what `askPanelBase` keeps. The
 *  backend's value, once set, always wins over it. */
export function setLocalPanelBase(url: string): void {
  writeValue(PANEL_KEY, trim(url))
}

/**
 * The panel base, asking for it once if nothing is known yet. Returns '' when
 * the operator declines, and the caller then does nothing — better than opening
 * a guessed address in a new tab.
 *
 * The guess offered is the API base on the panel's default port, which is right
 * for the standard compose and a plausible starting point anywhere else.
 */
export function askPanelBase(): string {
  const known = panelBase()
  if (known) return known
  const flo = useFlomorphicStore()
  const guess = flo.apiUrl ? trim(flo.apiUrl).replace(/:\d+$/, ':8027') : 'http://localhost:8027'
  const answer = window.prompt(
    'Where is the FloMorphic panel (its web address)? Asked once, kept in this browser — Settings → FloMorphic sets it for everyone.',
    guess,
  )
  if (!answer || !trim(answer)) return ''
  setLocalPanelBase(answer)
  return trim(answer)
}

/** The flow on the FloMorphic canvas — its nodes, its data, its wiring. */
export function flowUrl(flowId: string, base = panelBase()): string {
  if (!base || !flowId) return ''
  return `${base}/#/workflows/${encodeURIComponent(flowId)}`
}

/** The run list, where a process's own status, timings and error ledger live. */
export function processesUrl(base = panelBase()): string {
  return base ? `${base}/#/processes` : ''
}

/** The context document a run read its input from and wrote its output into. */
export function contextUrl(contextId: string, base = panelBase()): string {
  if (!base || !contextId) return ''
  return `${base}/#/contexts/${encodeURIComponent(contextId)}`
}

/** Open one of the above, asking for the panel address first if need be. Does
 *  nothing when the operator declines or the id is empty. */
export function openInFlomorphic(kind: 'flow' | 'processes' | 'context', id = ''): void {
  if (kind !== 'processes' && !id) return
  const base = askPanelBase()
  if (!base) return
  const url = kind === 'flow' ? flowUrl(id, base) : kind === 'context' ? contextUrl(id, base) : processesUrl(base)
  if (url) window.open(url, '_blank', 'noopener')
}
