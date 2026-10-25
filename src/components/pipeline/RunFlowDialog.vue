<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import Icon from '@/components/Icon.vue'
import FlomorphicLink from '@/components/FlomorphicLink.vue'
import FlowEntryFields from '@/components/pipeline/FlowEntryFields.vue'
import { entryDefaults, entryFields, entryHasForm, entryTarget, missingRequired } from '@/lib/flowEntry'
import { absoluteTime, relativeTime } from '@/lib/format'
import type { Activity, FlowEntryView, FlowSummary, FlowTagOperation, SubjectKind } from '@/api/types'

// "Run a flow on this row": pick one of the FloMorphic flows (listed live from
// FloMorphic), optionally name the activity, and launch. Each subject becomes
// one run + one `run` activity; the outcome lands on the row's timeline when
// the process ends. The flow author is responsible for reading the row's data
// model ($.row.…) and leaving a conclusion in $.outcome.
//
// LABEL FILTER. A FloMorphic canvas is shared: an install with a few operations
// on it, plus whatever was drawn by hand, lists dozens of flows here, and an
// operator applying GDPR's finding review has no business scrolling past the fraud
// sweeps. Flows carry labels (a operation stamps its `flowTags` on the flows it
// installs), so filtering is a `tags=` on the list call — FloMorphic narrows it,
// which is why a filtered list cannot lose a flow off the end of the 200-row
// page.
//
// `activeTags` is the ONE piece of filter state, and both chip rows write to it:
// a operation chip replaces it with that operation's whole label set, a label
// chip toggles one label (match ANY — more labels means more flows, not fewer).
// A operation chip therefore reads as selected exactly when the active set IS
// its set, with no second ref to drift out of step.
//
// The filter is opt-in and always escapable: the dialog opens on every flow,
// exactly as it did before flows had labels, and "All flows" is the first chip
// in the row rather than something to go looking for.
//
// ENTRY FORM. Picking a flow used to be the whole dialog, plus a bare JSON box
// for "extra input" that only worked if the operator already knew the shape the
// flow reads — the knowledge lived in the flow's graph and nowhere an operator
// could see it. A flow designer can now declare the input a flow needs
// (FloMorphic's `preferences.entry`), so selecting a flow loads that
// declaration and renders it as a form (FlowEntryFields, in either of its two
// authoring styles, with a raw-JSON view behind both).
//
// The values travel with the launch as `entry`, NOT as part of the context
// document this app builds: FloMorphic validates them against the flow's own
// schema and seeds them at the one path the entry names, so a flow reads its
// answers where its designer said it would.
//
// WHAT WENT. The dialog used to offer a second, untyped box that dropped
// whatever was typed at `$.input`. Nothing declared that slot, so a node read
// it only if its author happened to write `$.input.*` by hand — no flow on this
// install does — and nothing checked what went in. A launch input the flow
// itself describes makes that box not a second channel but a worse one, so it
// is gone from here: what a run can be given is what its flow asked for. The
// `input` field still exists on POST /api/activities/run for an API caller, and
// an operation's entry run still builds its own `$.input.params` server-side;
// neither is something an operator types into a row's run dialog.
//
// A flow that declares no entry is launched exactly as before — the form is an
// addition to the dialog, never a gate in front of it, which is also why an
// unreachable resolve falls back to the declaration the list already carried
// rather than hiding the form.
const props = defineProps<{
  open: boolean
  subjects: { kind: SubjectKind; id: number | string }[]
}>()
const emit = defineEmits<{ close: []; started: [activities: Activity[]] }>()

