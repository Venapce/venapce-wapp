<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import type { ExamplesStatus } from '@/api/types'

// One Settings card: load Superset's example datasets/charts/dashboards on demand
// for a demo. The backend proxies to a control endpoint inside Superset that runs
// `superset load_examples` in the background; we poll its status while it runs.
const conn = useConnectionStore()

const status = ref<ExamplesStatus | null>(null)
const loading = ref(false)
const error = ref('')
let poll: ReturnType<typeof setInterval> | null = null

const state = computed(() => status.value?.state ?? 'idle')
const running = computed(() => state.value === 'running')

const badge = computed(() => {
  switch (state.value) {
    case 'running':
      return { text: 'Loading…', cls: 'bg-warning-soft text-warning' }
    case 'loaded':
      return { text: 'Loaded', cls: 'bg-success-soft text-success' }
    case 'failed':
      return { text: 'Failed', cls: 'bg-danger-soft text-danger' }
    default:
      return { text: 'Not loaded', cls: 'bg-surface-2 text-fg-muted' }
  }
})

function stopPoll() {
  if (poll) {
    clearInterval(poll)
    poll = null
  }
}

async function refresh() {
  if (!conn.configured) return
  try {
    status.value = await conn.client.examplesStatus()
    error.value = ''
    if (status.value.state !== 'running') stopPoll()
  } catch {
    // Background poll — stay quiet (e.g. control endpoint not yet deployed).
    // The explicit Load action surfaces its own errors.
    stopPoll()
  }
}

function startPoll() {
  stopPoll()
  poll = setInterval(refresh, 4000)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    status.value = await conn.client.loadExamples()
    if (status.value.state === 'running') startPoll()
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await refresh()
  if (running.value) startPoll()
})
onUnmounted(stopPoll)
</script>

<template>
  <section class="card p-6">
    <div class="mb-4 flex items-start gap-3">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">✨</span>
      <div>
        <h2 class="text-sm font-semibold text-fg">Demo data</h2>
        <p class="text-xs text-fg-muted">
          Load Superset's example datasets, charts and dashboards — a quick way to explore Venapce.
        </p>
      </div>
      <span class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" :class="badge.cls">
        {{ badge.text }}
      </span>
    </div>

    <p v-if="!conn.configured" class="rounded-md bg-surface-2 px-3 py-2 text-sm text-fg-muted">
      Configure the Superset connection above first.
    </p>

    <template v-else>
      <p v-if="running" class="mb-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
        Loading example data — this downloads a few datasets and can take a couple of minutes. You can leave
        this page; it keeps running.
      </p>
      <p v-else-if="state === 'loaded'" class="mb-3 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
        Example data is loaded. Find it under Datasets and Dashboards.
      </p>
      <p v-else-if="state === 'failed'" class="mb-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
        {{ status?.message || 'The load failed. It needs internet access to download the sample data.' }}
      </p>

      <p v-if="error" class="mb-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

      <button
        v-if="state !== 'loaded'"
        type="button"
        class="btn-primary"
        :disabled="loading || running"
        @click="load"
      >
        {{ running ? 'Loading…' : loading ? 'Starting…' : state === 'failed' ? 'Try again' : 'Load sample data' }}
      </button>
    </template>
  </section>
</template>
