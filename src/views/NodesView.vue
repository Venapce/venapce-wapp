<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { useOsctrlStore } from '@/stores/osctrl'
import { isOnline, platformIcon, relativeTime } from '@/lib/format'
import { sampleEnvironments, sampleNodes } from '@/lib/samples'
import type { OsctrlEnvironment, OsctrlNode } from '@/api/types'

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

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return nodes.value
  return nodes.value.filter((n) =>
    [n.hostname, n.uuid, n.ip_address, n.platform, n.localname]
      .some((f) => (f ?? '').toLowerCase().includes(q)),
  )
})

const onlineCount = computed(() => nodes.value.filter((n) => isOnline(n.last_seen)).length)

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
    <p class="mb-4 text-sm text-fg-muted">Enrolled systems reporting to osctrl.</p>

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
          <tr v-for="n in filtered" :key="n.uuid" class="border-t border-line hover:bg-bg">
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
              <span class="mr-1">{{ platformIcon(n.platform) }}</span>{{ n.platform_version || n.platform || '—' }}
            </td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ n.ip_address || '—' }}</td>
            <td class="px-4 py-2 text-fg-muted">{{ n.osquery_version || '—' }}</td>
            <td class="px-4 py-2 text-fg-muted">{{ relativeTime(n.last_seen) }}</td>
            <td class="px-4 py-2 font-mono text-xs text-fg-subtle">{{ n.uuid }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
