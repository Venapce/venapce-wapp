<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { useOsctrlStore } from '@/stores/osctrl'
import { isOnline, relativeTime } from '@/lib/format'
import OsIcon from '@/components/OsIcon.vue'
import { sampleEnvironments, sampleNodeDetail, sampleNodes } from '@/lib/samples'
import type { OsctrlEnvironment, OsctrlNode, OsctrlNodeDetail } from '@/api/types'

// Enrolled systems (osquery nodes) for the selected osctrl environment.
const conn = useConnectionStore()
const osctrl = useOsctrlStore()

const environments = ref<OsctrlEnvironment[]>([])
const env = ref('')
const nodes = ref<OsctrlNode[]>([])
const search = ref('')
const loading = ref(true)
const error = ref('')
// True when the backend osctrl proxy isn't reachable yet and we're showing the
// built-in sample set so the UI is reviewable.
const sample = ref(false)

// ---- node-detail drawer ----
const selected = ref<OsctrlNode | null>(null)
const detail = ref<OsctrlNodeDetail | null>(null)
const detailLoading = ref(false)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return nodes.value
  return nodes.value.filter((n) =>
    [n.hostname, n.uuid, n.ip_address, n.platform, n.localname]
      .some((f) => (f ?? '').toLowerCase().includes(q)),
  )
})

const onlineCount = computed(() => nodes.value.filter((n) => isOnline(n.last_seen)).length)

// Ordered field list for the specification grid in the drawer.
const spec = computed<Array<{ label: string; value: string }>>(() => {
  const d = detail.value
  if (!d) return []
  const rows: Array<[string, unknown]> = [
    ['UUID', d.uuid],
    ['Hostname', d.hostname],
    ['Local name', d.localname],
    ['Username', d.username],
    ['IP address', d.ip_address],
    ['Platform', d.platform_version || d.platform],
    ['osquery', d.osquery_version],
    ['CPU', d.cpu],
    ['Memory', d.memory],
    ['Hardware serial', d.hardware_serial],
    ['Environment', d.environment],
    ['Enrolled', d.created_at ? new Date(d.created_at).toLocaleString() : ''],
    ['Last seen', d.last_seen ? relativeTime(d.last_seen) : ''],
    ['Last config', d.last_config ? relativeTime(d.last_config) : ''],
    ['Last status', d.last_status ? relativeTime(d.last_status) : ''],
    ['Last result', d.last_result ? relativeTime(d.last_result) : ''],
    ['Config hash', d.config_hash],
    ['Data received', d.bytes_received != null ? `${(d.bytes_received / 1_048_576).toFixed(1)} MB` : ''],
    ['Node key', d.node_key],
  ]
  return rows.filter(([, v]) => v != null && v !== '').map(([label, v]) => ({ label, value: String(v) }))
})

async function openNode(n: OsctrlNode) {
  selected.value = n
  detail.value = null
  detailLoading.value = true
  try {
    detail.value = await conn.client.osctrlNode(env.value, n.uuid)
  } catch {
    // Backend not wired yet — synthesise a rich record from the row.
    detail.value = sampleNodeDetail(n)
  } finally {
    detailLoading.value = false
  }
}

function closeDrawer() {
  selected.value = null
  detail.value = null
}

async function loadEnvironments() {
  try {
    environments.value = await conn.client.osctrlEnvironments()
    sample.value = false
  } catch {
    environments.value = sampleEnvironments
    sample.value = true
  }
  if (!env.value) {
    env.value = osctrl.environment || environments.value[0]?.name || ''
  }
}

async function loadNodes() {
  if (!env.value) {
    nodes.value = []
    return
  }
  closeDrawer()
  loading.value = true
  error.value = ''
  try {
    nodes.value = await conn.client.osctrlNodes(env.value)
    sample.value = false
  } catch {
    // Backend not wired yet — show sample rows for the chosen environment.
    nodes.value = sampleNodes.filter((n) => n.environment === env.value)
    if (nodes.value.length === 0) nodes.value = sampleNodes
    sample.value = true
  } finally {
    loading.value = false
  }
}

watch(env, loadNodes)

onMounted(async () => {
  if (!osctrl.loaded) await osctrl.loadSettings()
  await loadEnvironments()
  await loadNodes()
})
</script>

