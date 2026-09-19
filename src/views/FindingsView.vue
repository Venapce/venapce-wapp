<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { sampleFindings } from '@/lib/samples'
import { FINDING_STATUSES, SEVERITIES, hasLink, humanize, rowRoute } from '@/lib/pipeline'
import Pagination from '@/components/Pagination.vue'
import Icon from '@/components/Icon.vue'
import Badge from '@/components/pipeline/Badge.vue'
import TagChip from '@/components/pipeline/TagChip.vue'
import type { Finding } from '@/api/types'

// Findings — the middle level: what a process concluded from data, still to be
// validated. Filter by status / severity / tags, open a row for its evidence,
// enrichment and provenance, and promote it to an issue from there.
const conn = useConnectionStore()
const router = useRouter()

const items = ref<Finding[]>([])
const loading = ref(true)
const error = ref('')
const sample = ref(false)
const search = ref('')
const status = ref('')
const severity = ref('')
const activeTags = ref<string[]>([])

const counts = computed(() => {
  const c: Record<string, number> = {}
  items.value.forEach((i) => (c[i.status] = (c[i.status] ?? 0) + 1))
  return c
})

const allTags = computed(() => {
  const set = new Set<string>()
  items.value.forEach((i) => i.tags?.forEach((t) => set.add(t)))
  return [...set].sort()
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter((i) => {
    if (status.value && i.status !== status.value) return false
    if (severity.value && (i.severity ?? 'info') !== severity.value) return false
    if (activeTags.value.length && !activeTags.value.some((t) => i.tags?.includes(t))) return false
    if (
      q &&
      ![i.title, i.summary, i.source, i.origin, i.target, i.category, i.fingerprint].some((f) =>
        (f ?? '').toLowerCase().includes(q),
      )
    )
      return false
    return true
  })
})

const PAGE_SIZE = 25
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([search, status, severity, activeTags], () => (page.value = 1), { deep: true })
watch(totalPages, (n) => {
  if (page.value > n) page.value = n
})

function toggleTag(tag: string) {
  const i = activeTags.value.indexOf(tag)
  if (i >= 0) activeTags.value.splice(i, 1)
  else activeTags.value.push(tag)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await conn.client.listFindings()
    sample.value = false
  } catch {
    items.value = sampleFindings
    sample.value = true
  } finally {
    loading.value = false
  }
}

function open(f: Finding) {
  router.push(rowRoute('finding', f.id))
}

async function remove(f: Finding) {
  if (!window.confirm(`Delete finding #${f.id} "${f.title}"?`)) return
  try {
    await conn.client.deleteFinding(f.id)
    items.value = items.value.filter((x) => x.id !== f.id)
  } catch (e) {
    error.value = apiErr(e)
  }
}

onMounted(load)
</script>

<template>
  <div class="p-6">
    <div class="mb-1 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">Findings</h1>
      <span class="chip">{{ filtered.length }}</span>
      <div class="ml-auto flex items-center gap-2">
        <input v-model="search" class="field max-w-xs" placeholder="Search findings…" />
        <button class="btn-outline" @click="load">Refresh</button>
      </div>
    </div>
    <p class="mb-4 text-sm text-fg-muted">
      What a process concluded from data — an observation with a severity, a confidence and a target, still to be validated.
      Every finding records where its data came from and how it was made. Validated findings become issues.
    </p>

    <div v-if="sample" class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
      Showing sample findings — the backend <code>/api/findings</code> endpoint isn't reachable.
    </div>
    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

    <!-- Status chips + severity select + tag chips -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
        :class="status === '' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
        @click="status = ''"
      >
        all
      </button>
      <button
        v-for="s in FINDING_STATUSES"
        :key="s"
        class="rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors"
        :class="status === s ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
        @click="status = s"
      >
        {{ humanize(s) }} <span v-if="counts[s]" class="opacity-70">· {{ counts[s] }}</span>
      </button>
      <select v-model="severity" class="ml-2 rounded-md border border-line-strong bg-surface px-1.5 py-1 text-xs capitalize">
        <option value="">any severity</option>
        <option v-for="s in SEVERITIES" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
    <div v-if="allTags.length" class="mb-4 flex flex-wrap items-center gap-2">
      <button
        v-for="tag in allTags"
        :key="tag"
        class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
        :class="activeTags.includes(tag) ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
        @click="toggleTag(tag)"
      >
        #{{ tag }}
      </button>
      <button v-if="activeTags.length" class="ml-1 text-xs text-fg-subtle hover:text-danger" @click="activeTags = []">clear</button>
    </div>

    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>
    <div v-else-if="filtered.length === 0" class="card p-10 text-center text-sm text-fg-subtle">
      No findings match this filter.
    </div>

    <div v-else class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-surface-2 text-left text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th class="px-4 py-2">Severity</th>
            <th class="px-4 py-2">Finding</th>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2">Category</th>
            <th class="px-4 py-2">Target</th>
            <th class="px-4 py-2">Tags</th>
            <th class="px-4 py-2">Source</th>
            <th class="px-4 py-2">Origin</th>
            <th class="px-4 py-2">Linked</th>
            <th class="px-4 py-2">Created</th>
            <th class="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in paged" :key="f.id" class="cursor-pointer border-t border-line hover:bg-bg" @click="open(f)">
            <td class="px-4 py-2">
              <Badge kind="severity" :value="f.severity" />
            </td>
            <td class="px-4 py-2">
              <div class="font-medium text-fg">
                {{ f.title }}
                <span class="ml-1 font-mono text-[11px] font-normal text-fg-subtle">#{{ f.id }}</span>
              </div>
              <div v-if="f.summary" class="max-w-md truncate text-xs text-fg-subtle">{{ f.summary }}</div>
            </td>
            <td class="px-4 py-2">
              <Badge kind="finding-status" :value="f.status" />
              <div v-if="f.confidence" class="mt-0.5 text-[11px] text-fg-subtle">conf · {{ f.confidence }}</div>
            </td>
            <td class="px-4 py-2 text-xs text-fg-muted">{{ f.category || '—' }}</td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ f.target || '—' }}</td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap gap-1">
                <TagChip v-for="t in f.tags" :key="t" :tag="t" clickable :active="activeTags.includes(t)" @click.stop="toggleTag(t)" />
                <span v-if="!f.tags?.length" class="text-xs text-fg-subtle">—</span>
              </div>
            </td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ f.source || '—' }}</td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ f.origin || '—' }}</td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap gap-2 text-xs font-medium">
                <RouterLink v-if="hasLink(f.stageId)" :to="rowRoute('stage', f.stageId!)" class="text-fg-muted hover:text-accent hover:underline" @click.stop>
                  stage #{{ f.stageId }}
                </RouterLink>
                <RouterLink v-if="hasLink(f.issueId)" :to="rowRoute('issue', f.issueId!)" class="text-accent hover:underline" @click.stop>
                  issue #{{ f.issueId }}
                </RouterLink>
                <span v-if="!hasLink(f.stageId) && !hasLink(f.issueId)" class="font-normal text-fg-subtle">—</span>
              </div>
            </td>
            <td class="whitespace-nowrap px-4 py-2 text-fg-muted">{{ relativeTime(f.createdAt) }}</td>
            <td class="px-2 py-2 text-right">
              <button class="icon-btn-plain icon-btn--danger" title="Delete" :disabled="sample" @click.stop="remove(f)">
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
