<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { ACTIVITY_KINDS, ACTIVITY_STATUSES, JSON_DOCS, SUBJECT_ICON, activityOpen, humanize, rowRoute, type FieldSpec } from '@/lib/pipeline'
import Icon from '@/components/Icon.vue'
import Badge from '@/components/pipeline/Badge.vue'
import FactChip from '@/components/pipeline/FactChip.vue'
import FactPill from '@/components/pipeline/FactPill.vue'
import TagChip from '@/components/pipeline/TagChip.vue'
import RecordEditor from '@/components/pipeline/RecordEditor.vue'
import RunFlowDialog from '@/components/pipeline/RunFlowDialog.vue'
import JsonPanel from '@/components/json/JsonPanel.vue'
import type { Activity, ActivityDetail, ActivityInput } from '@/api/types'

// One activity: what a flow (or a person) concluded about a row — the
// description, the remediation, the proof, the typed facts — with the run's
// bookkeeping and its full output document. An operator can correct or
// complete the outcome, re-sync a run, stop it, or run the same flow again.
const props = defineProps<{ id: string }>()
const conn = useConnectionStore()
const router = useRouter()

const detail = ref<ActivityDetail | null>(null)
const loading = ref(true)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const saveError = ref('')
const busy = ref('')
const dialog = ref(false)

const row = computed(() => detail.value?.item ?? null)
const subject = computed(() => detail.value?.subject ?? null)
const isRun = computed(() => row.value?.kind === 'run')
const inFlight = computed(() => activityOpen(row.value?.status))

// The edit diff of an `edit` activity, as rows for the table.
const changes = computed(() => {
  const changed = (row.value?.ref as { changed?: Record<string, { from: unknown; to: unknown }> } | undefined)?.changed
  return changed ? Object.entries(changed).map(([field, d]) => ({ field, from: d?.from, to: d?.to })) : []
})

const process = computed(() => (row.value?.ref as { process?: Record<string, unknown> } | undefined)?.process ?? null)

const duration = computed(() => {
  const ms = Number(process.value?.durationMs ?? 0)
  if (ms > 0) return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
  if (row.value?.startedAt && row.value?.finishedAt) {
    const d = new Date(row.value.finishedAt).getTime() - new Date(row.value.startedAt).getTime()
    return d < 1000 ? `${d} ms` : `${(d / 1000).toFixed(1)} s`
  }
  return ''
})

const FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Title', kind: 'text' },
  { key: 'kind', label: 'Kind', kind: 'select', options: ACTIVITY_KINDS },
  { key: 'status', label: 'Status', kind: 'select', options: ACTIVITY_STATUSES },
  { key: 'description', label: 'Description', kind: 'textarea', hint: 'What was concluded, in words.' },
  { key: 'remediation', label: 'Remediation', kind: 'textarea', hint: 'What to do about it.' },
  { key: 'proof', label: 'Proof', kind: 'textarea', hint: 'The evidence the conclusion rests on.' },
  { key: 'facts', label: 'Facts', kind: 'json', hint: 'A list of {"k": …, "v": …} or an object {key: value}.' },
  { key: 'tags', label: 'Tags', kind: 'tags' },
  { key: 'origin', label: 'Origin', kind: 'text', mono: true },
  { key: 'data', label: 'Data', kind: 'json' },
  { key: 'meta', label: 'Meta', kind: 'json' },
]

function fmt(v: unknown): string {
  if (v == null || v === '') return '—'
  return typeof v === 'string' ? v : JSON.stringify(v)
}

async function load(quiet = false) {
  if (!quiet) loading.value = true
  error.value = ''
  try {
    detail.value = await conn.client.getActivity(props.id)
  } catch (e) {
    detail.value = null
    error.value = apiErr(e)
  } finally {
    loading.value = false
  }
}

// Poll while the run is in flight.
let timer: ReturnType<typeof setInterval> | null = null
watch(inFlight, (open) => {
  if (open && !timer) timer = setInterval(() => load(true), 4000)
  if (!open && timer) {
    clearInterval(timer)
    timer = null
  }
})
onBeforeUnmount(() => timer && clearInterval(timer))

