<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { useIssueViewsStore } from '@/stores/issueViews'
import { relativeTime } from '@/lib/format'
import { sampleIssues } from '@/lib/samples'
import type { Issue, IssueSeverity } from '@/api/types'

// The Issues axis table. One table for every issue type; a saved sub-view (from
// the route :viewId) is just a named tag filter. Rows are produced and advanced
// by FloMorphic — this view reads and filters them.
const props = defineProps<{ viewId?: string }>()

const conn = useConnectionStore()
const viewsStore = useIssueViewsStore()

const issues = ref<Issue[]>([])
const loading = ref(true)
const error = ref('')
const sample = ref(false)
const search = ref('')

// Active tag filter. Seeded from a saved view when one is open; otherwise the
// user toggles tags interactively.
const activeTags = ref<string[]>([])
const match = ref<'any' | 'all'>('any')

const savedView = computed(() => (props.viewId ? viewsStore.get(props.viewId) : undefined))

const allTags = computed(() => {
  const set = new Set<string>()
  issues.value.forEach((i) => i.tags?.forEach((t) => set.add(t)))
  return [...set].sort()
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return issues.value.filter((i) => {
    if (activeTags.value.length) {
      const has = (t: string) => i.tags?.includes(t)
      const ok = match.value === 'all' ? activeTags.value.every(has) : activeTags.value.some(has)
      if (!ok) return false
    }
    if (q && ![i.title, i.summary, i.source, i.status].some((f) => (f ?? '').toLowerCase().includes(q))) {
      return false
    }
    return true
  })
})

const SEVERITY_CLASS: Record<IssueSeverity, string> = {
  critical: 'bg-danger-soft text-danger',
  high: 'bg-danger-soft text-danger',
  medium: 'bg-warning-soft text-warning',
  low: 'bg-surface-2 text-fg-muted',
  info: 'bg-accent-soft text-accent',
}

function toggleTag(tag: string) {
  const i = activeTags.value.indexOf(tag)
  if (i >= 0) activeTags.value.splice(i, 1)
  else activeTags.value.push(tag)
}

function applyView() {
  const v = savedView.value
  if (v) {
    activeTags.value = [...v.tags]
    match.value = v.match
  } else {
    activeTags.value = []
    match.value = 'any'
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    // Ask the backend to filter when a view is active; fall back to sample +
    // client-side filtering while the backend is unbuilt.
    issues.value = await conn.client.listIssues(
      savedView.value ? { tags: savedView.value.tags, match: savedView.value.match } : {},
    )
    sample.value = false
  } catch {
    issues.value = sampleIssues
    sample.value = true
  } finally {
    loading.value = false
  }
}

watch(
  () => props.viewId,
  () => {
    applyView()
    load()
  },
)

onMounted(() => {
  viewsStore.load()
  applyView()
  load()
})
</script>

<template>
  <div class="p-6">
    <div class="mb-1 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">{{ savedView ? savedView.name : 'Issues' }}</h1>
      <span class="chip">{{ filtered.length }}</span>
      <div class="ml-auto flex items-center gap-2">
        <input v-model="search" class="field max-w-xs" placeholder="Search issues…" />
        <button class="btn-outline" @click="load">Refresh</button>
      </div>
    </div>
    <p class="mb-4 text-sm text-fg-muted">
      <template v-if="savedView">
        Saved view — issues tagged
        <span class="font-medium text-fg">{{ savedView.tags.join(savedView.match === 'all' ? ' + ' : ' / ') }}</span>.
      </template>
      <template v-else>The main Venapce table. Filter by tags to carve out a view.</template>
    </p>

    <div v-if="sample" class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
      Showing sample issues — the backend <code>/api/issues</code> endpoint (fed by FloMorphic) isn't wired yet.
    </div>
    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

    <!-- Tag filter bar -->
    <div v-if="allTags.length" class="mb-4 flex flex-wrap items-center gap-2">
      <button
        v-for="tag in allTags"
        :key="tag"
        class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
        :class="
          activeTags.includes(tag)
            ? 'bg-accent text-accent-fg'
            : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'
        "
        @click="toggleTag(tag)"
      >
        #{{ tag }}
      </button>
      <label v-if="activeTags.length > 1" class="ml-2 flex items-center gap-1 text-xs text-fg-muted">
        match
        <select v-model="match" class="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-xs">
          <option value="any">any</option>
          <option value="all">all</option>
        </select>
      </label>
      <button
        v-if="activeTags.length && !savedView"
        class="ml-1 text-xs text-fg-subtle hover:text-danger"
        @click="activeTags = []"
      >
        clear
      </button>
    </div>

    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>
    <div v-else-if="filtered.length === 0" class="card p-10 text-center text-sm text-fg-subtle">
      No issues match this filter.
    </div>

    <div v-else class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-surface-2 text-left text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th class="px-4 py-2">Severity</th>
            <th class="px-4 py-2">Issue</th>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2">Tags</th>
            <th class="px-4 py-2">Source</th>
            <th class="px-4 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in filtered" :key="i.id" class="border-t border-line hover:bg-bg">
            <td class="px-4 py-2">
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                :class="SEVERITY_CLASS[i.severity ?? 'info']"
              >
                {{ i.severity || 'info' }}
              </span>
            </td>
            <td class="px-4 py-2">
              <div class="font-medium text-fg">{{ i.title }}</div>
              <div v-if="i.summary" class="max-w-md truncate text-xs text-fg-subtle">{{ i.summary }}</div>
            </td>
            <td class="px-4 py-2 text-fg-muted capitalize">{{ i.status }}</td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="t in i.tags"
                  :key="t"
                  class="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-fg-muted hover:bg-accent-soft hover:text-accent"
                  @click="toggleTag(t)"
                >
                  {{ t }}
                </button>
              </div>
            </td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ i.source || '—' }}</td>
            <td class="px-4 py-2 text-fg-muted">{{ relativeTime(i.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
