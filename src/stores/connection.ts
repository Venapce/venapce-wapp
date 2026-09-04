import { defineStore } from 'pinia'
import { VenapceClient, apiErr } from '@/api/venapce'
import type { SupersetSettingsView } from '@/api/types'

// The app now talks only to the Venapce backend. This store holds the single
// VenapceClient and the Superset connection status the backend reports (the old
// in-browser Superset login is gone — Superset is configured in Settings).
interface State {
  client: VenapceClient
  configured: boolean
  supersetUrl: string
  username: string
  connected: boolean | null
  loaded: boolean
  error: string
}

export const useConnectionStore = defineStore('connection', {
  state: (): State => ({
    client: new VenapceClient(),
    configured: false,
    supersetUrl: '',
    username: '',
    connected: null,
    loaded: false,
    error: '',
  }),

  actions: {
    /** Load Superset connection status from the backend (once at startup). */
    async loadSettings() {
      this.error = ''
      try {
        this.applyView(await this.client.supersetSettings())
      } catch (e) {
        this.error = apiErr(e)
      } finally {
        this.loaded = true
      }
    },

    /** Save the Superset connection; the backend encrypts the password and probes login. */
    async saveSuperset(url: string, username: string, password: string) {
      const view = await this.client.saveSuperset({ url, username, password: password || undefined })
      this.applyView(view)
      return view
    },

    /** Re-probe the stored connection. */
    async test() {
      const view = await this.client.testSuperset()
      this.connected = view.connected ?? null
      return view
    },

    applyView(view: SupersetSettingsView) {
      this.configured = !!view.configured
      this.supersetUrl = view.url ?? ''
      this.username = view.username ?? ''
      if (view.connected != null) this.connected = view.connected
    },
  },
})