const conn = useConnectionStore()
const flows = ref<FlowSummary[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')
// The installed operations and their labels, for the filter row. Derived from
// installed packages on the API side, so it loads even when FloMorphic is down
// — the filter still renders beside the error about the flow list.
const operations = ref<FlowTagOperation[]>([])
/** Labels declared by installed operations (from /api/flows/tags). */
const facetTags = ref<string[]>([])
/** Labels actually seen on flows loaded in this dialog — so a label someone put
 *  on a hand-drawn flow is filterable too, not just the ones a package declared.
 *  It only grows while the dialog is open: a narrowed list must not make the
 *  chip that narrowed it disappear. */
const seenTags = ref<string[]>([])
/** The active filter: match ANY of these labels. Empty is "all flows". */
const activeTags = ref<string[]>([])
const selected = ref<FlowSummary | null>(null)
const title = ref('')
const running = ref(false)

// ---- the selected flow's entry form ------------------------------------------
/** The entry form as FloMorphic resolves it for a launch; null until a flow is
 *  picked, and `entry: null` for a flow that asks for nothing. */
const entryView = ref<FlowEntryView | null>(null)
/** What the operator has filled in — what goes up as `entry`. */
const entryValues = ref<Record<string, unknown>>({})
const entryLoading = ref(false)
/** False while a JSON cell (or the raw view) does not parse. */
const entryValid = ref(true)
/** Set when the resolve failed and the form on screen is the declared one with
 *  its own defaults — worth saying, since the starting values may differ from
 *  what FloMorphic would have handed back. */
const entryNotice = ref('')
/** Whether the fields currently hold the last run's values rather than the
 *  flow's defaults. It only labels the two chips; the values themselves are
 *  the operator's to edit either way. */
const usingLastRun = ref(false)

/** The form the selected flow declares, or null for a flow that asks nothing. */
const entryForm = computed(() => entryView.value?.entry ?? null)

/**
 * What the previous run of this flow was given, when the engine still holds it.
 *
 * This is the one thing FloMorphic's `live` prefill cannot do for venapce: it
 * reads the context a run will go against, and every run here gets a context
 * built at launch, so "what did we send last time" would be lost even though
 * the engine recorded it on the process row.
 *
 * These values are what the form OPENS on when they exist: an operator running
 * a flow again is answering the same question again, and retyping an answer the
 * engine already recorded is work the dialog can simply not ask for. The
 * designer's declared defaults are never out of reach — they are the other
 * chip, labelled, and what the form falls back to for a flow that has never
 * run. Applying them is also why `useLastRun` layers over those defaults rather
 * than replacing them: a field added to the form since that run opens where the
 * flow says it should, not empty.
 */
const lastRun = computed(() => entryView.value?.last ?? null)

/** When and where those values were used, for the chip's tooltip. */
const lastRunWhen = computed(() => {
  const l = lastRun.value
  if (!l) return ''
  const when = l.at ? `${relativeTime(l.at)} (${absoluteTime(l.at)})` : 'an earlier run'
  const where = l.sameSubject
    ? 'this row'
    : l.subjectKind && l.subjectId
      ? `${l.subjectKind} #${l.subjectId}`
      : 'another row'
  return `Fill the form with what this flow was given ${when}, on ${where}`
})
const hasEntry = computed(() => !!entryForm.value)
/** Required fields still empty. The engine refuses such a launch itself; this
 *  only spares the operator the round trip to be told so. */
const missing = computed(() =>
  entryForm.value ? missingRequired(entryFields(entryForm.value), entryValues.value) : [],
)
/**
 * A required form with nothing in it at all.
 *
 * FloMorphic accepts a required entry that is already satisfied by whatever
 * sits at the target in the run's context — but venapce builds that context at
 * launch, so there is never anything there and an empty submission is refused.
 * Saying so here keeps the refusal in front of the form instead of on the
 * activity timeline.
 */
const entryEmpty = computed(() => !!entryForm.value?.required && Object.keys(entryValues.value).length === 0)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? flows.value.filter((f) => f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)) : flows.value
})

/** The operation whose label set is exactly the active filter, if any — what
 *  highlights one operation chip and names the filter in the empty state. */
const activeOperation = computed(
  () =>
    operations.value.find(
      (op) => op.tags.length === activeTags.value.length && op.tags.every((t) => activeTags.value.includes(t)),
    ) ?? null,
)

/** The label chips to offer. A operation's identity label (`operation:<slug>`)
 *  is left out: that operation already has a chip of its own, under its real
 *  name, and offering both says the same thing twice in a worse way. */
const availableTags = computed(() => {
  const identity = new Set(operations.value.map((op) => `operation:${op.slug}`))
  const all = new Set([...facetTags.value, ...seenTags.value, ...activeTags.value])
  return [...all].filter((t) => !identity.has(t) || activeTags.value.includes(t)).sort()
})

