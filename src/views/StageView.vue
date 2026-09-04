<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { relativeTime } from '@/lib/format'
import { sampleStage } from '@/lib/samples'
import type { StageItem } from '@/api/types'

// Stage — the pipeline inbox that precedes Issues. Everything a pipeline feeds
// into FloMorphic lands here first; a flow inspects each row and either promotes
// it to an issue, drops it, or holds it. This view reads the raw staged rows and
// their routing disposition.
const conn = useConnectionStore()

const items = ref<StageItem[]>([])
const loading = ref(true)
const error = ref('')
const sample = ref(false)
const search = ref('')
const disposition = ref<string>('')

const DISPOSITIONS = ['pending', 'promoted', 'held', 'dropped']

const DISPOSITION_CLASS: Record<string, string> = {
  pending: 'bg-warning-soft text-warning',
  promoted: 'bg-success-soft text-success',
  held: 'bg-accent-soft text-accent',
  dropped: 'bg-surface-2 text-fg-subtle',
}

const counts = computed(() => {
  const c: Record<string, number> = {}
  items.value.forEach((i) => (c[i.disposition] = (c[i.disposition] ?? 0) + 1))
  return c
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter((i) => {
    if (disposition.value && i.disposition !== disposition.value) return false
    if (q && ![i.title, i.summary, i.source].some((f) => (f ?? '').toLowerCase().includes(q))) return false
    return true
  })
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await conn.client.listStage(disposition.value ? { disposition: disposition.value } : {})
    sample.value = false
  } catch {
    items.value = sampleStage
    sample.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="p-6">
    <div class="mb-1 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">Stage</h1>
      <span class="chip">{{ filtered.length }}</span>
      <div class="ml-auto flex items-center gap-2">
        <input v-model="search" class="field max-w-xs" placeholder="Search staged data…" />
        <button class="btn-outline" @click="load">Refresh</button>
      </div>
    </div>
    <p class="mb-4 text-sm text-fg-muted">
      The pipeline inbox. Incoming data waits here until a FloMorphic flow routes it — promoted to an issue, held, or dropped.
    </p>

    <div v-if="sample" class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
      Showing sample data — the backend <code>/api/stage</code> endpoint (fed by FloMorphic) isn't wired yet.
    </div>
    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

    <!-- Disposition filter -->
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
        :class="disposition === '' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
        @click="disposition = ''"
      >
        all
      </button>
      <button
        v-for="d in DISPOSITIONS"
        :key="d"
        class="rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors"
        :class="disposition === d ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
        @click="disposition = d"
      >
        {{ d }} <span v-if="counts[d]" class="opacity-70">· {{ counts[d] }}</span>
      </button>
    </div>

    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>
    <div v-else-if="filtered.length === 0" class="card p-10 text-center text-sm text-fg-subtle">
      Nothing staged right now.
    </div>

    <div v-else class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-surface-2 text-left text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th class="px-4 py-2">Disposition</th>
            <th class="px-4 py-2">Data</th>
            <th class="px-4 py-2">Source</th>
            <th class="px-4 py-2">Tags</th>
            <th class="px-4 py-2">Routed to</th>
            <th class="px-4 py-2">Received</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in filtered" :key="i.id" class="border-t border-line hover:bg-bg">
            <td class="px-4 py-2">
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                :class="DISPOSITION_CLASS[i.disposition] ?? 'bg-surface-2 text-fg-muted'"
              >
                {{ i.disposition }}
              </span>
            </td>
            <td class="px-4 py-2">
              <div class="font-medium text-fg">{{ i.title || '—' }}</div>
              <div v-if="i.summary" class="max-w-md truncate text-xs text-fg-subtle">{{ i.summary }}</div>
            </td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ i.source || '—' }}</td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap gap-1">
                <span v-for="t in i.tags" :key="t" class="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-fg-muted">
                  {{ t }}
                </span>
                <span v-if="!i.tags?.length" class="text-xs text-fg-subtle">—</span>
              </div>
            </td>
            <td class="px-4 py-2">
              <RouterLink
                v-if="i.issueId"
                :to="{ name: 'issues' }"
                class="text-xs font-medium text-accent hover:underline"
              >
                issue #{{ i.issueId }}
              </RouterLink>
              <span v-else class="text-xs text-fg-subtle">—</span>
            </td>
            <td class="px-4 py-2 text-fg-muted">{{ relativeTime(i.receivedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
