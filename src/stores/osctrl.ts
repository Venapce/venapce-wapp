import { defineStore } from 'pinia'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import type { OsctrlSettingsView } from '@/api/types'

// The osctrl connection, configured in Settings exactly like Superset: the
// backend stores and encrypts the API credentials and proxies osctrl's /api/v1,
// so the JWT never reaches the browser. This store holds the connection status
// the Nodes area reads. It reuses the single VenapceClient from the connection
// store rather than making its own.
interface State {
  configured: boolean
  url: string
  username: string
  environment: string
  connected: boolean | null
  managed: boolean
  loaded: boolean
  error: string
}

export const useOsctrlStore = defineStore('osctrl', {
  state: (): State => ({
    configured: false,
    url: '',
    username: '',
    environment: '',
    connected: null,
    managed: false,
    loaded: false,
    error: '',
  }),

  actions: {
    client() {
      return useConnectionStore().client
    },

    async loadSettings() {
      this.error = ''
      try {
        this.applyView(await this.client().osctrlSettings())
      } catch (e) {
        this.error = apiErr(e)
      } finally {
        this.loaded = true
      }
    },

    async save(url: string, username: string, password: string, environment: string) {
      const view = await this.client().saveOsctrl({
        url,
        username,
        environment,
        password: password || undefined,
      })
      this.applyView(view)
      return view
    },

    async test() {
      const view = await this.client().testOsctrl()
      this.connected = view.connected ?? null
      return view
    },

    applyView(view: OsctrlSettingsView) {
      this.configured = !!view.configured
      this.url = view.url ?? ''
      this.username = view.username ?? ''
      this.environment = view.environment ?? ''
      this.managed = !!view.managed
      if (view.connected != null) this.connected = view.connected
    },
  },
})