<template>
  <div class="p-6">
    <div class="mb-1 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">Nodes</h1>
      <span class="chip">{{ onlineCount }} online / {{ nodes.length }}</span>
      <div class="ml-auto flex items-center gap-2">
        <select v-model="env" class="field max-w-[12rem]">
          <option v-for="e in environments" :key="e.uuid" :value="e.name">{{ e.name }}</option>
        </select>
        <input
          v-model="search"
          class="field max-w-xs"
          placeholder="Search host, IP, UUID…"
        />
        <RouterLink :to="{ name: 'nodes-enroll' }" class="btn-outline whitespace-nowrap">Enroll →</RouterLink>
        <button class="btn-outline" @click="loadNodes">Refresh</button>
      </div>
    </div>
    <p class="mb-4 text-sm text-fg-muted">Enrolled systems reporting to osctrl. Select a row for full details.</p>

    <div v-if="sample" class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
      Showing sample data — connect osctrl in
      <RouterLink :to="{ name: 'settings' }" class="underline">Settings</RouterLink>
      (and the backend osctrl proxy) to see live nodes.
    </div>
    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>

    <div v-else-if="filtered.length === 0" class="card p-10 text-center text-sm text-fg-subtle">
      No nodes in this environment yet.
    </div>

    <div v-else class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-surface-2 text-left text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2">Host</th>
            <th class="px-4 py-2">Platform</th>
            <th class="px-4 py-2">IP</th>
            <th class="px-4 py-2">osquery</th>
            <th class="px-4 py-2">Last seen</th>
            <th class="px-4 py-2">UUID</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="n in filtered"
            :key="n.uuid"
            class="cursor-pointer border-t border-line hover:bg-bg"
            :class="selected?.uuid === n.uuid ? 'bg-accent-soft' : ''"
            @click="openNode(n)"
          >
            <td class="px-4 py-2">
              <span
                class="inline-flex items-center gap-1.5 text-xs font-medium"
                :class="isOnline(n.last_seen) ? 'text-success' : 'text-fg-subtle'"
              >
                <span class="h-2 w-2 rounded-full" :class="isOnline(n.last_seen) ? 'bg-success' : 'bg-fg-subtle'" />
                {{ isOnline(n.last_seen) ? 'online' : 'offline' }}
              </span>
            </td>
            <td class="px-4 py-2">
              <div class="font-medium text-fg">{{ n.hostname }}</div>
              <div v-if="n.localname && n.localname !== n.hostname" class="text-xs text-fg-subtle">{{ n.localname }}</div>
            </td>
            <td class="px-4 py-2 text-fg-muted">
              <span class="inline-flex items-center gap-1.5">
                <OsIcon :platform="n.platform" class="text-fg-subtle" />
                {{ n.platform_version || n.platform || '—' }}
              </span>
            </td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ n.ip_address || '—' }}</td>
            <td class="px-4 py-2 text-fg-muted">{{ n.osquery_version || '—' }}</td>
            <td class="px-4 py-2 text-fg-muted">{{ relativeTime(n.last_seen) }}</td>
            <td class="px-4 py-2 font-mono text-xs text-fg-subtle">{{ n.uuid }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Node-detail drawer -->
    <Transition name="drawer">
      <div v-if="selected" class="fixed inset-0 z-40 flex justify-end" @keydown.esc="closeDrawer">
        <div class="absolute inset-0 bg-black/30" @click="closeDrawer" />
        <aside class="relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-lg">
          <header class="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="isOnline(selected.last_seen) ? 'bg-success' : 'bg-fg-subtle'"
                />
                <OsIcon :platform="selected.platform" :size="18" class="text-fg-muted" />
                <h2 class="truncate text-base font-semibold text-fg">{{ selected.hostname }}</h2>
              </div>
              <p class="truncate font-mono text-xs text-fg-subtle">{{ selected.uuid }}</p>
            </div>
            <button class="btn-ghost -mr-2 px-2 py-1 text-lg leading-none" aria-label="Close" @click="closeDrawer">×</button>
          </header>

          <div class="flex-1 overflow-y-auto px-5 py-4">
            <p v-if="detailLoading" class="text-sm text-fg-subtle">Loading details…</p>

            <template v-else-if="detail">
              <div v-if="detail.tags?.length" class="mb-4 flex flex-wrap gap-1.5">
                <span v-for="t in detail.tags" :key="t" class="chip">{{ t }}</span>
              </div>

              <!-- Specification -->
              <h3 class="label">Specification</h3>
              <dl class="mb-5 divide-y divide-line rounded-md border border-line">
                <div v-for="row in spec" :key="row.label" class="flex gap-3 px-3 py-1.5 text-xs">
                  <dt class="w-28 shrink-0 text-fg-muted">{{ row.label }}</dt>
                  <dd class="min-w-0 flex-1 break-words font-mono text-fg">{{ row.value }}</dd>
                </div>
              </dl>
            </template>
          </div>
        </aside>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.15s ease;
}
.drawer-enter-active aside,
.drawer-leave-active aside {
  transition: transform 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from aside,
.drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
