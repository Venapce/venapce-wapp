<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { activityOpen, rowRoute } from '@/lib/pipeline'
import Icon from '@/components/Icon.vue'
import Badge from './Badge.vue'
import FactPill from './FactPill.vue'
import TagChip from './TagChip.vue'
import RunFlowDialog from './RunFlowDialog.vue'
import type { Activity, SubjectKind } from '@/api/types'

// A row's history, newest first: every flow run on it (with the outcome once
// the run ends) and every manual change. Polls while a run is in flight so a
// launched flow completes in view. Owns the "Run flow" action for the row —
// unless `noRun`, for subjects that start their runs elsewhere (an operation).
const props = defineProps<{ kind: SubjectKind; id: number | string; disabled?: boolean; noRun?: boolean }>()

const conn = useConnectionStore()
const items = ref<Activity[]>([])
const loading = ref(false)
const error = ref('')
const dialog = ref(false)

const anyOpen = computed(() => items.value.some((a) => activityOpen(a.status)))
const runs = computed(() => items.value.filter((a) => a.kind === 'run').length)

async function load(quiet = false) {
  if (!quiet) loading.value = true
  try {
    items.value = await conn.client.listActivities({ subjectKind: props.kind, subjectId: props.id })
    error.value = ''
  } catch (e) {
    if (!quiet) error.value = apiErr(e)
  } finally {
    loading.value = false
  }
}

// Poll every 4s only while something is running; stop as soon as it settles.
let timer: ReturnType<typeof setInterval> | null = null
function schedule() {
  if (anyOpen.value && !timer) timer = setInterval(() => load(true), 4000)
  if (!anyOpen.value && timer) {
    clearInterval(timer)
    timer = null
  }
}
watch(anyOpen, schedule)
onBeforeUnmount(() => timer && clearInterval(timer))

function started(list: Activity[]) {
  // Show the new runs immediately; the poll takes it from there.
  items.value = [...list, ...items.value.filter((a) => !list.some((n) => n.id === a.id))]
  load(true)
}

/** The edit diff's field names, for the one-line summary of an `edit`. */
function changedFields(a: Activity): string[] {
  const changed = (a.ref as { changed?: Record<string, unknown> } | undefined)?.changed
  return changed ? Object.keys(changed) : []
}

watch(() => [props.kind, props.id], () => load())
onMounted(load)

defineExpose({ reload: () => load(true) })
</script>

<template>
  <section>
    <div class="mb-2 flex items-center gap-2">
      <h3 class="label !mb-0 flex items-center gap-1.5">
        <Icon name="history" :size="13" /> Activity
        <span v-if="items.length" class="chip">{{ items.length }}</span>
      </h3>
      <span v-if="anyOpen" class="inline-flex items-center gap-1 text-[11px] text-accent">
        <Icon name="loader" :size="12" class="animate-spin" /> running…
      </span>
      <div class="ml-auto flex items-center gap-1.5">
        <button class="icon-btn-sm" title="Reload" :disabled="loading" @click="load()"><Icon name="refresh" :size="13" /></button>
        <button v-if="!noRun" class="btn-primary btn-sm" :disabled="disabled" title="Send this row through a FloMorphic flow" @click="dialog = true">
          <Icon name="play" :size="13" /> Run flow
        </button>
      </div>
    </div>

    <p v-if="error" class="mb-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{{ error }}</p>
    <p v-if="loading && items.length === 0" class="text-xs text-fg-subtle">Loading…</p>
    <div v-else-if="items.length === 0" class="rounded-md border border-dashed border-line p-4 text-center text-xs text-fg-subtle">
      {{ noRun ? 'No runs yet.' : 'Nothing has happened to this row yet. Run a flow on it to get a first outcome.' }}
    </div>

    <ol v-else class="relative space-y-2 border-l border-line pl-4">
      <li v-for="a in items" :key="a.id" class="relative">
        <!-- timeline dot -->
        <span
          class="absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full border-2 border-surface"
          :class="
            a.status === 'failed' ? 'bg-danger' : activityOpen(a.status) ? 'bg-accent animate-pulse' : a.kind === 'run' ? 'bg-success' : 'bg-line'
          "
        ></span>
        <RouterLink :to="rowRoute('activity', a.id)" class="card block p-3 transition-colors hover:border-accent-border">
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge kind="activity-kind" :value="a.kind" />
            <Badge v-if="a.kind === 'run' || a.status !== 'finished'" kind="activity-status" :value="a.status" />
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-fg">{{ a.title || `${a.kind} #${a.id}` }}</span>
            <span class="text-[11px] text-fg-subtle" :title="a.finishedAt || a.createdAt">{{ relativeTime(a.finishedAt || a.createdAt) }}</span>
          </div>
          <div v-if="a.kind === 'run' && a.flowTitle && a.flowTitle !== a.title" class="mt-1 flex items-center gap-1 text-[11px] text-fg-muted">
            <Icon name="workflow" :size="11" /> {{ a.flowTitle }}
            <span v-if="a.processId" class="font-mono text-fg-subtle">· process {{ a.processId }}</span>
          </div>
          <p v-if="a.error" class="mt-1 truncate text-xs text-danger">{{ a.error }}</p>
          <p v-else-if="a.description" class="mt-1 line-clamp-2 text-xs text-fg-muted">{{ a.description }}</p>
          <p v-else-if="a.kind === 'edit' && changedFields(a).length" class="mt-1 text-xs text-fg-muted">
            Changed <span class="font-mono">{{ changedFields(a).join(', ') }}</span>
          </p>
          <div v-if="a.facts?.length || a.tags?.length" class="mt-2 flex flex-wrap items-center gap-1.5">
            <FactPill v-for="(f, i) in a.facts ?? []" :key="i" :label="f.k" :value="f.v" />
            <TagChip v-for="t in a.tags ?? []" :key="t" :tag="t" />
          </div>
          <p v-if="a.remediation" class="mt-2 flex items-start gap-1.5 text-xs text-fg">
            <Icon name="wrench" :size="12" class="mt-0.5 shrink-0 text-fg-subtle" />
            <span class="line-clamp-2">{{ a.remediation }}</span>
          </p>
        </RouterLink>
      </li>
    </ol>
    <p v-if="runs" class="mt-2 text-[11px] text-fg-subtle">{{ runs }} flow run{{ runs === 1 ? '' : 's' }} on this row.</p>

    <RunFlowDialog :open="dialog" :subjects="[{ kind, id }]" @close="dialog = false" @started="started" />
  </section>
</template>
