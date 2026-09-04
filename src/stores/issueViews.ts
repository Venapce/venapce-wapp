import { defineStore } from 'pinia'
import { readValue, writeValue } from '@/lib/localStore'
import type { IssueView } from '@/api/types'

// Saved sub-views under the Issues menu. A view is just a named tag filter — the
// mechanism that lets a user "add a submenu" without a new table: define tags
// (trusted, untrusted, proceed, …) and the Issues table filters to them.
//
// Front-first: these live in localStorage for now. When the backend grows an
// /api/issue-views resource, swap the read/write here for client calls — the
// IssueView shape and the views' consumers stay the same.
// TODO(backend): persist views server-side so they're shared across browsers.

const STORAGE_KEY = 'issueViews'

function uid(): string {
  return 'v_' + Math.random().toString(36).slice(2, 9)
}

export const useIssueViewsStore = defineStore('issueViews', {
  state: (): { views: IssueView[]; loaded: boolean } => ({
    views: [],
    loaded: false,
  }),

  actions: {
    load() {
      if (this.loaded) return
      this.views = readValue<IssueView[]>(STORAGE_KEY, [])
      this.loaded = true
    },

    persist() {
      writeValue(STORAGE_KEY, this.views)
    },

    get(id: string): IssueView | undefined {
      return this.views.find((v) => v.id === id)
    },

    add(view: Omit<IssueView, 'id'>): IssueView {
      const created: IssueView = { id: uid(), ...view }
      this.views.push(created)
      this.persist()
      return created
    },

    update(id: string, patch: Partial<Omit<IssueView, 'id'>>) {
      const v = this.get(id)
      if (!v) return
      Object.assign(v, patch)
      this.persist()
    },

    remove(id: string) {
      this.views = this.views.filter((v) => v.id !== id)
      this.persist()
    },
  },
})
