import { acceptHMRUpdate, defineStore } from 'pinia'
import { useConnectionStore } from '@/stores/connection'
import { useOsctrlStore } from '@/stores/osctrl'
import { apiErr } from '@/api/venapce'
import type {
  FlomorphicConnectResult,
  FlomorphicSettingsView,
  OsspaceResult,
  PluginProbe,
  PluginStatus,
} from '@/api/types'

// The FloMorphic plugin registration. Venapce runs as a FloMorphic plugin; the
// backend drives the whole lifecycle against the FloMorphic API (configured via
// FLOMORPHIC_URL + FLOMORPHIC_JWT_SECRET): it registers the extension row, mints
// its credential, connects the in-process plugin, and syncs its actions into
// palette nodes. Connectivity is reported as FloMorphic sees it (the probe).
// Reuses the single VenapceClient from the connection store.
interface State {
  configured: boolean
  extensionId: string
  pluginId: string
  infraBase: string
  osctrlManaged: boolean
  /** FloMorphic API access from the backend env. */
  apiConfigured: boolean
  apiUrl: string
  jwtSecretSet: boolean
  /** Local status of the in-process plugin (null until known). */
  plugin: PluginStatus | null
  /** Plugin connectivity as FloMorphic sees it (null until checked). */
  probe: PluginProbe | null
  /** Palette nodes written by the last sync (null until a sync ran). */
  nodes: number | null
  loaded: boolean
  error: string
}

export const useFlomorphicStore = defineStore('flomorphic', {
  state: (): State => ({
    configured: false,
    extensionId: '',
    pluginId: '',
    infraBase: '',
    osctrlManaged: false,
    apiConfigured: false,
    apiUrl: '',
    jwtSecretSet: false,
    plugin: null,
    probe: null,
    nodes: null,
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

    /**
     * Register venapce in FloMorphic (create row + mint cred + connect + sync) so
     * its nodes appear in the canvas palette. Reuses the stored row on repeat
     * calls; the response carries the synced node count and probe.
     */
    async connect() {
      const res = await this.client().connectFlomorphic()
      this.applyConnect(res)
      // Re-read the full settings view for the fields the connect response omits.
      await this.loadSettings()
      return res
    },

    /** Redefine venapce: delete the extension row + its nodes, then re-register. */
    async refresh() {
      const res = await this.client().refreshFlomorphic()
      this.applyConnect(res)
      await this.loadSettings()
      return res
    },

    /** Probe connectivity as FloMorphic sees it (live @actions round-trip). */
    async check(): Promise<PluginProbe | null> {
      const res = await this.client().checkFlomorphicPlugin()
      this.probe = res.probe ?? null
      this.plugin = res.plugin ?? this.plugin
      return this.probe
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

    applyConnect(res: FlomorphicConnectResult) {
      this.configured = !!res.configured
      if (res.extensionId !== undefined) this.extensionId = res.extensionId
      if (res.pluginId !== undefined) this.pluginId = res.pluginId
      if (res.plugin !== undefined) this.plugin = res.plugin
      this.probe = res.probe ?? this.probe
      this.nodes = res.nodes ?? this.nodes
    },

    applyView(view: FlomorphicSettingsView) {
      this.configured = !!view.configured
      this.extensionId = view.extensionId ?? ''
      this.pluginId = view.pluginId ?? ''
      this.infraBase = view.infraBase ?? ''
      this.osctrlManaged = !!view.osctrlManaged
      this.apiConfigured = !!view.apiConfigured
      this.apiUrl = view.apiUrl ?? ''
      this.jwtSecretSet = !!view.jwtSecretSet
      this.plugin = view.plugin ?? null
    },
  },
})

// Hot-swap this store cleanly on edit, so a dev-time change to its actions does
// not leave the previous instance live (which shows up as "x is not a function").
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFlomorphicStore, import.meta.hot))
}
