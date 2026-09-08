<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useOsctrlStore } from '@/stores/osctrl'
import { useFlomorphicStore } from '@/stores/flomorphic'
import SupersetSettingsCard from '@/components/settings/SupersetSettingsCard.vue'
import DemoDataCard from '@/components/settings/DemoDataCard.vue'
import FlomorphicSettingsCard from '@/components/settings/FlomorphicSettingsCard.vue'
import OsctrlSettingsCard from '@/components/settings/OsctrlSettingsCard.vue'

const conn = useConnectionStore()
const osctrl = useOsctrlStore()
const flo = useFlomorphicStore()
const route = useRoute()
const isSetup = route.query.setup === '1'

onMounted(() => {
  if (!osctrl.loaded) osctrl.loadSettings()
  if (!flo.loaded) flo.loadSettings()
})
</script>

<template>
  <div class="mx-auto max-w-2xl p-6">
    <h1 class="mb-1 text-lg font-semibold text-fg">Settings</h1>
    <p class="mb-6 text-sm text-fg-muted">Connections and configuration for this Venapce instance.</p>

    <div
      v-if="isSetup && !conn.configured"
      class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning"
    >
      Superset isn't configured yet. Fill in the connection below to start building dashboards.
    </div>

    <div class="space-y-5">
      <!-- Data source -->
      <SupersetSettingsCard />

      <!-- Optional example datasets for a demo -->
      <DemoDataCard />

      <!-- Connect FloMorphic (the venapce plugin) → turnkey osctrl space -->
      <FlomorphicSettingsCard />

      <!-- Fleet manager behind the Nodes area -->
      <OsctrlSettingsCard />

      <!-- Advanced: add external database connections (ClickHouse, Postgres, …). -->
      <section class="rounded-lg border border-line bg-surface p-5">
        <h2 class="mb-1 text-sm font-semibold text-fg">Database connections (advanced)</h2>
        <p class="mb-4 text-sm text-fg-muted">
          New external databases — ClickHouse, Postgres, MySQL and others — are added directly in
          Superset, which manages the driver and encrypted credentials. Once a connection exists there,
          register tables from it as datasets under
          <RouterLink :to="{ name: 'datasets' }" class="text-accent hover:underline">Visualizations → Datasets</RouterLink>.
        </p>
        <a
          v-if="conn.supersetUrl"
          :href="`${conn.supersetUrl.replace(/\/+$/, '')}/databaseview/list/`"
          target="_blank"
          rel="noopener"
          class="btn inline-flex items-center gap-1.5"
        >
          Manage database connections in Superset ↗
        </a>
        <p v-else class="text-sm text-fg-subtle">Configure the Superset connection above first.</p>
      </section>

      <!-- Placeholder for future configuration cards (users, spaces, theme, …). -->
      <section class="rounded-lg border border-dashed border-line p-6 text-center text-xs text-fg-subtle">
        More settings will live here as Venapce grows.
      </section>
    </div>
  </div>
</template>
