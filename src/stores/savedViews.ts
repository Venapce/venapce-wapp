import { defineStore } from 'pinia'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { readValue, writeValue } from '@/lib/localStore'
import type { SavedView, SavedViewInput, SavedViewTable } from '@/api/types'

// Saved views in the sidebar. A view is a named tag filter over one of the
// pipeline tables (stage / findings / issues / activities) — the mechanism that
// lets a user "add a submenu" without a new table: define tags (trusted,
// untrusted, proceed, …) and the table filters to them. Every one of those
// tables carries a `tags` column, and its list endpoint takes tags + match, so
// a view needs nothing else from the row.
//
// The backend owns them (/api/views), so a view follows the operator across
// browsers. Views made while they lived in localStorage are lifted into the
// backend the first time it answers.

const LEGACY_KEYS = ['savedViews', 'issueViews']

interface LegacyView {
  name?: string
  table?: SavedViewTable
  tags?: string[]
  match?: 'any' | 'all'
}

/** Views this browser saved before the backend stored them. */
function readLegacy(): LegacyView[] {
  return LEGACY_KEYS.flatMap((k) => readValue<LegacyView[]>(k, []))
}

function clearLegacy() {
  LEGACY_KEYS.forEach((k) => writeValue(k, []))
}

export const useSavedViewsStore = defineStore('savedViews', {
  state: (): { views: SavedView[]; loaded: boolean; error: string } => ({
    views: [],
    loaded: false,
    error: '',
  }),

  getters: {
    /** Views of one table, in the order they were created. */
    byTable: (state) => (table: SavedViewTable) => state.views.filter((v) => v.table === table),
  },

  actions: {
    async load(force = false) {
      if (this.loaded && !force) return
      this.error = ''
      try {
        this.views = await useConnectionStore().client.listViews()
        await this.migrateLegacy()
      } catch (e) {
        this.error = apiErr(e)
      } finally {
        this.loaded = true
      }
    },

    /**
     * Lift views saved in this browser into the backend, once. They keep their
     * name / table / tags and get a server id; anything that fails to move is
     * left in localStorage for the next attempt.
     */
    async migrateLegacy() {
      const legacy = readLegacy().filter((v) => v.name && v.tags?.length)
      if (!legacy.length) return
      const client = useConnectionStore().client
      for (const v of legacy) {
        // Skip one that clearly moved already (same name on the same table).
        if (this.views.some((x) => x.name === v.name && x.table === (v.table ?? 'issues'))) continue
        try {
          this.views.push(
            await client.createView({
              name: v.name!,
              table: v.table ?? 'issues',
              tags: v.tags!,
              match: v.match ?? 'any',
            }),
          )
        } catch {
          return // backend refused — keep the local copies and try again later
        }
      }
      clearLegacy()
    },

    /** The route hands view ids in as strings; compare them as such. */
    get(id: string | number): SavedView | undefined {
      return this.views.find((v) => String(v.id) === String(id))
    },

    async add(view: SavedViewInput & { name: string; tags: string[] }): Promise<SavedView> {
      const created = await useConnectionStore().client.createView(view)
      this.views.push(created)
      return created
    },

    async update(id: string | number, patch: SavedViewInput) {
      const updated = await useConnectionStore().client.updateView(id, patch)
      const i = this.views.findIndex((v) => String(v.id) === String(id))
      if (i >= 0) this.views[i] = updated
      return updated
    },

    async remove(id: string | number) {
      await useConnectionStore().client.deleteView(id)
      this.views = this.views.filter((v) => String(v.id) !== String(id))
    },
  },
})