async function save(patch: Record<string, unknown>) {
  if (!row.value) return
  if (Object.keys(patch).length === 0) {
    editing.value = false
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    const updated: Activity = await conn.client.updateActivity(row.value.id, patch as ActivityInput)
    detail.value = { ...detail.value!, item: updated }
    editing.value = false
  } catch (e) {
    saveError.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function act(what: 'sync' | 'stop') {
  if (!row.value) return
  busy.value = what
  error.value = ''
  try {
    const updated = what === 'sync' ? await conn.client.syncActivity(row.value.id) : await conn.client.stopActivity(row.value.id)
    detail.value = { ...detail.value!, item: updated }
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    busy.value = ''
  }
}

async function remove() {
  if (!row.value || !window.confirm(`Delete activity #${row.value.id}?`)) return
  try {
    await conn.client.deleteActivity(row.value.id)
    router.push({ name: 'activities' })
  } catch (e) {
    error.value = apiErr(e)
  }
}

function started(list: Activity[]) {
  if (list[0]) router.push(rowRoute('activity', list[0].id))
}

watch(() => props.id, () => load())
onMounted(() => load())
</script>

<template>
  <div class="p-6">
    <div class="mb-3 flex items-center gap-2 text-xs text-fg-muted">
      <RouterLink :to="{ name: 'activities' }" class="inline-flex items-center gap-1 hover:text-accent">
        <Icon name="chevronLeft" :size="14" /> Activities
      </RouterLink>
      <span class="text-fg-subtle">/</span>
      <span class="font-mono">#{{ row?.id ?? '…' }}</span>
      <div class="ml-auto flex items-center gap-2">
        <button v-if="isRun && inFlight" class="btn-danger btn-sm" :disabled="!!busy" title="Stop the run on FloMorphic" @click="act('stop')">
          <Icon name="stop" :size="13" /> {{ busy === 'stop' ? 'Stopping…' : 'Stop' }}
        </button>
        <button v-if="isRun" class="btn-outline btn-sm" :disabled="!!busy" title="Pull the run's state from FloMorphic now" @click="act('sync')">
          <Icon name="refresh" :size="13" /> {{ busy === 'sync' ? 'Syncing…' : 'Sync' }}
        </button>
        <button v-if="row" class="btn-primary btn-sm" :disabled="editing" title="Run a flow on the same row" @click="dialog = true">
          <Icon name="play" :size="13" /> Run flow
        </button>
        <button v-if="!editing" class="btn-outline btn-sm" :disabled="!row" title="Correct or complete the outcome" @click="editing = true">
          <Icon name="pencil" :size="13" /> Edit
        </button>
        <button class="btn-danger btn-sm" :disabled="!row" title="Delete this activity" @click="remove">
          <Icon name="trash" :size="13" /> Delete
        </button>
        <button class="icon-btn-sm" title="Reload" @click="load()"><Icon name="refresh" :size="14" /></button>
      </div>
    </div>

    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
    <p v-if="loading && !row" class="text-sm text-fg-subtle">Loading…</p>

    <template v-else-if="row">
      <!-- header -->
      <div class="mb-5">
        <h1 class="text-xl font-semibold leading-tight text-fg">{{ row.title || `${humanize(row.kind)} #${row.id}` }}</h1>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Badge kind="activity-kind" :value="row.kind" size="md" />
          <Badge kind="activity-status" :value="row.status" size="md" />
          <RouterLink
            v-if="row.subjectKind"
            :to="rowRoute(row.subjectKind, row.subjectId)"
            class="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg hover:border-accent-border hover:text-accent"
            title="Open the row this activity is about"
          >
            <Icon :name="SUBJECT_ICON[row.subjectKind] ?? 'circleDot'" :size="13" class="text-fg-subtle" />
            <span class="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">{{ row.subjectKind }}</span>
            <span class="font-mono">#{{ row.subjectId }}</span>
            <span v-if="subject?.title" class="max-w-[16rem] truncate text-fg-muted">· {{ subject.title }}</span>
          </RouterLink>
          <FactChip icon="workflow" label="Flow" :value="row.flowTitle" />
          <FactChip icon="hash" label="Process" :value="row.processId ? String(row.processId) : ''" mono />
          <FactChip icon="clock" label="Took" :value="duration" />
          <FactChip icon="database" label="Origin" :value="row.origin" mono />
        </div>
        <div v-if="row.tags?.length" class="mt-2 flex flex-wrap items-center gap-1.5">
          <Icon name="tag" :size="13" class="text-fg-subtle" />
          <TagChip v-for="t in row.tags" :key="t" :tag="t" size="md" />
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-subtle">
          <span v-if="row.startedAt" :title="row.startedAt" class="inline-flex items-center gap-1"><Icon name="play" :size="11" />Started {{ relativeTime(row.startedAt) }}</span>
          <span v-if="row.finishedAt" :title="row.finishedAt" class="inline-flex items-center gap-1"><Icon name="checkCircle" :size="11" />Finished {{ relativeTime(row.finishedAt) }}</span>
          <span v-if="inFlight" class="inline-flex items-center gap-1 text-accent"><Icon name="loader" :size="11" class="animate-spin" />Still running — this page refreshes itself</span>
        </div>
        <p v-if="row.error" class="mt-3 flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          <Icon name="alertCircle" :size="14" class="mt-0.5 shrink-0" /><span class="break-words">{{ row.error }}</span>
        </p>
      </div>

      <div v-if="editing" class="card max-w-4xl p-4">
        <h3 class="label">Edit outcome</h3>
        <RecordEditor :fields="FIELDS" :row="row as unknown as Record<string, unknown>" :saving="saving" :error="saveError" @save="save" @cancel="editing = false" />
      </div>

      <div v-else class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <!-- left: the outcome -->
        <div class="min-w-0 space-y-5">
          <section v-if="row.facts?.length">
            <h3 class="label">Facts</h3>
            <div class="flex flex-wrap gap-1.5">
              <FactPill v-for="(f, i) in row.facts" :key="i" :label="f.k" :value="f.v" />
            </div>
          </section>

          <section>
            <h3 class="label">Description</h3>
            <div class="card p-4 text-sm leading-relaxed text-fg">
              <p v-if="row.description" class="whitespace-pre-wrap break-words">{{ row.description }}</p>
              <p v-else class="text-fg-subtle">
                {{ inFlight ? 'The run has not concluded yet.' : isRun ? 'The flow left no description in $.outcome.' : 'No description.' }}
              </p>
            </div>
          </section>

          <section v-if="row.remediation || isRun">
            <h3 class="label flex items-center gap-1.5"><Icon name="wrench" :size="12" /> Remediation</h3>
            <div class="card p-4 text-sm leading-relaxed text-fg">
              <p v-if="row.remediation" class="whitespace-pre-wrap break-words">{{ row.remediation }}</p>
              <p v-else class="text-fg-subtle">No remediation proposed.</p>
            </div>
          </section>

          <section v-if="row.proof || isRun">
            <h3 class="label flex items-center gap-1.5"><Icon name="shield" :size="12" /> Proof</h3>
            <div class="card p-4 text-sm leading-relaxed text-fg">
              <p v-if="row.proof" class="whitespace-pre-wrap break-words font-mono text-xs">{{ row.proof }}</p>
              <p v-else class="text-fg-subtle">No evidence attached.</p>
            </div>
          </section>

          <section v-if="changes.length">
            <h3 class="label">Changed fields</h3>
            <div class="card overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead class="bg-surface-2 text-left uppercase tracking-wide text-fg-muted">
                  <tr><th class="px-3 py-1.5">Field</th><th class="px-3 py-1.5">From</th><th class="px-3 py-1.5">To</th></tr>
                </thead>
                <tbody class="divide-y divide-line">
                  <tr v-for="c in changes" :key="c.field" class="align-top">
                    <td class="px-3 py-1.5 font-mono text-fg">{{ c.field }}</td>
                    <td class="max-w-xs break-words px-3 py-1.5 font-mono text-fg-muted line-through decoration-line/60">{{ fmt(c.from) }}</td>
                    <td class="max-w-xs break-words px-3 py-1.5 font-mono text-fg">{{ fmt(c.to) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section v-if="isRun">
            <h3 class="label">Run</h3>
            <dl class="divide-y divide-line rounded-md border border-line text-xs">
              <div class="flex gap-3 px-3 py-1.5"><dt class="w-28 shrink-0 text-fg-muted">Flow</dt><dd class="min-w-0 flex-1 break-all font-mono text-fg">{{ row.flowTitle }} <span class="text-fg-subtle">{{ row.flowId }}</span></dd></div>
              <div class="flex gap-3 px-3 py-1.5"><dt class="w-28 shrink-0 text-fg-muted">Process</dt><dd class="min-w-0 flex-1 break-all font-mono text-fg">{{ row.processId || '—' }}</dd></div>
              <div class="flex gap-3 px-3 py-1.5"><dt class="w-28 shrink-0 text-fg-muted">PID</dt><dd class="min-w-0 flex-1 break-all font-mono text-fg">{{ row.pid || '—' }}</dd></div>
              <div class="flex gap-3 px-3 py-1.5"><dt class="w-28 shrink-0 text-fg-muted">Context doc</dt><dd class="min-w-0 flex-1 break-all font-mono text-fg">{{ row.contextId || '—' }}</dd></div>
            </dl>
          </section>
        </div>

        <!-- right: the documents -->
        <div class="min-w-0 space-y-4">
          <JsonPanel
            v-for="d in JSON_DOCS"
            :key="d.key"
            :title="d.key === 'data' ? 'Output' : d.label"
            :hint="d.key === 'data' ? 'The run\'s full output document — everything the flow left in its context.' : d.key === 'ref' ? 'Run bookkeeping, or the field diff of an edit.' : d.hint"
            :value="row[d.key]"
            :collapsed="d.key !== 'data'"
          />
        </div>
      </div>

      <RunFlowDialog :open="dialog" :subjects="[{ kind: row.subjectKind, id: row.subjectId }]" @close="dialog = false" @started="started" />
    </template>
  </div>
</template>
