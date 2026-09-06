import { defineStore } from 'pinia'
import { useConnectionStore } from '@/stores/connection'
import { useOsctrlStore } from '@/stores/osctrl'
import { apiErr } from '@/api/venapce'
import type { FlomorphicSettingsView, OsspaceResult } from '@/api/types'

// The FloMorphic plugin registration. Venapce runs as a FloMorphic plugin; the
// operator pastes the plugin env from the FloMorphic panel here, and the backend
// uses it to broker a managed osctrl space via infra's osspace flow. Reuses the
// single VenapceClient from the connection store.
interface State {
  configured: boolean
  pluginId: string
  infraBase: string
  osctrlManaged: boolean
  loaded: boolean
  error: string
}

export const useFlomorphicStore = defineStore('flomorphic', {
  state: (): State => ({
    configured: false,
    pluginId: '',
    infraBase: '',
    osctrlManaged: false,
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
        this.applyView(await this.client().flomorphicSettings())
      } catch (e) {
        this.error = apiErr(e)
      } finally {
        this.loaded = true
      }
    },

    /** Register the venapce plugin from its pasted plugin env. */
    async save(env: string) {
      const view = await this.client().saveFlomorphic({ env })
      this.applyView(view)
      return view
    },

    /** One osspace call; wire the refreshed osctrl connection through on connect. */
    async connectOsspace(): Promise<OsspaceResult> {
      const res = await this.client().connectOsspace()
      if (res.status === 'connected') {
        this.osctrlManaged = true
        // Pull the freshly-wired managed osctrl connection into its store.
        await useOsctrlStore().loadSettings()
      }
      return res
    },

    applyView(view: FlomorphicSettingsView) {
      this.configured = !!view.configured
      this.pluginId = view.pluginId ?? ''
      this.infraBase = view.infraBase ?? ''
      this.osctrlManaged = !!view.osctrlManaged
    },
  },
})
