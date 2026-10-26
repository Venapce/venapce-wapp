<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useFlomorphicStore } from '@/stores/flomorphic'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { renderMarkdown } from '@/lib/markdown'
import { homeUrl, openInFlomorphic, panelBase } from '@/lib/flomorphicLinks'
import { runErrors } from '@/lib/runErrors'
import { ROLE_CLASS, ROLE_ICON, ROLE_LABEL, SCALE_LABEL, describeCron, effectiveParams, flowsByStep, substituteParams } from '@/lib/operations'
import Icon from '@/components/Icon.vue'
import FlomorphicLink from '@/components/FlomorphicLink.vue'
import Badge from '@/components/pipeline/Badge.vue'
import RunErrorBadge from '@/components/pipeline/RunErrorBadge.vue'
import RunErrorList from '@/components/pipeline/RunErrorList.vue'
import ActivityTimeline from '@/components/pipeline/ActivityTimeline.vue'
import ReadinessList from '@/components/operations/ReadinessList.vue'
import ParamsForm from '@/components/operations/ParamsForm.vue'
import SettingsPlanList from '@/components/operations/SettingsPlanList.vue'
import FlowPickerDialog from '@/components/operations/FlowPickerDialog.vue'
import type { Activity, FlowSummary, OperationDetail, OperationFlowState, OperationSettingsPlan } from '@/api/types'

// One operation: the manifest it was installed from, the readiness checklist
// against this estate, its parameters, and its flows — each either bound to
// a FloMorphic flow (Open / Run) or still to be installed / linked. The
// timeline at the bottom is the operation's own history: every entry run
// started from here, with what it produced.
const props = defineProps<{ id: string }>()

const conn = useConnectionStore()
const flo = useFlomorphicStore()
const router = useRouter()

const op = ref<OperationDetail | null>(null)
const loading = ref(true)
const error = ref('')
const notice = ref('')
const busy = ref('') // the flow key (or action) in flight
const params = ref<Record<string, unknown>>({})
const paramsDirty = ref(false)
const picker = ref<OperationFlowState | null>(null)
const timeline = ref<InstanceType<typeof ActivityTimeline> | null>(null)

// The plugins and node settings profiles the package cannot carry, read back
// from FloMorphic: which provider nodes are bound and which are still waiting.
// Its own call — it reads every bound flow — so the page paints without it.
const plan = ref<OperationSettingsPlan | null>(null)
const planBusy = ref(false)
const planError = ref('')
async function loadPlan() {
  planBusy.value = true
  planError.value = ''
  try {
    plan.value = await conn.client.getOperationSettings(props.id)
  } catch (e) {
    plan.value = null
    planError.value = apiErr(e)
  } finally {
    planBusy.value = false
  }
}

// Where the FloMorphic web app is, for every "open in FloMorphic" on this page.
// It comes from Settings → FloMorphic web app, which defaults to the port the
// standard compose publishes — so it always resolves to something, and changing
// it is a trip to Settings rather than a prompt answered per browser.
const panelUrl = computed(() => panelBase())

