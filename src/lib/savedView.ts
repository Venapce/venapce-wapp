// Shared vocabulary of saved views: which tables can be viewed, how a view's
// tag filter is evaluated, and where a view opens. The four list views and the
// sidebar all read from here so a view means the same thing everywhere.
import type { SavedViewTable } from '@/api/types'

export const VIEW_TABLES: { key: SavedViewTable; label: string; icon: string; route: string; noun: string }[] = [
  { key: 'stage', label: 'Stage', icon: 'inbox', route: 'stage', noun: 'staged rows' },
  { key: 'findings', label: 'Findings', icon: 'target', route: 'findings', noun: 'findings' },
  { key: 'issues', label: 'Issues', icon: 'flag', route: 'issues', noun: 'issues' },
  { key: 'activities', label: 'Activities', icon: 'activity', route: 'activities', noun: 'activities' },
]

export function tableMeta(table: SavedViewTable) {
  return VIEW_TABLES.find((t) => t.key === table) ?? VIEW_TABLES[2]
}

/**
 * Does a row satisfy a tag filter? An empty filter matches everything, so a
 * list view can hand its own (possibly empty) tag selection straight in.
 */
export function tagsMatch(rowTags: string[] | undefined, tags: string[], match: 'any' | 'all' = 'any'): boolean {
  if (!tags.length) return true
  const has = (t: string) => !!rowTags?.includes(t)
  return match === 'all' ? tags.every(has) : tags.some(has)
}

/** Route location of a saved view. */
export function viewRoute(id: string | number) {
  return { name: 'saved-view', params: { viewId: String(id) } }
}
