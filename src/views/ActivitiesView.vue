<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useSavedViewsStore } from '@/stores/savedViews'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { ACTIVITY_KINDS, ACTIVITY_STATUSES, SUBJECT_ICON, activityOpen, humanize, rowRoute } from '@/lib/pipeline'
import { tagsMatch } from '@/lib/savedView'
import { runErrors } from '@/lib/runErrors'
import Pagination from '@/components/Pagination.vue'
import Icon from '@/components/Icon.vue'
import FlomorphicLink from '@/components/FlomorphicLink.vue'
import Badge from '@/components/pipeline/Badge.vue'
import FactPill from '@/components/pipeline/FactPill.vue'
import TagChip from '@/components/pipeline/TagChip.vue'
import RunErrorBadge from '@/components/pipeline/RunErrorBadge.vue'
import RunErrorList from '@/components/pipeline/RunErrorList.vue'
import type { Activity } from '@/api/types'

// Activities — everything that happened, across the whole product: every
// FloMorphic flow run with its outcome (a pipeline row's, an operation's
// install or sweep), every manual edit and promotion. It spans all the tables,
// which is why it sits with Operations rather than inside the pipeline.
// Filter by kind / status / tag, search the outcomes; a row opens the activity,
// the subject chip opens the row it is about.
//
// A saved view (:viewId) seeds the tag filter and renames the page.
const props = defineProps<{ viewId?: string }>()

const conn = useConnectionStore()
const viewsStore = useSavedViewsStore()
const router = useRouter()

const items = ref<Activity[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const kind = ref('')
const status = ref('')

// Active tag filter — seeded from a saved view when one is open, otherwise
// toggled interactively from the chips.
const activeTags = ref<string[]>([])
const match = ref<'any' | 'all'>('any')

const savedView = computed(() => (props.viewId ? viewsStore.get(props.viewId) : undefined))

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
    if (!tagsMatch(a.tags, activeTags.value, match.value)) return false
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
// Each row with its error ledger resolved once, rather than in the template
// where the chip and the expanded list would each re-derive it.
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE).map((a) => ({ a, errs: runErrors(a) })),
)

// How many of the runs in view came back having hit something. Not the same as
// how many failed: a flow carries on past a node error, so most of these say
// `finished`.
const erroredCount = computed(() => filtered.value.filter((a) => runErrors(a)).length)

/** Which rows have their errors listed under them, by activity id. */
const openErrors = ref<(number | string)[]>([])
function toggleErrors(id: number | string) {
  openErrors.value = openErrors.value.includes(id) ? openErrors.value.filter((x) => x !== id) : [...openErrors.value, id]
}
watch([search, kind, status, activeTags, match], () => (page.value = 1), { deep: true })
watch(totalPages, (n) => {
  if (page.value > n) page.value = n
})

const anyOpen = computed(() => items.value.some((a) => activityOpen(a.status)))