const subjectLabel = computed(() => {
  const s = props.subjects
  if (s.length === 1) return `${s[0]!.kind} #${s[0]!.id}`
  return `${s.length} rows`
})

/** Everything the launch needs: a flow, an entry form whose JSON parses, and no
 *  field the engine would refuse it over. */
const canRun = computed(
  () =>
    !!selected.value &&
    entryValid.value &&
    missing.value.length === 0 &&
    !entryEmpty.value &&
    !running.value,
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    flows.value = await conn.client.listFlows('', activeTags.value)
    // Remember every label the list carried, so it stays offerable once the
    // list is narrowed past it.
    const next = new Set(seenTags.value)
    for (const f of flows.value) for (const t of f.tags ?? []) next.add(t)
    seenTags.value = [...next]
  } catch (e) {
    error.value = apiErr(e)
    flows.value = []
  } finally {
    loading.value = false
  }
}

// The filter menu. A failure here is not worth an error banner: without it the
// dialog still offers the labels it sees on the flows themselves.
async function loadOperations() {
  try {
    const facets = await conn.client.listFlowTags()
    operations.value = facets.operations
    facetTags.value = facets.tags
  } catch {
    operations.value = []
    facetTags.value = []
  }
}

/** Apply a filter and reload (the filter is FloMorphic's, not this list's),
 *  dropping a selected flow that the narrowed list no longer holds. */
async function applyFilter(tags: string[]) {
  activeTags.value = tags
  await load()
  if (selected.value && !flows.value.some((f) => f.id === selected.value?.id)) {
    // The selection went with the filter, and so must the form it loaded.
    selected.value = null
    entryView.value = null
    entryValues.value = {}
    entryNotice.value = ''
  }
}

/** Filter by one operation's whole label set — or by nothing, for "All flows". */
function filterByOperation(op: FlowTagOperation | null) {
  return applyFilter(op ? [...op.tags] : [])
}

/** Add or remove one label. Match ANY, so a second label widens the list. */
function toggleTag(tag: string) {
  return applyFilter(
    activeTags.value.includes(tag) ? activeTags.value.filter((t) => t !== tag) : [...activeTags.value, tag],
  )
}

/**
 * A flow was picked: load what it asks for.
 *
 * The resolve is always asked for rather than inferred from the list row — the
 * list says whether a flow HAS a form, the call says where its fields should
 * start, and only one of those two can be got right here. A flow that declares
 * nothing answers `entry: null`, which costs one small call and leaves the
 * dialog exactly as it was before flows could ask for input.
 */
async function choose(f: FlowSummary) {
  selected.value = f
  entryView.value = null
  entryValues.value = {}
  entryValid.value = true
  entryNotice.value = ''
  usingLastRun.value = false
  entryLoading.value = true
  try {
    // One row: ask for ITS last run of this flow. A bulk launch has no single
    // history to borrow from, so it gets the flow's last run anywhere.
    const only = props.subjects.length === 1 ? props.subjects[0] : undefined
    const view = await conn.client.getFlowEntry(f.id, only)
    entryView.value = view
    // Open on the last run's answers whenever there are any. Re-running a flow
    // nearly always means running it again the same way, and the two chips make
    // the other choice one click away — so the common finding costs no typing and
    // the uncommon one costs no explaining.
    if (view.last) useLastRun()
    else useDefaults()
  } catch (e) {
    // The list row already carried the declaration; what the call adds is the
    // starting values. Falling back to the declared defaults keeps the form on
    // screen, because an unreachable resolve is not a flow with no input — and
    // a flow we know nothing about is launched the way it always was.
    const form = f.preferences?.entry
    if (entryHasForm(form)) {
      const values = entryDefaults(form)
      entryView.value = { entry: form!, target: entryTarget(form), prefill: 'default', values, source: 'default' }
      entryValues.value = { ...values }
      entryNotice.value = `Showing the form the flow declares — its starting values could not be read (${apiErr(e)}).`
    }
  } finally {
    entryLoading.value = false
  }
}

