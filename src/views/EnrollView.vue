<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { useOsctrlStore } from '@/stores/osctrl'
import { sampleEnroll, sampleEnvironments } from '@/lib/samples'
import type { OsctrlEnrollValues, OsctrlEnvironment } from '@/api/types'

// Enroll commands: helper values (secret, flags, one-liners) an operator runs on
// a system to enroll it into the selected osctrl environment.
const conn = useConnectionStore()
const osctrl = useOsctrlStore()

const environments = ref<OsctrlEnvironment[]>([])
const env = ref('')
const values = ref<OsctrlEnrollValues | null>(null)
const loading = ref(true)
const error = ref('')
const sample = ref(false)
const copied = ref('')

const platforms: Array<{ key: string; label: string }> = [
  { key: 'linux', label: 'Linux' },
  { key: 'darwin', label: 'macOS' },
  { key: 'windows', label: 'Windows' },
]

async function copy(text: string, id: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = id
    setTimeout(() => (copied.value === id ? (copied.value = '') : null), 1500)
  } catch {
    /* clipboard blocked — no-op */
  }
}

async function loadEnvironments() {
  try {
    environments.value = await conn.client.osctrlEnvironments()
  } catch {
    environments.value = sampleEnvironments
  }
  if (!env.value) env.value = osctrl.environment || environments.value[0]?.name || ''
}

async function loadEnroll() {
  if (!env.value) return
  loading.value = true
  error.value = ''
  try {
    values.value = await conn.client.osctrlEnroll(env.value)
    sample.value = false
  } catch {
    values.value = sampleEnroll
    sample.value = true
  } finally {
    loading.value = false
  }
}

watch(env, loadEnroll)

onMounted(async () => {
  if (!osctrl.loaded) await osctrl.loadSettings()
  await loadEnvironments()
  await loadEnroll()
})
</script>

<template>
  <div class="p-6">
    <div class="mb-1 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">Enroll</h1>
      <div class="ml-auto flex items-center gap-2">
        <label class="text-xs font-medium text-fg-muted">Environment</label>
        <select v-model="env" class="field max-w-[12rem]">
          <option v-for="e in environments" :key="e.uuid" :value="e.name">{{ e.name }}</option>
        </select>
      </div>
    </div>
    <p class="mb-4 text-sm text-fg-muted">Run one of these on a system to enroll it into osctrl.</p>

    <div v-if="sample" class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
      Showing sample values — connect osctrl in
      <RouterLink :to="{ name: 'settings' }" class="underline">Settings</RouterLink>
      to fetch real enrollment values.
    </div>
    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>

    <div v-else-if="values" class="space-y-5">
      <!-- Quick enroll: per-platform one-liners -->
      <section class="card p-5">
        <h2 class="label mb-3">Quick enroll</h2>
        <div class="space-y-3">
          <div v-for="p in platforms" :key="p.key">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs font-semibold text-fg-muted">{{ p.label }}</span>
              <button
                v-if="values.oneLiner?.[p.key]"
                class="text-xs font-medium text-accent hover:underline"
                @click="copy(values.oneLiner[p.key], 'ol-' + p.key)"
              >
                {{ copied === 'ol-' + p.key ? 'Copied ✓' : 'Copy' }}
              </button>
            </div>
            <pre
              class="overflow-x-auto rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg"
            >{{ values.oneLiner?.[p.key] || '— not available —' }}</pre>
          </div>
        </div>
      </section>

      <!-- Enroll secret -->
      <section v-if="values.secret" class="card p-5">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="label">Enroll secret</h2>
          <button class="text-xs font-medium text-accent hover:underline" @click="copy(String(values.secret), 'secret')">
            {{ copied === 'secret' ? 'Copied ✓' : 'Copy' }}
          </button>
        </div>
        <pre class="overflow-x-auto rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg">{{ values.secret }}</pre>
      </section>

      <!-- osquery flags -->
      <section v-if="values.flags" class="card p-5">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="label">osquery flags</h2>
          <button class="text-xs font-medium text-accent hover:underline" @click="copy(String(values.flags), 'flags')">
            {{ copied === 'flags' ? 'Copied ✓' : 'Copy' }}
          </button>
        </div>
        <pre class="overflow-x-auto rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg">{{ values.flags }}</pre>
      </section>
    </div>
  </div>
</template>