async function load(quiet = false) {
  if (!quiet) loading.value = true
  error.value = ''
  try {
    items.value = await conn.client.listActivities({
      limit: 1000,
      ...(savedView.value ? { tags: savedView.value.tags, match: savedView.value.match } : {}),
    })
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

function toggleTag(t: string) {
  const i = activeTags.value.indexOf(t)
  if (i >= 0) activeTags.value.splice(i, 1)
  else activeTags.value.push(t)
}

// Seed (or clear) the tag filter from the saved view the route names.
function applyView() {
  const v = savedView.value
  activeTags.value = v ? [...v.tags] : []
  match.value = v?.match ?? 'any'
}

watch(() => props.viewId, () => {
  applyView()
  load()
})

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

onMounted(async () => {
  // Views come from the backend, so seed the filter only once they are in.
  await viewsStore.load()
  applyView()
  load()
})
</script>

<template>
  <div class="p-6">
    <div class="mb-1 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">{{ savedView ? savedView.name : 'Activities' }}</h1>
      <span class="chip">{{ filtered.length }}</span>
      <span v-if="anyOpen" class="inline-flex items-center gap-1 text-xs text-accent">
        <Icon name="loader" :size="12" class="animate-spin" /> runs in progress
      </span>
      <span
        v-if="erroredCount"
        class="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
        title="Runs that recorded at least one error while running — a flow carries on past a node error, so most of them still say finished"
      >
        <Icon name="alert" :size="12" /> {{ erroredCount }} run{{ erroredCount === 1 ? '' : 's' }} recorded errors
      </span>
      <div class="ml-auto flex items-center gap-2">
        <input v-model="search" class="field max-w-xs" placeholder="Search outcomes, flows, subjects…" />
        <button class="btn-outline" @click="load()">Refresh</button>
      </div>
    </div>
    <p class="mb-4 text-sm text-fg-muted">
      <template v-if="savedView">
        Saved view — activities tagged
        <span class="font-medium text-fg">{{ savedView.tags.join(savedView.match === 'all' ? ' + ' : ' / ') }}</span>.
      </template>
      <template v-else>
        Everything that ran, across every table: each FloMorphic flow run with the outcome it produced (facts, remediation, proof),
        and each edit and promotion — operation installs and sweeps included. Open a row in Stage, Findings or Issues and press
        <em>Run flow</em> to add one.
      </template>
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
        <TagChip v-for="t in tags" :key="t" :tag="t" clickable :active="activeTags.includes(t)" @click="toggleTag(t)" />
        <label v-if="activeTags.length > 1" class="ml-1 flex items-center gap-1 text-xs text-fg-muted">
          match
          <select v-model="match" class="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-xs">
            <option value="any">any</option>
            <option value="all">all</option>
          </select>
        </label>
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
          <template v-for="{ a, errs } in paged" :key="a.id">
            <tr class="cursor-pointer align-top hover:bg-accent-soft/40" @click="open(a)">
              <td class="px-4 py-2"><Badge kind="activity-kind" :value="a.kind" /></td>
              <td class="px-4 py-2"><Badge kind="activity-status" :value="a.status" /></td>
              <td class="max-w-md px-4 py-2">
                <div class="truncate font-medium text-fg">{{ a.title || `${humanize(a.kind)} #${a.id}` }}</div>
                <!-- The run hit things on the way to this outcome. The status
                     column may well read `finished`; this is what says otherwise. -->
                <div v-if="errs" class="mt-0.5">
                  <RunErrorBadge :errors="errs" :expanded="openErrors.includes(a.id)" @toggle="toggleErrors(a.id)" />
                </div>
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
                  <TagChip
                    v-for="t in (a.tags ?? []).slice(0, 3)"
                    :key="t"
                    :tag="t"
                    clickable
                    :active="activeTags.includes(t)"
                    @click="toggleTag(t)"
                  />
                </div>
              </td>
              <td class="px-4 py-2 text-xs">
                <div v-if="a.flowTitle" class="flex items-center gap-1 text-fg">
                  <Icon name="workflow" :size="11" class="shrink-0 text-fg-subtle" /><span class="truncate">{{ a.flowTitle }}</span>
                </div>
                <div class="font-mono text-[11px] text-fg-subtle">{{ a.origin }}<span v-if="a.processId"> · p{{ a.processId }}</span></div>
                <!-- Straight to the flow that produced the row, on the canvas. -->
                <FlomorphicLink v-if="a.flowId" kind="flow" :id="a.flowId" label="Open flow" class="mt-1" />
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
            <tr v-if="errs && openErrors.includes(a.id)" class="bg-surface-2">
              <td colspan="8" class="px-4 py-3"><RunErrorList :errors="errs" /></td>
            </tr>
          </template>
        </tbody>
      </table>
      <div class="border-t border-line px-4 py-2">
        <Pagination v-model:page="page" :total-pages="totalPages" :total-items="filtered.length" :page-size="PAGE_SIZE" />
      </div>
    </div>
  </div>
</template>
