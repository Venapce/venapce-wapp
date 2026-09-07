import { defineStore } from 'pinia'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { APP_VERSION } from '@/lib/version'

// The running Venapce version, shown in the top bar and in Settings.
//
// The panel's version is baked into the bundle at build time; the backend
// reports its own over /api/version. Both are stamped from the same release
// VERSION (`make release VERSION=v0.1.1`), so when they differ the browser is
// usually holding a stale bundle from an earlier image.
export const useVersionStore = defineStore('version', {
  state: () => ({
    panel: APP_VERSION,
    api: '',
    error: '',
    loaded: false,
  }),

  getters: {
    /** The panel and the API came from different builds. */
    mismatch: (s): boolean => s.loaded && s.api !== '' && s.api !== s.panel,
    /** Tooltip text — one line per side, so the badge itself stays short. */
    detail(s): string {
      const api = s.api || (s.loaded ? 'unreachable' : 'loading…')
      return `Venapce panel ${s.panel}\nvenapce-api ${api}`
    },
  },

  actions: {
    /** Ask the backend for its version. Once per session; failure is not fatal. */
    async load() {
      if (this.loaded) return
      const conn = useConnectionStore()
      try {
        this.api = await conn.client.apiVersion()
      } catch (e) {
        this.error = apiErr(e)
      } finally {
        this.loaded = true
      }
    },
  },
})
