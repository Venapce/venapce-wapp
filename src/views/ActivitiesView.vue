<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { ACTIVITY_KINDS, ACTIVITY_STATUSES, SUBJECT_ICON, activityOpen, humanize, rowRoute } from '@/lib/pipeline'
import Pagination from '@/components/Pagination.vue'
import Icon from '@/components/Icon.vue'
import Badge from '@/components/pipeline/Badge.vue'
import FactPill from '@/components/pipeline/FactPill.vue'
import TagChip from '@/components/pipeline/TagChip.vue'
import type { Activity } from '@/api/types'

// Activities — everything that happened to the pipeline rows, across all three
// tables: every flow run with its outcome, every manual edit and promotion.
// Filter by kind / status / tag, search the outcomes; a row opens the activity,
// the subject chip opens the row it is about.
const conn = useConnectionStore()
const router = useRouter()

const items = ref<Activity[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const kind = ref('')
const status = ref('')
const tag = ref('')

const kindCounts = computed(() => {
  const c: Record<string, number> = {}
  items.value.forEach((a) => (c[a.kind] = (c[a.kind] ?? 0) + 1))
  return c
})
const statusCounts = computed(() => {
  const c: Record<string, number> = {}
  items.value.forEach((a) => (c[a.status] = (c[a.status] ?? 0) + 1))
  return c
})
const tags = computed(() => {
  const set = new Set<string>()
  items.value.forEach((a) => a.tags?.forEach((t) => set.add(t)))
  return [...set].sort()
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter((a) => {
    if (kind.value && a.kind !== kind.value) return false
    if (status.value && a.status !== status.value) return false
    if (tag.value && !a.tags?.includes(tag.value)) return false
    if (
      q &&
      ![a.title, a.description, a.remediation, a.flowTitle, a.origin, `${a.subjectKind} #${a.subjectId}`].some((f) =>
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
watch([search, kind, status, tag], () => (page.value = 1))
watch(totalPages, (n) => {
  if (page.value > n) page.value = n
})

const anyOpen = computed(() => items.value.some((a) => activityOpen(a.status)))

async function load(quiet = false) {
  if (!quiet) loading.value = true
  error.value = ''
  try {
    items.value = await conn.client.listActivities({ limit: 1000 })
  } catch (e) {
    if (!quiet) error.value = apiErr(e)
  } finally {
    loading.value = false
  }
}

// Keep in-flight runs moving without a manual refresh.
let timer: ReturnType<typeof setInterval> | null = null
watch(anyOpen, (open) => {
  if (open && !timer) timer = setInterval(() => load(true), 5000)
  if (!open && timer) {
    clearInterval(timer)
    timer = null
  }
})
onBeforeUnmount(() => timer && clearInterval(timer))

function open(a: Activity) {
  router.push(rowRoute('activity', a.id))
}

async function remove(a: Activity) {
  if (!window.confirm(`Delete activity #${a.id}${a.title ? ` "${a.title}"` : ''}?`)) return
  try {
    await conn.client.deleteActivity(a.id)
    items.value = items.value.filter((x) => x.id !== a.id)
  } catch (e) {
    error.value = apiErr(e)
  }
}

onMounted(() => load())
</script>

<template>
  <div class="p-6">
    <div class="mb-1 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">Activities</h1>
      <span class="chip">{{ filtered.length }}</span>
      <span v-if="anyOpen" class="inline-flex items-center gap-1 text-xs text-accent">
        <Icon name="loader" :size="12" class="animate-spin" /> runs in progress
      </span>
      <div class="ml-auto flex items-center gap-2">
        <input v-model="search" class="field max-w-xs" placeholder="Search outcomes, flows, subjects…" />
        <button class="btn-outline" @click="load()">Refresh</button>
      </div>
    </div>
    <p class="mb-4 text-sm text-fg-muted">
      What happened to the pipeline rows: every FloMorphic flow run with the outcome it produced (facts, remediation, proof), and
      every edit and promotion. Open a row in Stage, Findings or Issues and press <em>Run flow</em> to add one.
    </p>

    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

    <!-- kind / status / tag filters -->
    <div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div class="flex flex-wrap gap-1.5">
        <button
          class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
          :class="kind === '' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
          @click="kind = ''"
        >
          all kinds
        </button>
        <button
          v-for="k in ACTIVITY_KINDS"
          :key="k"
          class="rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors"
          :class="kind === k ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
          @click="kind = kind === k ? '' : k"
        >
          {{ k }} <span v-if="kindCounts[k]" class="opacity-70">· {{ kindCounts[k] }}</span>
        </button>
      </div>
      <span class="hidden h-4 w-px bg-line sm:block"></span>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="s in ACTIVITY_STATUSES"
          :key="s"
          class="rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors"
          :class="status === s ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
          @click="status = status === s ? '' : s"
        >
          {{ s }} <span v-if="statusCounts[s]" class="opacity-70">· {{ statusCounts[s] }}</span>
        </button>
      </div>
      <div v-if="tags.length" class="flex flex-wrap items-center gap-1.5">
        <Icon name="tag" :size="13" class="text-fg-subtle" />
        <TagChip v-for="t in tags" :key="t" :tag="t" clickable :active="tag === t" @click="tag = tag === t ? '' : t" />
      </div>
    </div>

    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>
    <div v-else-if="filtered.length === 0" class="card p-10 text-center text-sm text-fg-subtle">No activities match.</div>

    <div v-else class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-surface-2 text-left text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th class="px-4 py-2">Kind</th>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2">Outcome</th>
            <th class="px-4 py-2">Subject</th>
            <th class="px-4 py-2">Facts</th>
            <th class="px-4 py-2">Flow / origin</th>
            <th class="px-4 py-2">When</th>
            <th class="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="a in paged" :key="a.id" class="cursor-pointer align-top hover:bg-accent-soft/40" @click="open(a)">
            <td class="px-4 py-2"><Badge kind="activity-kind" :value="a.kind" /></td>
            <td class="px-4 py-2"><Badge kind="activity-status" :value="a.status" /></td>
            <td class="max-w-md px-4 py-2">
              <div class="truncate font-medium text-fg">{{ a.title || `${humanize(a.kind)} #${a.id}` }}</div>
              <div v-if="a.error" class="truncate text-xs text-danger">{{ a.error }}</div>
              <div v-else-if="a.description" class="line-clamp-1 text-xs text-fg-muted">{{ a.description }}</div>
              <div v-if="a.remediation" class="mt-0.5 flex items-center gap-1 truncate text-xs text-fg-muted">
                <Icon name="wrench" :size="11" class="shrink-0 text-fg-subtle" /><span class="truncate">{{ a.remediation }}</span>
              </div>
            </td>
            <td class="px-4 py-2">
              <RouterLink
                :to="rowRoute(a.subjectKind, a.subjectId)"
                class="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[11px] text-fg hover:border-accent-border hover:text-accent"
                @click.stop
              >
                <Icon :name="SUBJECT_ICON[a.subjectKind] ?? 'circleDot'" :size="11" class="text-fg-subtle" />
                {{ a.subjectKind }} #{{ a.subjectId }}
              </RouterLink>
            </td>
            <td class="max-w-xs px-4 py-2">
              <div class="flex flex-wrap gap-1">
                <FactPill v-for="(f, i) in (a.facts ?? []).slice(0, 4)" :key="i" :label="f.k" :value="f.v" />
                <span v-if="(a.facts?.length ?? 0) > 4" class="chip-muted">+{{ a.facts!.length - 4 }}</span>
                <TagChip v-for="t in (a.tags ?? []).slice(0, 3)" :key="t" :tag="t" />
              </div>
            </td>
            <td class="px-4 py-2 text-xs">
              <div v-if="a.flowTitle" class="flex items-center gap-1 text-fg">
                <Icon name="workflow" :size="11" class="shrink-0 text-fg-subtle" /><span class="truncate">{{ a.flowTitle }}</span>
              </div>
              <div class="font-mono text-[11px] text-fg-subtle">{{ a.origin }}<span v-if="a.processId"> · p{{ a.processId }}</span></div>
            </td>
            <td class="whitespace-nowrap px-4 py-2 text-xs text-fg-muted" :title="a.finishedAt || a.createdAt">
              {{ relativeTime(a.finishedAt || a.createdAt) }}
            </td>
            <td class="px-2 py-2">
              <button class="icon-btn-plain icon-btn--danger" title="Delete activity" @click.stop="remove(a)">
                <Icon name="trash" :size="13" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="border-t border-line px-4 py-2">
        <Pagination v-model:page="page" :total-pages="totalPages" :total-items="filtered.length" :page-size="PAGE_SIZE" />
      </div>
    </div>
  </div>
</template>
