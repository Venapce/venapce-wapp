<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useFlomorphicStore } from '@/stores/flomorphic'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { readValue, writeValue } from '@/lib/localStore'
import { renderMarkdown } from '@/lib/markdown'
import { sampleOperationDetails } from '@/lib/samples'
import { ROLE_CLASS, ROLE_ICON, ROLE_LABEL, SCALE_LABEL, describeCron, effectiveParams, flowsByStep, substituteParams } from '@/lib/operations'
import Icon from '@/components/Icon.vue'
import Badge from '@/components/pipeline/Badge.vue'
import ActivityTimeline from '@/components/pipeline/ActivityTimeline.vue'
import ReadinessList from '@/components/operations/ReadinessList.vue'
import ParamsForm from '@/components/operations/ParamsForm.vue'
import FlowPickerDialog from '@/components/operations/FlowPickerDialog.vue'
import type { Activity, FlowSummary, OperationDetail, OperationFlowState } from '@/api/types'

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
const sample = ref(false)
const notice = ref('')
const busy = ref('') // the flow key (or action) in flight
const params = ref<Record<string, unknown>>({})
const paramsDirty = ref(false)
const picker = ref<OperationFlowState | null>(null)
const timeline = ref<InstanceType<typeof ActivityTimeline> | null>(null)

// Where the FloMorphic panel is, for "Open in FloMorphic". The backend knows
// the API base only; the panel's address is asked once and kept locally.
const PANEL_KEY = 'flomorphicPanelUrl'
const panelUrl = ref(readValue<string>(PANEL_KEY, ''))

const readme = computed(() => (op.value?.readme ? renderMarkdown(op.value.readme) : ''))
const steps = computed(() => flowsByStep(op.value?.flows ?? []))
const multiStep = computed(() => steps.value.some((f) => f.step))
const entry = computed(() => op.value?.flows.filter((f) => f.role === 'entry') ?? [])
// Which flows have their doc expanded (by key).
const docOpen = ref<Set<string>>(new Set())
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
    sample.value = false
  } catch (e) {
    const s = sampleOperationDetails[props.id]
    if (s && !quiet) {
      apply(s)
      sample.value = true
    } else if (!quiet) {
      error.value = apiErr(e)
    }
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
  if (sample.value) {
    error.value = 'Sample data — connect the backend to act on an operation.'
    return
  }
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
const installFlow = (f: OperationFlowState) =>
  act(f.key, () => conn.client.installOperationFlow(props.id, f.key), `"${f.title || f.key}" installed into FloMorphic.`)
const update = () => act('update', () => conn.client.updateOperation(props.id), 'Package re-read from its source.')
const pullFlow = (f: OperationFlowState) =>
  window.confirm(
    `Replace the package's "${f.file}" with the flow as it is on the FloMorphic canvas now? Any \${param.…} placeholders in the file are replaced by the canvas values.`,
  ) && act('pull:' + f.key, () => conn.client.pullOperationFlow(props.id, f.key), `"${f.title || f.key}" pulled from FloMorphic into the package.`)

/** Download the installed package as a zip (one folder, the catalog layout). */
function exportZip() {
  if (sample.value) {
    error.value = 'Sample data — connect the backend to export an operation.'
    return
  }
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
  act(f.key, () => conn.client.linkOperationFlow(props.id, f.key, flow.id), `"${f.title || f.key}" linked to ${flow.title}.`)
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

function openInFlomorphic(f: OperationFlowState) {
  if (!f.flowId) return
  let base = panelUrl.value
  if (!base) {
    const guess = flo.apiUrl ? flo.apiUrl.replace(/\/+$/, '').replace(/:\d+$/, ':8027') : 'http://localhost:8027'
    const v = window.prompt('Where is the FloMorphic panel (its web address)? Asked once, kept in this browser.', guess)
    if (!v) return
    base = v.trim().replace(/\/+$/, '')
    panelUrl.value = base
    writeValue(PANEL_KEY, base)
  }
  window.open(`${base}/workflows/${encodeURIComponent(f.flowId)}`, '_blank', 'noopener')
}
function changePanelUrl() {
  const v = window.prompt('FloMorphic panel address', panelUrl.value)
  if (v === null) return
  panelUrl.value = v.trim().replace(/\/+$/, '')
  writeValue(PANEL_KEY, panelUrl.value)
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

watch(() => props.id, () => load())
onMounted(() => {
  load()
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

      <div v-if="sample" class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
        Showing sample data — the backend <code>/api/operations</code> endpoint isn't reachable.
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
              <button class="icon-btn-plain ml-auto text-[11px]" :title="panelUrl ? `FloMorphic panel: ${panelUrl}` : 'Set the FloMorphic panel address'" @click="changePanelUrl">
                <Icon name="external" :size="12" /> <span class="ml-1">{{ panelUrl ? 'panel' : 'set panel address' }}</span>
              </button>
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
                    <p v-if="f.lastRun" class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
                      last run
                      <Badge kind="activity-status" :value="f.lastRun.status" />
                      <RouterLink :to="{ name: 'activity-detail', params: { id: String(f.lastRun.id) } }" class="hover:text-accent">
                        {{ relativeTime(f.lastRun.finishedAt || f.lastRun.startedAt || undefined) }}
                      </RouterLink>
                      <span v-if="f.lastRun.error" class="text-danger">· {{ f.lastRun.error }}</span>
                    </p>
                  </div>
                  <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                    <template v-if="f.flowId">
                      <button v-if="f.role === 'entry'" class="btn-primary btn-sm" :disabled="!!busy" @click="run(f)">
                        <Icon :name="busy === 'run:' + f.key ? 'loader' : 'play'" :size="13" :class="busy === 'run:' + f.key && 'animate-spin'" /> Run
                      </button>
                      <button class="btn-outline btn-sm" title="Open the workflow on the FloMorphic canvas" @click="openInFlomorphic(f)">
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