const readme = computed(() => (op.value?.readme ? renderMarkdown(op.value.readme) : ''))
// Each flow with its last run's error ledger resolved alongside it — the chip,
// the expansion and the expanded list would each re-derive it otherwise.
const steps = computed(() => flowsByStep(op.value?.flows ?? []).map((f) => ({ ...f, errs: runErrors(f.lastRun) })))
const multiStep = computed(() => steps.value.some((f) => f.step))
const entry = computed(() => op.value?.flows.filter((f) => f.role === 'entry') ?? [])
// Which flows have their doc expanded (by key).
const docOpen = ref<Set<string>>(new Set())
// Which flows have their last run's error ledger listed out (by key).
const errorsOpen = ref<Set<string>>(new Set())
function toggleErrors(key: string) {
  const next = new Set(errorsOpen.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  errorsOpen.value = next
}
function toggleDoc(key: string) {
  const next = new Set(docOpen.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  docOpen.value = next
}
function flowDoc(f: OperationFlowState): string {
  const text = op.value?.flowDocs?.[f.key]
  return text ? renderMarkdown(text) : ''
}
const bound = computed(() => op.value?.flows.filter((f) => f.flowId).length ?? 0)
const hasParams = computed(() => !!op.value?.manifest.params && Object.keys(op.value.manifest.params).length > 0)

async function load(quiet = false) {
  if (!quiet) loading.value = true
  error.value = ''
  try {
    apply(await conn.client.getOperation(props.id))
  } catch (e) {
    if (!quiet) error.value = apiErr(e)
  } finally {
    loading.value = false
  }
}
function apply(d: OperationDetail) {
  op.value = d
  params.value = { ...(d.params ?? {}) }
  paramsDirty.value = false
}

function flash(msg: string) {
  notice.value = msg
  setTimeout(() => (notice.value = ''), 4000)
}

/** Every action goes through here: run it, apply the returned detail, show what went wrong. */
async function act(key: string, fn: () => Promise<OperationDetail | void>, done?: string) {
  busy.value = key
  error.value = ''
  try {
    const res = await fn()
    if (res) apply(res)
    if (done) flash(done)
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    busy.value = ''
  }
}

const saveParams = () =>
  act('params', () => conn.client.saveOperationParams(props.id, params.value), 'Parameters saved — re-install the flows for them to take effect in FloMorphic.')
// Installing writes the whole flow document, so every node's settings profile
// comes back unbound — the plan is re-read to say which ones, and the notice
// says it outright.
const installFlow = async (f: OperationFlowState) => {
  await act(f.key, () => conn.client.installOperationFlow(props.id, f.key), `"${f.title || f.key}" installed into FloMorphic — check its node settings below.`)
  await loadPlan()
}
// A newer package can add nodes that need a profile, so the plan is re-read.
const update = async () => {
  await act('update', () => conn.client.updateOperation(props.id), 'Package re-read from its source.')
  await loadPlan()
}
// Labels are stamped when a flow is installed, so an operation installed before
// flow labels existed (or one whose manifest labels changed since) has bound
// flows the Run-flow picker's filter cannot find. This relabels them in place —
// no graph is re-pushed, so nothing edited on the canvas is lost.
const relabel = () =>
  act('relabel', async () => {
    const res = await conn.client.relabelOperationFlows(props.id)
    const failed = Object.keys(res.failed ?? {})
    error.value = failed.length ? `Could not label: ${failed.join(', ')}.` : ''
    flash(
      res.labelled === 0
        ? 'No bound flow to label yet — install a flow first.'
        : `Labelled ${res.labelled} flow${res.labelled === 1 ? '' : 's'} with ${res.labels.join(', ')}. The Run-flow picker can filter by this operation now.`,
    )
  })
const pullFlow = (f: OperationFlowState) =>
  window.confirm(
    `Replace the package's "${f.file}" with the flow as it is on the FloMorphic canvas now? Any \${param.…} placeholders in the file are replaced by the canvas values.`,
  ) && act('pull:' + f.key, () => conn.client.pullOperationFlow(props.id, f.key), `"${f.title || f.key}" pulled from FloMorphic into the package.`)

/** Download the installed package as a zip (one folder, the catalog layout). */
function exportZip() {
  window.open(conn.client.operationPackageUrl(props.id), '_blank', 'noopener')
}

async function remove() {
  if (!op.value || !window.confirm(`Remove "${op.value.name}"? Its flows stay in FloMorphic; only the package and its history here are removed.`)) return
  await act('delete', async () => {
    await conn.client.deleteOperation(props.id)
    router.push({ name: 'operations' })
  })
}

function pickFlow(flow: FlowSummary) {
  const f = picker.value
  picker.value = null
  if (!f) return
  void act(f.key, () => conn.client.linkOperationFlow(props.id, f.key, flow.id), `"${f.title || f.key}" linked to ${flow.title}.`).then(loadPlan)
}

async function run(f: OperationFlowState) {
  await act('run:' + f.key, async () => {
    const res = await conn.client.runOperation(props.id, { flowKey: f.key })
    if (res.error) throw new Error(res.error)
    timeline.value?.reload()
    flash(`Run started (${res.activities.length} activit${res.activities.length === 1 ? 'y' : 'ies'}).`)
  })
}

/** The flow file with the current params substituted — for a manual import in FloMorphic. */
async function copyFlowFile(f: OperationFlowState) {
  if (!op.value) return
  await act('copy:' + f.key, async () => {
    let text = await conn.client.operationFlowFile(props.id, f.key)
    try {
      text = JSON.stringify(substituteParams(JSON.parse(text), effectiveParams(op.value!.manifest, params.value)), null, 2)
    } catch {
      /* the backend already substituted, or the file is not JSON — copy as is */
    }
    await navigator.clipboard.writeText(text)
    flash('Flow JSON copied — paste it into FloMorphic → Workflows → Import, then link the flow here.')
  })
}

function openFlow(f: OperationFlowState) {
  if (!f.flowId) return
  openInFlomorphic('flow', f.flowId)
}

function sourceLabel(): string {
  const s = op.value?.source
  if (!s) return ''
  if (s.kind === 'url') return `${s.url}${s.path ? ' · ' + s.path : ''}${s.ref ? ' @' + s.ref : ''}`
  if (s.kind === 'folder') return `local folder "${s.folder}"`
  if (s.kind === 'flomorphic') return 'packed from flows on this FloMorphic'
  return 'pasted manifest'
}

function started(list: Activity[]) {
  if (list.length) load(true)
}

watch(
  () => props.id,
  () => {
    load()
    loadPlan()
  },
)
onMounted(() => {
  load()
  loadPlan()
  if (!flo.loaded) flo.loadSettings()
})
</script>

<template>
  <div class="p-6">
    <RouterLink :to="{ name: 'operations' }" class="mb-3 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent">
      <Icon name="chevronLeft" :size="13" /> Operations
    </RouterLink>

    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>
    <p v-else-if="!op" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error || 'Operation not found.' }}</p>

    <template v-else>
      <!-- header -->
      <div class="mb-1 flex flex-wrap items-center gap-3">
        <Icon name="box" :size="22" class="text-accent" />
        <h1 class="text-lg font-semibold text-fg">{{ op.name }}</h1>
        <span class="chip-muted font-mono">v{{ op.version }}</span>
        <span class="chip-muted font-mono">{{ op.key }}</span>
        <span
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          :class="op.readiness.ready ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'"
        >
          <Icon :name="op.readiness.ready ? 'checkCircle' : 'alertCircle'" :size="11" :width="2" />
          {{ op.readiness.ready ? 'ready' : 'needs setup' }}
        </span>
        <div class="ml-auto flex items-center gap-2">
          <button class="btn-outline btn-sm" title="Download the package as a zip — for a catalog repository or another Venapce" @click="exportZip">
            <Icon name="upload" :size="13" /> Export .zip
          </button>
          <button v-if="op.source.kind === 'url'" class="btn-outline btn-sm" :disabled="!!busy" title="Re-read the package from its source" @click="update">
            <Icon name="refresh" :size="13" :class="busy === 'update' && 'animate-spin'" /> Update
          </button>
          <button class="btn-danger btn-sm" :disabled="!!busy" @click="remove"><Icon name="trash" :size="13" /> Remove</button>
        </div>
      </div>
      <p v-if="op.description" class="mb-2 max-w-3xl text-sm text-fg-muted">{{ op.description }}</p>
      <div class="mb-4 flex flex-wrap items-center gap-1.5">
        <span v-for="s in op.scale ?? []" :key="s" class="chip-muted"><Icon name="layers" :size="10" /> {{ SCALE_LABEL[s] ?? s }}</span>
        <span v-for="t in op.tags ?? []" :key="t" class="chip-muted">#{{ t }}</span>
        <a v-if="op.manifest.homepage" :href="op.manifest.homepage" target="_blank" rel="noopener" class="chip-muted hover:text-accent">
          <Icon name="external" :size="10" /> homepage
        </a>
      </div>

      <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
      <p v-if="notice" class="mb-4 rounded-md bg-success-soft px-3 py-2 text-sm text-success">{{ notice }}</p>

      <div class="grid gap-5 lg:grid-cols-3">
        <!-- ===== main column ===== -->
        <div class="space-y-5 lg:col-span-2">
          <!-- flows -->
          <section class="card p-4">
            <div class="mb-3 flex items-center gap-2">
              <h2 class="label !mb-0 flex items-center gap-1.5"><Icon name="workflow" :size="13" /> {{ multiStep ? 'Mission steps' : 'Workflows' }}</h2>
              <span class="chip">{{ bound }}/{{ op.flows.length }} bound</span>
              <button
                v-if="bound"
                class="icon-btn-plain text-[11px]"
                title="Stamp this operation's labels on its bound flows, so a row's Run-flow picker can filter to them. Only the labels are written — no graph is re-pushed."
                :disabled="!!busy"
                @click="relabel"
              >
                <Icon :name="busy === 'relabel' ? 'loader' : 'tag'" :size="12" :class="busy === 'relabel' && 'animate-spin'" />
                <span class="ml-1">label flows</span>
              </button>
              <a
                v-if="panelUrl"
                :href="homeUrl(panelUrl)"
                target="_blank"
                rel="noopener"
                class="icon-btn-plain ml-auto text-[11px]"
                :title="`FloMorphic web app: ${panelUrl} — change it in Settings → FloMorphic web app`"
              >
                <Icon name="external" :size="12" /> <span class="ml-1">FloMorphic</span>
              </a>
            </div>
            <p class="mb-3 text-xs text-fg-muted">
              Each manifest flow becomes a workflow on the FloMorphic canvas. <strong>Install</strong> pushes the file (with your parameters
              substituted) and binds it; <strong>Link</strong> binds a flow you imported in FloMorphic yourself. Bound
              <em>entry</em> flows run from here and write their rows into the pipeline<span v-if="multiStep">; the steps are the order the
              mission is carried out in — <em>on-row</em> steps are picked from a row's <em>Run flow</em> once the earlier step produced it</span>.
            </p>
            <ul class="divide-y divide-line rounded-md border border-line">
              <li v-for="f in steps" :key="f.key" class="px-3 py-3">
                <div class="flex flex-wrap items-start gap-2.5">
                  <span v-if="f.step" class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg-muted" :title="`step ${f.step}`">{{ f.step }}</span>
                  <span class="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" :class="ROLE_CLASS[f.role]" :title="ROLE_LABEL[f.role]">
                    <Icon :name="ROLE_ICON[f.role]" :size="11" /> {{ f.role }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="text-sm font-medium text-fg">{{ f.title || f.key }}</span>
                      <span class="font-mono text-[11px] text-fg-subtle">{{ f.key }}</span>
                    </div>
                    <p v-if="f.description" class="mt-0.5 text-xs text-fg-muted">{{ f.description }}</p>
                    <p class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-fg-subtle">
                      <span class="font-mono">{{ f.file }}</span>
                      <span v-if="f.schedule"><Icon name="clock" :size="10" /> suggested {{ describeCron(f.schedule) }}</span>
                      <span v-if="f.subject?.length"><Icon name="target" :size="10" /> on {{ f.subject.join(' / ') }}</span>
                      <span v-if="f.writes?.length"><Icon name="arrowRight" :size="10" /> writes {{ f.writes.join(', ') }}</span>
                    </p>
                    <p v-if="f.flowId" class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <Icon name="link" :size="11" class="text-success" />
                      <span class="text-fg-muted">bound to</span>
                      <span class="font-mono text-fg">{{ f.flowId }}</span>
                      <span v-if="f.flowTitle && f.flowTitle !== f.title" class="text-fg-subtle">· {{ f.flowTitle }}</span>
                      <span v-if="f.installedAt" class="text-fg-subtle">· installed {{ relativeTime(f.installedAt) }}</span>
                      <FlomorphicLink kind="flow" :id="f.flowId" />
                    </p>
                    <p v-else class="mt-1 flex items-center gap-1.5 text-[11px] text-warning">
                      <Icon name="alertCircle" :size="11" /> not in FloMorphic yet
                    </p>
                    <p v-if="f.missingActions?.length" class="mt-1 flex items-start gap-1.5 text-[11px] text-danger">
                      <Icon name="alertCircle" :size="11" class="mt-0.5 shrink-0" />
                      <span>
                        Its nodes call actions no plugin on FloMorphic provides:
                        <span v-for="(m, i) in f.missingActions" :key="m.action">
                          <code class="font-mono">{{ m.action }}</code>
                          <a v-if="m.repo" :href="m.repo" target="_blank" rel="noopener" class="underline">({{ m.plugin }})</a>
                          <template v-else>({{ m.plugin }})</template>{{ i < f.missingActions.length - 1 ? ', ' : '' }}
                        </span>
                        — install the plugin, sync it, then re-install this flow.
                      </span>
                    </p>
                    <p v-else-if="f.compileError && !f.compileError.includes('backend initial')" class="mt-1 flex items-start gap-1.5 text-[11px] text-warning">
                      <Icon name="alertCircle" :size="11" class="mt-0.5 shrink-0" /> <span>Compile check: {{ f.compileError }}</span>
                    </p>
                    <!-- Installed, and unbound in places: more than one plugin on FloMorphic
                         serves these nodes' action, so its import held them back rather than bind
                         whichever answered first and leave the flow looking settled. -->
                    <p v-if="f.unboundNodes?.length" class="mt-1 flex items-start gap-1.5 text-[11px] text-warning">
                      <Icon name="alertCircle" :size="11" class="mt-0.5 shrink-0" />
                      <span>
                        {{ f.unboundNodes.length }}
                        {{ f.unboundNodes.length === 1 ? 'node needs' : 'nodes need' }} a plugin picked — more than
                        one plugin provides what {{ f.unboundNodes.length === 1 ? 'it calls' : 'they call' }}:
                        <span v-for="(u, i) in f.unboundNodes" :key="u.ref + u.action">
                          <code class="font-mono">{{ u.title || u.ref }}</code>
                          ({{ u.action }} → {{ u.choices.join(' / ') }}){{ i < f.unboundNodes.length - 1 ? ', ' : '' }}
                        </span>
                        — open the flow and pick the plugin on each node.
                        <FlomorphicLink v-if="f.flowId" kind="flow" :id="f.flowId" />
                      </span>
                    </p>
                    <p v-if="f.lastRun" class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
                      last run
                      <Badge kind="activity-status" :value="f.lastRun.status" />
                      <RouterLink :to="{ name: 'activity-detail', params: { id: String(f.lastRun.id) } }" class="hover:text-accent">
                        {{ relativeTime(f.lastRun.finishedAt || f.lastRun.startedAt || undefined) }}
                      </RouterLink>
                      <!-- What that run hit on its way through. The status next
                           to it can quite legitimately read `finished`. -->
                      <RunErrorBadge v-if="f.errs" :errors="f.errs" :expanded="errorsOpen.has(f.key)" @toggle="toggleErrors(f.key)" />
                      <span v-if="f.lastRun.error" class="text-danger">· {{ f.lastRun.error }}</span>
                    </p>
                    <RunErrorList v-if="f.errs && errorsOpen.has(f.key)" :errors="f.errs" class="mt-2" />
                  </div>
                  <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                    <template v-if="f.flowId">
                      <button v-if="f.role === 'entry'" class="btn-primary btn-sm" :disabled="!!busy" @click="run(f)">
                        <Icon :name="busy === 'run:' + f.key ? 'loader' : 'play'" :size="13" :class="busy === 'run:' + f.key && 'animate-spin'" /> Run
                      </button>
                      <button class="btn-outline btn-sm" title="Open the workflow on the FloMorphic canvas" @click="openFlow(f)">
                        <Icon name="external" :size="13" /> Open
                      </button>
                      <button class="btn-outline btn-sm" title="Push the file again (after a parameter change or a package update)" :disabled="!!busy" @click="installFlow(f)">
                        <Icon name="refresh" :size="13" /> Re-install
                      </button>
                      <button class="icon-btn-sm" title="Pull the flow as edited on the canvas back into the package file" :disabled="!!busy" @click="pullFlow(f)">
                        <Icon name="download" :size="13" />
                      </button>
                    </template>
                    <template v-else>
                      <button class="btn-primary btn-sm" title="Create the workflow in FloMorphic from the package file" :disabled="!!busy" @click="installFlow(f)">
                        <Icon :name="busy === f.key ? 'loader' : 'download'" :size="13" :class="busy === f.key && 'animate-spin'" /> Install
                      </button>
                      <button class="btn-outline btn-sm" title="Bind to a flow that already exists in FloMorphic" :disabled="!!busy" @click="picker = f">
                        <Icon name="link" :size="13" /> Link…
                      </button>
                    </template>
                    <button class="icon-btn-sm" title="Copy the flow JSON (parameters substituted) for a manual import" :disabled="!!busy" @click="copyFlowFile(f)">
                      <Icon name="copy" :size="13" />
                    </button>
                    <button
                      v-if="f.doc"
                      class="icon-btn-sm"
                      :class="docOpen.has(f.key) && 'icon-btn--active'"
                      :title="op.flowDocs?.[f.key] ? 'Show this flow\'s documentation' : `Documented in ${f.doc} (not available)`"
                      :disabled="!op.flowDocs?.[f.key]"
                      @click="toggleDoc(f.key)"
                    >
                      <Icon name="note" :size="13" />
                    </button>
                  </div>
                </div>
                <!-- the flow's own doc, inline -->
                <div v-if="docOpen.has(f.key) && flowDoc(f)" class="prose-readme mt-3 rounded-md border border-line bg-bg p-3 text-sm text-fg" v-html="flowDoc(f)"></div>
              </li>
            </ul>
            <p v-if="entry.length === 0" class="mt-2 text-[11px] text-fg-subtle">
              This operation has no entry flow: its flows run on pipeline rows (pick them from a row's <em>Run flow</em>).
            </p>
          </section>

          <!-- plugins & node settings: the half of the setup that lives in
               FloMorphic, not in the package -->
          <section class="card p-4">
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <h2 class="label !mb-0 flex items-center gap-1.5"><Icon name="sliders" :size="13" /> Plugins &amp; node settings</h2>
              <span v-if="plan && plan.pending" class="chip bg-warning-soft text-warning">{{ plan.pending }} to bind</span>
              <span v-else-if="plan && plan.needs?.length" class="chip bg-success-soft text-success">all bound</span>
              <button class="icon-btn-plain ml-auto text-[11px]" title="Read the bound flows back from FloMorphic" :disabled="planBusy" @click="loadPlan">
                <Icon name="refresh" :size="12" :class="planBusy && 'animate-spin'" /> <span class="ml-1">re-check</span>
              </button>
            </div>
            <p v-if="planBusy && !plan" class="text-xs text-fg-subtle">Reading the flows back from FloMorphic…</p>
            <SettingsPlanList v-else-if="plan" :plan="plan" />
            <p v-else class="rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-muted">
              {{ planError || 'FloMorphic could not be read.' }}
            </p>
          </section>

          <!-- readme: the mission and each flow's part in it -->
          <section class="card p-4">
            <h2 class="label flex items-center gap-1.5"><Icon name="note" :size="13" /> Mission</h2>
            <div v-if="readme" class="prose-readme text-sm text-fg" v-html="readme"></div>
            <p v-else class="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
              This package shipped without a README. Every operation is expected to document its mission and each flow's part in it —
              re-import it from a folder that has one.
            </p>
          </section>

          <!-- history -->
          <section class="card p-4">
            <ActivityTimeline ref="timeline" kind="operation" :id="op.id" no-run @started="started" />
          </section>
        </div>

        <!-- ===== side column ===== -->
        <div class="space-y-5">
          <section class="card p-4">
            <h2 class="label flex items-center gap-1.5"><Icon name="shield" :size="13" /> Readiness</h2>
            <ReadinessList :checks="op.readiness.checks" />
          </section>

          <section v-if="hasParams" class="card p-4">
            <div class="mb-2 flex items-center gap-2">
              <h2 class="label !mb-0 flex items-center gap-1.5"><Icon name="sliders" :size="13" /> Parameters</h2>
              <button class="btn-primary btn-sm ml-auto" :disabled="!paramsDirty || !!busy" @click="saveParams">
                <Icon name="save" :size="12" /> Save
              </button>
            </div>
            <ParamsForm v-model="params" :specs="op.manifest.params!" @update:model-value="paramsDirty = true" />
          </section>

          <section class="card p-4 text-xs">
            <h2 class="label flex items-center gap-1.5"><Icon name="info" :size="13" /> Package</h2>
            <dl class="space-y-1.5">
              <div class="flex gap-2"><dt class="w-20 shrink-0 text-fg-subtle">Source</dt><dd class="min-w-0 break-all font-mono text-fg-muted">{{ sourceLabel() }}</dd></div>
              <div v-if="op.installedAt" class="flex gap-2"><dt class="w-20 shrink-0 text-fg-subtle">Installed</dt><dd class="text-fg-muted">{{ relativeTime(op.installedAt) }}</dd></div>
              <div v-if="op.updatedAt && op.updatedAt !== op.installedAt" class="flex gap-2"><dt class="w-20 shrink-0 text-fg-subtle">Updated</dt><dd class="text-fg-muted">{{ relativeTime(op.updatedAt) }}</dd></div>
              <div v-if="op.manifest.license" class="flex gap-2"><dt class="w-20 shrink-0 text-fg-subtle">License</dt><dd class="text-fg-muted">{{ op.manifest.license }}</dd></div>
              <div v-if="op.manifest.authors?.length" class="flex gap-2"><dt class="w-20 shrink-0 text-fg-subtle">Authors</dt><dd class="text-fg-muted">{{ op.manifest.authors.join(', ') }}</dd></div>
              <div v-if="op.manifest.venapce?.min" class="flex gap-2"><dt class="w-20 shrink-0 text-fg-subtle">Venapce</dt><dd class="text-fg-muted">≥ {{ op.manifest.venapce.min }}</dd></div>
              <div v-if="op.manifest.provides?.tags?.length" class="flex gap-2">
                <dt class="w-20 shrink-0 text-fg-subtle">Writes tags</dt>
                <dd class="flex flex-wrap gap-1">
                  <span v-for="t in op.manifest.provides.tags" :key="t" class="chip-muted">#{{ t }}</span>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </template>

    <FlowPickerDialog :open="!!picker" :title="picker?.title || ''" @close="picker = null" @pick="pickFlow" />
  </div>
</template>

<style scoped>
/* README rendering — a restrained article style on the theme tokens. */
.prose-readme :deep(h2) {
  @apply mb-1 mt-3 text-base font-semibold text-fg first:mt-0;
}
.prose-readme :deep(h3),
.prose-readme :deep(h4) {
  @apply mb-1 mt-3 text-sm font-semibold text-fg;
}
.prose-readme :deep(p) {
  @apply mb-2 leading-relaxed text-fg-muted;
}
.prose-readme :deep(ul),
.prose-readme :deep(ol) {
  @apply mb-2 list-outside pl-5 text-fg-muted;
}
.prose-readme :deep(ul) {
  @apply list-disc;
}
.prose-readme :deep(ol) {
  @apply list-decimal;
}
.prose-readme :deep(li) {
  @apply mb-0.5;
}
.prose-readme :deep(code) {
  @apply rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px] text-fg;
}
.prose-readme :deep(pre) {
  @apply mb-2 overflow-x-auto rounded-md bg-surface-2 p-3 text-xs;
}
.prose-readme :deep(pre code) {
  @apply bg-transparent p-0;
}
.prose-readme :deep(a) {
  @apply text-accent hover:underline;
}
.prose-readme :deep(blockquote) {
  @apply mb-2 border-l-2 border-line pl-3 text-fg-muted;
}
.prose-readme :deep(hr) {
  @apply my-3 border-line;
}
</style>