/** Put the previous run's answers in the fields, over the declared defaults —
 *  so a field added to the form since that run still shows what the flow would
 *  do on its own instead of coming up empty. */
function useLastRun() {
  const l = lastRun.value
  if (!l) return
  entryValues.value = { ...(entryView.value?.values ?? {}), ...l.values }
  usingLastRun.value = true
}

/** Back to what the flow itself declares. */
function useDefaults() {
  entryValues.value = { ...(entryView.value?.values ?? {}) }
  usingLastRun.value = false
}

async function run() {
  const flow = selected.value
  if (!flow || !canRun.value) return
  running.value = true
  error.value = ''
  try {
    const res = await conn.client.runFlow({
      flowId: flow.id,
      subjects: props.subjects,
      title: title.value.trim() || undefined,
      // The flow's own form, seeded by the engine at the path the entry names.
      // Only sent for a flow that asks for it: an `entry` on a flow with no
      // form would be a seed with nowhere to go.
      entry: hasEntry.value ? entryValues.value : undefined,
    })
    if (res.error) error.value = res.error
    emit('started', res.activities)
    if (!res.error) emit('close')
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    running.value = false
  }
}

watch(
  () => props.open,
  (o) => {
    if (o) {
      selected.value = null
      entryView.value = null
      entryValues.value = {}
      entryValid.value = true
      entryNotice.value = ''
      usingLastRun.value = false
      title.value = ''
      search.value = ''
      // Open unfiltered every time: the last operator's operation is not this
      // operator's, and a filter they did not set is a flow they cannot find.
      activeTags.value = []
      seenTags.value = []
      load()
      loadOperations()
    }
  },
)
onMounted(() => {
  if (props.open) {
    load()
    loadOperations()
  }
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden">
      <div class="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="workflow" :size="16" class="text-accent" />
        <h2 class="text-sm font-semibold text-fg">Run a flow on {{ subjectLabel }}</h2>
        <button class="icon-btn-sm ml-auto" title="Close" @click="emit('close')"><Icon name="close" :size="14" /></button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <p class="mb-3 text-xs text-fg-muted">
          The row is handed to the flow as its context document — the flow reads it through
          <code class="font-mono">$.row</code> and leaves what it concludes in <code class="font-mono">$.outcome</code>
          (title, description, remediation, proof, facts, tags). The result shows up on the row's activity timeline
          when the run ends.
        </p>

        <!-- Filter rows. Only drawn when there is something to narrow by — on a
             plain install with unlabelled flows they would be furniture.
             "All flows" leads, so clearing is never a hunt. -->
        <div v-if="operations.length" class="mb-2 flex flex-wrap items-center gap-1.5">
          <Icon name="box" :size="13" class="shrink-0 text-fg-subtle" title="Operations" />
          <button
            class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
            :class="activeTags.length === 0 ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
            title="Every flow on the FloMorphic canvas"
            @click="filterByOperation(null)"
          >
            All flows
          </button>
          <button
            v-for="op in operations"
            :key="op.slug"
            class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              activeOperation?.slug === op.slug
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'
            "
            :title="`Only the flows ${op.name} installed (${op.tags.join(', ')})`"
            @click="filterByOperation(op)"
          >
            {{ op.name }}
          </button>
        </div>

        <!-- The labels themselves, as badges: finer than a whole operation (one
             operation's finding reviews, say) and the only way to reach a label
             someone put on a hand-drawn flow. Multi-select, match ANY — a
             second badge widens the list. -->
        <div v-if="availableTags.length" class="mb-2 flex flex-wrap items-center gap-1.5">
          <Icon name="tag" :size="13" class="shrink-0 text-fg-subtle" title="Labels" />
          <button
            v-for="t in availableTags"
            :key="t"
            class="rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
            :class="
              activeTags.includes(t)
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'
            "
            :title="activeTags.includes(t) ? `Stop filtering by ${t}` : `Also show flows labelled ${t}`"
            @click="toggleTag(t)"
          >
            {{ t }}
          </button>
          <button
            v-if="activeTags.length"
            class="ml-0.5 inline-flex items-center gap-1 text-[11px] text-fg-subtle underline-offset-2 hover:text-accent hover:underline"
            title="Show every flow again"
            @click="filterByOperation(null)"
          >
            <Icon name="close" :size="10" /> Clear
          </button>
        </div>

        <div class="mb-2 flex items-center gap-2">
          <input v-model="search" class="field" placeholder="Search flows…" />
          <button class="icon-btn-sm" title="Reload flows" :disabled="loading" @click="load"><Icon name="refresh" :size="14" /></button>
        </div>
        <p v-if="error" class="mb-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{{ error }}</p>
        <p v-if="loading" class="text-xs text-fg-subtle">Loading flows…</p>
        <!-- An empty filtered list is not an empty canvas; say which it is and
             offer the way back. -->
        <div
          v-else-if="filtered.length === 0 && activeTags.length"
          class="rounded-md border border-dashed border-line p-4 text-center text-xs text-fg-subtle"
        >
          No flow
          <template v-if="activeOperation">
            of <span class="font-medium text-fg">{{ activeOperation.name }}</span>
          </template>
          <template v-else>
            labelled <span class="font-medium text-fg">{{ activeTags.join(' or ') }}</span>
          </template>
          is on the canvas{{ search.trim() ? ' under that search' : ' yet' }}.
          <button class="ml-1 text-accent underline-offset-2 hover:underline" @click="filterByOperation(null)">
            Show all flows
          </button>
        </div>
        <div v-else-if="filtered.length === 0" class="rounded-md border border-dashed border-line p-4 text-center text-xs text-fg-subtle">
          No flows found. Design one in FloMorphic first.
        </div>
        <ul v-else class="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line">
          <li
            v-for="f in filtered"
            :key="f.id"
            class="flex items-center gap-1 pr-2 transition-colors hover:bg-accent-soft"
            :class="selected?.id === f.id ? 'bg-accent-soft' : ''"
          >
            <!-- Two lines, because the title is what an operator picks by: on
                 one line the labels and the id (neither of which shrinks) left
                 a labelled flow's title no width at all. -->
            <button
              type="button"
              class="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left text-sm"
              :class="selected?.id === f.id ? 'text-accent' : 'text-fg'"
              @click="choose(f)"
            >
              <Icon :name="selected?.id === f.id ? 'checkCircle' : 'workflow'" :size="14" class="mt-0.5 shrink-0" />
              <span class="min-w-0 flex-1">
                <span class="flex min-w-0 items-center gap-1.5">
                  <span class="min-w-0 truncate" :title="f.title">{{ f.title }}</span>
                  <!-- This flow asks for input before it runs. Said here, in
                       the list, so an operator knows there is a form coming
                       before they pick — not after. -->
                  <Icon
                    v-if="f.preferences?.entry"
                    name="sliders"
                    :size="12"
                    class="shrink-0 text-accent"
                    title="This flow asks for input before it runs"
                  />
                </span>
                <!-- The flow's labels: which operation it belongs to, visible
                     without filtering by it first. The id gives way first —
                     it tells apart flows the operator has already read by
                     name, so an ellipsis there costs nothing. -->
                <span class="mt-0.5 flex min-w-0 items-center gap-1">
                  <span class="min-w-0 flex-1 truncate font-mono text-[10px] text-fg-subtle" :title="f.id">{{ f.id }}</span>
                  <span v-if="f.tags?.length" class="flex shrink-0 gap-1">
                    <span
                      v-for="t in f.tags.slice(0, 2)"
                      :key="t"
                      class="max-w-[7rem] truncate rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-fg-muted"
                      :title="t"
                    >
                      {{ t }}
                    </span>
                    <span v-if="f.tags.length > 2" class="text-[10px] text-fg-subtle" :title="f.tags.join(', ')">
                      +{{ f.tags.length - 2 }}
                    </span>
                  </span>
                </span>
              </span>
            </button>
            <!-- Read the flow before handing it a row: a list of titles says
                 nothing about what the thing actually does. -->
            <FlomorphicLink kind="flow" :id="f.id" icon-only />
          </li>
        </ul>

        <div class="mt-4 grid gap-3">
          <label class="block">
            <span class="label">Activity title <span class="font-normal text-fg-subtle">(optional)</span></span>
            <input v-model="title" class="field" :placeholder="selected?.title || 'The flow\'s title'" />
          </label>

          <!-- What the selected flow asks for, as its designer declared it.
               Drawn only for a flow that declares something: the dialog of a
               flow that asks nothing is the dialog it always was. -->
          <p v-if="entryLoading" class="text-xs text-fg-subtle">Loading what this flow asks for…</p>
          <div v-else-if="entryForm" class="rounded-md border border-line p-3">
            <div class="mb-2 flex items-start gap-2">
              <Icon name="sliders" :size="14" class="mt-0.5 shrink-0 text-accent" />
              <div class="min-w-0 flex-1">
                <p class="text-xs font-semibold text-fg">{{ entryForm.title || `What ${selected?.title} needs` }}</p>
                <p v-if="entryForm.description" class="mt-0.5 text-[11px] leading-relaxed text-fg-subtle">
                  {{ entryForm.description }}
                </p>
                <p v-else class="mt-0.5 text-[11px] text-fg-subtle">
                  The flow declares this input; it is seeded into the run before the graph starts.
                </p>
              </div>
              <!-- Which answers the fields hold. The last run's win on open,
                   because a re-run nearly always wants them; the Defaults chip
                   is how an operator gets back to what the flow's designer
                   declared, which is what they want when a default has changed
                   since that run. Both stay visible so the form never silently
                   holds a value from somewhere unnamed. -->
              <div v-if="lastRun" class="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
                  :class="
                    usingLastRun
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'
                  "
                  :title="lastRunWhen"
                  @click="useLastRun"
                >
                  <Icon name="history" :size="11" /> Last run
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
                  :class="
                    !usingLastRun
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'
                  "
                  title="Back to the values the flow itself declares"
                  @click="useDefaults"
                >
                  Defaults
                </button>
              </div>
            </div>

            <!-- Where these values came from, since "last run" is only the same
                 thing as "this row's last run" some of the time — and the
                 fields are holding them, so an unnamed source would be worse
                 than no offer at all. -->
            <p v-if="usingLastRun && lastRun && !lastRun.sameSubject" class="mb-2 text-[11px] text-fg-subtle">
              <Icon name="info" :size="11" />
              These are the answers from this flow's last run on
              <span class="font-medium text-fg">{{ lastRun.subjectKind }} #{{ lastRun.subjectId }}</span
              >, not this row.
            </p>

            <FlowEntryFields
              v-model="entryValues"
              :entry="entryForm"
              :disabled="running"
              @update:valid="entryValid = $event"
            />

            <p v-if="entryNotice" class="mt-2 text-[11px] text-fg-subtle">{{ entryNotice }}</p>
            <!-- A required field left empty: the engine refuses the launch, so
                 say which one while the form is still on screen. -->
            <p v-if="missing.length" class="mt-2 text-[11px] text-danger">
              Still needed: {{ missing.join(', ') }}.
            </p>
            <p v-else-if="entryEmpty" class="mt-2 text-[11px] text-danger">
              This flow will not run without its input — fill in at least one field.
            </p>
            <!-- One form, N rows: worth saying before a bulk launch seeds the
                 same values into every run. -->
            <p v-if="subjects.length > 1" class="mt-2 text-[11px] text-fg-subtle">
              Every one of the {{ subjects.length }} runs is seeded with these values.
            </p>
          </div>
          <!-- Nothing to fill in is worth saying out loud: with the old
               untyped box gone, an empty space under the title would otherwise
               read as a dialog that failed to finish loading. -->
          <p v-else-if="selected" class="flex items-center gap-2 text-[11px] text-fg-subtle">
            <Icon name="info" :size="13" />
            This flow asks for no input — it runs on the row as it stands.
          </p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
        <button class="btn-ghost btn-sm" @click="emit('close')">Cancel</button>
        <button class="btn-primary btn-sm" :disabled="!canRun" @click="run">
          <Icon name="play" :size="13" /> {{ running ? 'Starting…' : `Run on ${subjectLabel}` }}
        </button>
      </div>
    </div>
  </div>
</template>
