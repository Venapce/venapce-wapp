<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useIssueViewsStore } from '@/stores/issueViews'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { sampleIssues } from '@/lib/samples'
import { hasLink, humanize, rowRoute } from '@/lib/pipeline'
import Pagination from '@/components/Pagination.vue'
import Icon from '@/components/Icon.vue'
import Badge from '@/components/pipeline/Badge.vue'
import TagChip from '@/components/pipeline/TagChip.vue'
import type { Issue } from '@/api/types'

// The Issues axis table. One table for every issue type; a saved sub-view (from
// the route :viewId) is just a named tag filter. Rows are produced and advanced
// by FloMorphic — this view reads and filters them; a row opens its detail
// page (documents, provenance, edit / delete).
const props = defineProps<{ viewId?: string }>()

const conn = useConnectionStore()
const viewsStore = useIssueViewsStore()
const router = useRouter()

const issues = ref<Issue[]>([])
const loading = ref(true)
const error = ref('')
const sample = ref(false)
const search = ref('')

// Active tag filter. Seeded from a saved view when one is open; otherwise the
// user toggles tags interactively.
const activeTags = ref<string[]>([])
const match = ref<'any' | 'all'>('any')
const status = ref('')

// Statuses present in the loaded set, for the status chips (free text, so the
// list is whatever FloMorphic has written).
const allStatuses = computed(() => {
  const c: Record<string, number> = {}
  issues.value.forEach((i) => (c[i.status] = (c[i.status] ?? 0) + 1))
  return Object.entries(c).sort(([a], [b]) => a.localeCompare(b))
})

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
    if (status.value && i.status !== status.value) return false
    if (q && ![i.title, i.summary, i.source, i.origin, i.status, i.assignee].some((f) => (f ?? '').toLowerCase().includes(q))) {
      return false
    }
    return true
  })
})

// Client-side paging over the filtered set. The backend hands back the whole
// (view-filtered) list today, so slicing here keeps the table readable without
// a second round-trip; any filter change lands back on page 1.
const PAGE_SIZE = 25
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([search, activeTags, match, status], () => (page.value = 1), { deep: true })
watch(totalPages, (n) => {
  if (page.value > n) page.value = n
})

function open(i: Issue) {
  router.push(rowRoute('issue', i.id))
}

async function remove(i: Issue) {
  if (!window.confirm(`Delete issue #${i.id} "${i.title}"?`)) return
  try {
    await conn.client.deleteIssue(i.id)
    issues.value = issues.value.filter((x) => x.id !== i.id)
  } catch (e) {
    error.value = apiErr(e)
  }
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
      Showing sample issues — the backend <code>/api/issues</code> endpoint isn't reachable.
    </div>
    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

    <!-- Status chips (from whatever statuses the rows carry) -->
    <div v-if="allStatuses.length" class="mb-3 flex flex-wrap items-center gap-2">
      <button
        class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
        :class="status === '' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
        @click="status = ''"
      >
        all
      </button>
      <button
        v-for="[s, n] in allStatuses"
        :key="s"
        class="rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors"
        :class="status === s ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
        @click="status = s"
      >
        {{ humanize(s) }} <span class="opacity-70">· {{ n }}</span>
      </button>
    </div>

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
            <th class="px-4 py-2">Assignee</th>
            <th class="px-4 py-2">Source</th>
            <th class="px-4 py-2">Origin</th>
            <th class="px-4 py-2">From</th>
            <th class="px-4 py-2">Created</th>
            <th class="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in paged" :key="i.id" class="cursor-pointer border-t border-line hover:bg-bg" @click="open(i)">
            <td class="px-4 py-2">
              <Badge kind="severity" :value="i.severity" />
            </td>
            <td class="px-4 py-2">
              <div class="font-medium text-fg">
                {{ i.title }}
                <span class="ml-1 font-mono text-[11px] font-normal text-fg-subtle">#{{ i.id }}</span>
              </div>
              <div v-if="i.summary" class="max-w-md truncate text-xs text-fg-subtle">{{ i.summary }}</div>
            </td>
            <td class="px-4 py-2">
              <Badge kind="issue-status" :value="i.status" />
            </td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap gap-1">
                <TagChip v-for="t in i.tags" :key="t" :tag="t" clickable :active="activeTags.includes(t)" @click.stop="toggleTag(t)" />
                <span v-if="!i.tags?.length" class="text-xs text-fg-subtle">—</span>
              </div>
            </td>
            <td class="px-4 py-2 text-xs text-fg-muted">{{ i.assignee || '—' }}</td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ i.source || '—' }}</td>
            <td class="px-4 py-2 font-mono text-xs text-fg-muted">{{ i.origin || '—' }}</td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap gap-2 text-xs font-medium">
                <RouterLink v-if="hasLink(i.findingId)" :to="rowRoute('finding', i.findingId!)" class="text-accent hover:underline" @click.stop>
                  finding #{{ i.findingId }}
                </RouterLink>
                <RouterLink v-if="hasLink(i.stageId)" :to="rowRoute('stage', i.stageId!)" class="text-fg-muted hover:text-accent hover:underline" @click.stop>
                  stage #{{ i.stageId }}
                </RouterLink>
                <span v-if="!hasLink(i.findingId) && !hasLink(i.stageId)" class="font-normal text-fg-subtle" title="Written directly — no earlier level">direct</span>
              </div>
            </td>
            <td class="whitespace-nowrap px-4 py-2 text-fg-muted">{{ relativeTime(i.createdAt) }}</td>
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
