<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { sampleStage } from '@/lib/samples'
import { DISPOSITIONS, docShape, hasLink, rowRoute } from '@/lib/pipeline'
import Pagination from '@/components/Pagination.vue'
import Icon from '@/components/Icon.vue'
import Badge from '@/components/pipeline/Badge.vue'
import TagChip from '@/components/pipeline/TagChip.vue'
import type { StageItem } from '@/api/types'

// Stage — the pipeline inbox. Raw data lands here first; a FloMorphic flow
// routes each row (promote to a finding or an issue, hold, drop). This view
// lists the rows and their routing; a row opens its detail page, where the
// payload is explorable as a tree.
const conn = useConnectionStore()
const router = useRouter()

const items = ref<StageItem[]>([])
const loading = ref(true)
const error = ref('')
const sample = ref(false)
const search = ref('')
const disposition = ref<string>('')

const counts = computed(() => {
  const c: Record<string, number> = {}
  items.value.forEach((i) => (c[i.disposition] = (c[i.disposition] ?? 0) + 1))
  return c
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter((i) => {
    if (disposition.value && i.disposition !== disposition.value) return false
    if (q && ![i.title, i.summary, i.source, i.origin].some((f) => (f ?? '').toLowerCase().includes(q))) return false
    return true
  })
})

// Client-side paging over the filtered set (same shape as Issues). Any filter
// change lands back on page 1.
const PAGE_SIZE = 25
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([search, disposition], () => (page.value = 1))
watch(totalPages, (n) => {
  if (page.value > n) page.value = n
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await conn.client.listStage()
    sample.value = false
  } catch {
    items.value = sampleStage
    sample.value = true
  } finally {
    loading.value = false
  }
}

function open(i: StageItem) {
  router.push(rowRoute('stage', i.id))
}

async function remove(i: StageItem) {
  if (!window.confirm(`Delete staged row #${i.id}${i.title ? ` "${i.title}"` : ''}?`)) return
  try {
    await conn.client.deleteStage(i.id)
    items.value = items.value.filter((x) => x.id !== i.id)
  } catch (e) {
    error.value = apiErr(e)
  }
}

// Which documents a row carries, for the compact "docs" cell.
function docs(i: StageItem): string[] {
  return (['data', 'meta', 'ref'] as const).map((k) => (docShape(i[k]) ? `${k} · ${docShape(i[k])}` : '')).filter(Boolean)
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
      The pipeline inbox. Raw data waits here until a FloMorphic flow routes it — to a finding, straight to an issue, held, or dropped.
      Open a row to explore its payload.
    </p>

    <div v-if="sample" class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
      Showing sample data — the backend <code>/api/stage</code> endpoint isn't reachable.
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
            <th class="px-4 py-2">Origin</th>
            <th class="px-4 py-2">Docs</th>
            <th class="px-4 py-2">Tags</th>
            <th class="px-4 py-2">Routed to</th>
            <th class="px-4 py-2">Received</th>
            <th class="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in paged" :key="i.id" class="cursor-pointer border-t border-line hover:bg-bg" @click="open(i)">
            <td class="px-4 py-2">
              <Badge kind="disposition" :value="i.disposition" />
            </td>
            <td class="px-4 py-2">
              <div class="font-medium text-fg">
                {{ i.title || '—' }}
                <span class="ml-1 font-mono text-[11px] font-normal text-fg-subtle">#{{ i.id }}</span>
              </div>
              <div v-if="i.summary" class="max-w-md truncate text-xs text-fg-subtle">{{ i.summary }}</div>
            </td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ i.source || '—' }}</td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ i.origin || '—' }}</td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap gap-1">
                <span v-for="d in docs(i)" :key="d" class="chip-muted font-mono">{{ d }}</span>
                <span v-if="!docs(i).length" class="text-xs text-fg-subtle">—</span>
              </div>
            </td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap gap-1">
                <TagChip v-for="t in i.tags" :key="t" :tag="t" />
                <span v-if="!i.tags?.length" class="text-xs text-fg-subtle">—</span>
              </div>
            </td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap gap-2 text-xs font-medium">
                <RouterLink v-if="hasLink(i.findingId)" :to="rowRoute('finding', i.findingId!)" class="text-accent hover:underline" @click.stop>
                  finding #{{ i.findingId }}
                </RouterLink>
                <RouterLink v-if="hasLink(i.issueId)" :to="rowRoute('issue', i.issueId!)" class="text-accent hover:underline" @click.stop>
                  issue #{{ i.issueId }}
                </RouterLink>
                <span v-if="!hasLink(i.findingId) && !hasLink(i.issueId)" class="font-normal text-fg-subtle">—</span>
              </div>
            </td>
            <td class="whitespace-nowrap px-4 py-2 text-fg-muted">{{ relativeTime(i.receivedAt) }}</td>
            <td class="px-2 py-2 text-right">
              <button class="icon-btn-plain icon-btn--danger" title="Delete" :disabled="sample" @click.stop="remove(i)">
                <Icon name="trash" :size="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Pagination
      v-if="!loading && filtered.length > 0"
      class="mt-3"
      :page="page"
      :total-pages="totalPages"
      :total-items="filtered.length"
      :page-size="PAGE_SIZE"
      @update:page="page = $event"
    />
  </div>
</template>
