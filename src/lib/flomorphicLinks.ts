import { useFlomorphicStore } from '@/stores/flomorphic'

/**
 * Deep links into the FloMorphic web app.
 *
 * Every flow Venapce runs lives there, and an operator reading a run's outcome
 * here — above all one that came back with errors — needs the flow itself: the
 * canvas that shows which node the failing one is, the run list, the context
 * document the run read and wrote, the settings profile a provider node has to
 * be bound to. So anywhere Venapce names a flow, a run, a context or a profile,
 * it is a link.
 *
 * The address is the web app's, not the API's, and the two are never the same
 * here: everything runs in containers, so the backend reaches FloMorphic by its
 * container name on the compose network while the browser reaches the port the
 * FloMorphic compose publishes on the Docker host. Neither can be derived from
 * the other, so the address is its own setting — Settings → FloMorphic web app
 * (FLOMORPHIC_PANEL_URL), which defaults to the standard compose's published
 * port so these links work on a fresh local install before anyone visits
 * Settings.
 */

/** Where the FloMorphic web app answers for a stock single-host Docker install:
 *  the port its compose publishes (its canvas on 8088). Only a starting point —
 *  a browser that is not on the Docker host reaches it elsewhere, and the
 *  Settings card is where that is said. Kept in step with the backend's
 *  config.DefaultFlomorphicPanelURL. */
export const DEFAULT_PANEL_URL = 'http://localhost:8088'

/** Strip trailing slashes so one base never yields `//#/…`. */
export function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/**
 * The web app base every link below is built from: what Settings holds, falling
 * back to the stock local address.
 *
 * It never returns '' once settings have loaded, which is the point of having a
 * default — a link that cannot be built is a dead end on a page whose whole
 * subject was produced over there.
 */
export function panelBase(): string {
  return trimBase(useFlomorphicStore().panelUrl ?? '') || DEFAULT_PANEL_URL
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

/**
 * Node Settings — where FloMorphic's settings profiles are created and edited.
 *
 * Installing a flow can carry no profile id (a profile is an address on one
 * FloMorphic), so every install leaves its provider nodes unbound; this is the
 * page that fixes that, and the one Venapce sends an operator to when it says a
 * node needs a profile.
 */
export function settingsProfileUrl(base = panelBase()): string {
  return base ? `${base}/#/node-settings` : ''
}

/** FloMorphic's own Settings screen. */
export function settingsUrl(base = panelBase()): string {
  return base ? `${base}/#/settings` : ''
}

/** The web app's front door, for "open FloMorphic" with nothing more specific. */
export function homeUrl(base = panelBase()): string {
  return base ? `${base}/#/workflows` : ''
}

/** What `openInFlomorphic` and `<FlomorphicLink>` can point at. */
export type FlomorphicTarget = 'flow' | 'processes' | 'context' | 'settings-profile' | 'settings' | 'home'

/** Targets that mean nothing without an id, so a link to them is suppressed
 *  rather than pointed at a list. */
const NEEDS_ID: ReadonlySet<FlomorphicTarget> = new Set<FlomorphicTarget>(['flow', 'context'])

export function needsId(kind: FlomorphicTarget): boolean {
  return NEEDS_ID.has(kind)
}

/** The URL for one target, or '' when it needs an id and has none. */
export function flomorphicUrl(kind: FlomorphicTarget, id = '', base = panelBase()): string {
  if (!base) return ''
  switch (kind) {
    case 'flow':
      return flowUrl(id, base)
    case 'context':
      return contextUrl(id, base)
    case 'processes':
      return processesUrl(base)
    case 'settings-profile':
      return settingsProfileUrl(base)
    case 'settings':
      return settingsUrl(base)
    case 'home':
      return homeUrl(base)
  }
}

/** Open one of the above in a new tab. Does nothing when the target needs an id
 *  and has none. */
export function openInFlomorphic(kind: FlomorphicTarget, id = ''): void {
  const url = flomorphicUrl(kind, id)
  if (url) window.open(url, '_blank', 'noopener')
}
