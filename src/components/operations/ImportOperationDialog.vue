<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { useOsctrlStore } from '@/stores/osctrl'
import { useFlomorphicStore } from '@/stores/flomorphic'
import { apiErr } from '@/api/venapce'
import {
  MANIFEST_FILE,
  ROLE_CLASS,
  ROLE_ICON,
  SCALE_LABEL,
  checkFlowFiles,
  describeCron,
  effectiveParams,
  fetchBundle,
  fetchCatalog,
  flowsByStep,
  localReadiness,
  parseManifest,
  readFolder,
  readinessSummary,
  resolveUrl,
  type CatalogEntry,
  type ResolvedUrl,
} from '@/lib/operations'
import Icon from '@/components/Icon.vue'
import ReadinessList from './ReadinessList.vue'
import ParamsForm from './ParamsForm.vue'
import type { OperationBundle, OperationDetail, OperationSource } from '@/api/types'

// The import wizard — two steps. SOURCE: where the package is (a GitHub tree
// / any static folder URL, a folder on disk, or a pasted manifest). REVIEW:
// what was read — manifest, flows, the readiness pass against this panel's
// osctrl / plugin state, and the params the operator sets for their estate —
// then Install. Readiness gaps do not block an install (the operation page
// keeps showing them until fixed); a broken manifest or a missing flow file
// does.
const props = defineProps<{ open: boolean; installed: string[] }>()
const emit = defineEmits<{ close: []; installed: [op: OperationDetail] }>()

const conn = useConnectionStore()
const osctrl = useOsctrlStore()
const flo = useFlomorphicStore()

type Tab = 'url' | 'folder' | 'paste'
const tab = ref<Tab>('url')
const step = ref<'source' | 'review'>('source')
const busy = ref(false)
const error = ref('')

// -- source: url
const url = ref('')
const resolved = ref<ResolvedUrl | null>(null)
const catalog = ref<{ name?: string; operations: CatalogEntry[] } | null>(null)

// -- source: folder
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

// -- source: paste
const pasted = ref('')

// -- review
const bundle = ref<OperationBundle | null>(null)
const source = ref<OperationSource>({ kind: 'paste' })
const problems = ref<string[]>([])
const params = ref<Record<string, unknown>>({})

const manifest = computed(() => bundle.value?.manifest ?? null)
const checks = computed(() =>
  manifest.value
    ? localReadiness(
        manifest.value,
        {
          osctrl: { configured: osctrl.configured, connected: osctrl.connected },
          flomorphic: { configured: flo.configured, pluginRunning: !!flo.plugin?.running },
          installed: props.installed,
        },
        params.value,
        bundle.value ?? undefined,
      )
    : [],
)
const summary = computed(() => readinessSummary(checks.value))
const alreadyInstalled = computed(() => !!manifest.value && props.installed.includes(manifest.value.id))
const canInstall = computed(() => !!manifest.value && problems.value.length === 0 && !busy.value)

function reset() {
  step.value = 'source'
  busy.value = false
  error.value = ''
  resolved.value = null
  catalog.value = null
  bundle.value = null
  problems.value = []
  params.value = {}
}
watch(
  () => props.open,
  (o) => o && reset(),
)

function review(b: OperationBundle, src: OperationSource, errs: string[]) {
  bundle.value = b
  source.value = src
  problems.value = [...errs, ...checkFlowFiles(b)]
  // Seed the form with the defaults so the operator sees what will apply.
  params.value = Object.fromEntries(Object.entries(effectiveParams(b.manifest)).filter(([, v]) => v !== undefined))
  step.value = 'review'
}

// ---- URL ----
async function fetchUrl(entry?: CatalogEntry) {
  error.value = ''
  const r = resolved.value ?? resolveUrl(url.value)
  if (!r) {
    error.value = 'That does not look like a URL Venapce can read (GitHub repo / tree / raw, or a folder URL).'
    return
  }
  resolved.value = r
  busy.value = true
  try {
    if (!entry && r.catalogAt && !catalog.value) {
      // A repository root: offer the catalog when it ships one, else try the root as a package.
      const cat = await fetchCatalog(r).catch(() => null)
      if (cat && cat.operations.length) {
        catalog.value = cat
        return
      }
    }
    const base = entry ? r.rawBase + entry.path.replace(/^\/+|\/+$/g, '') + '/' : r.rawBase
    const { bundle: b, errors } = await fetchBundle(base)
    review(b, { ...r.source, path: entry ? entry.path : r.source.path }, errors)
  } catch (e) {
    error.value = (e as Error).message.includes('Failed to fetch')
      ? 'Could not fetch from that URL (private repository, or the host does not allow cross-origin reads). Clone it and import the folder instead.'
      : (e as Error).message
  } finally {
    busy.value = false
  }
}

// ---- folder ----
async function filesChosen(list: FileList | File[] | null) {
  if (!list || !list.length) return
  error.value = ''
  busy.value = true
  try {
    const { bundle: b, errors, folder } = await readFolder(list)
    review(b, { kind: 'folder', folder }, errors)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
async function onDrop(ev: DragEvent) {
  dragging.value = false
  const items = ev.dataTransfer?.items
  if (!items) return
  // Walk dropped directories (webkitGetAsEntry) so a dragged folder works like the picker.
  const files: File[] = []
  const walk = (entry: FileSystemEntry, prefix: string): Promise<void> =>
    new Promise((resolve) => {
      if (entry.isFile) {
        ;(entry as FileSystemFileEntry).file((f) => {
          Object.defineProperty(f, 'webkitRelativePath', { value: prefix + f.name })
          files.push(f)
          resolve()
        })
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader()
        const all: FileSystemEntry[] = []
        const read = () =>
          reader.readEntries(async (batch) => {
            if (batch.length) {
              all.push(...batch)
              read()
            } else {
              for (const e of all) await walk(e, prefix + entry.name + '/')
              resolve()
            }
          })
        read()
      } else resolve()
    })
  const entries = Array.from(items)
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e)
  for (const e of entries) await walk(e, '')
  await filesChosen(files)
}

// ---- paste ----
function usePasted() {
  error.value = ''
  const { manifest: m, errors } = parseManifest(pasted.value)
  if (!m) {
    error.value = errors.join('\n')
    return
  }
  // A pasted manifest carries no files: every flow must be linked to an
  // existing FloMorphic flow after install. Say so, but let it through.
  review({ manifest: m, files: {} }, { kind: 'paste' }, errors)
}

// ---- install ----
async function install() {
  if (!bundle.value) return
  busy.value = true
  error.value = ''
  try {
    const op = await conn.client.importOperation({ bundle: bundle.value, source: source.value, params: params.value })
    emit('installed', op)
    emit('close')
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    busy.value = false
  }
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'url', label: 'From URL', icon: 'globe' },
  { key: 'folder', label: 'Local folder', icon: 'folder' },
  { key: 'paste', label: 'Paste manifest', icon: 'code' },
]
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
      <div class="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="box" :size="16" class="text-accent" />
        <h2 class="text-sm font-semibold text-fg">
          Import an operation
          <span v-if="step === 'review' && manifest" class="font-normal text-fg-muted">— {{ manifest.name }}</span>
        </h2>
        <button class="icon-btn-sm ml-auto" title="Close" @click="emit('close')"><Icon name="close" :size="14" /></button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <!-- ===== step 1: source ===== -->
        <template v-if="step === 'source'">
          <p class="mb-3 text-xs text-fg-muted">
            An operation is a folder with an <code class="font-mono">{{ MANIFEST_FILE }}</code> manifest, the FloMorphic workflow
            exports it names, and a README. Point at it in a catalog repository, on disk, or paste the manifest.
          </p>

          <div class="mb-4 flex gap-1 rounded-md bg-surface-2 p-1">
            <button
              v-for="t in TABS"
              :key="t.key"
              class="flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors"
              :class="tab === t.key ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'"
              @click="tab = t.key"
            >
              <Icon :name="t.icon" :size="13" /> {{ t.label }}
            </button>
          </div>

          <!-- URL -->
          <div v-if="tab === 'url'">
            <label class="label">Repository, folder or manifest URL</label>
            <div class="flex gap-2">
              <input
                v-model="url"
                class="field font-mono text-xs"
                placeholder="https://github.com/org/operations/tree/main/linux-fleet-http-audit"
                @keydown.enter="fetchUrl()"
                @input="((resolved = null), (catalog = null))"
              />
              <button class="btn-primary shrink-0" :disabled="!url.trim() || busy" @click="fetchUrl()">
                <Icon :name="busy ? 'loader' : 'download'" :size="14" :class="busy && 'animate-spin'" /> Fetch
              </button>
            </div>
            <p class="mt-1.5 text-[11px] text-fg-subtle">
              A GitHub repository root, a <code class="font-mono">tree/…</code> folder, a raw <code class="font-mono">{{ MANIFEST_FILE }}</code>, or any
              web folder that serves the package files. A repository with a <code class="font-mono">catalog.json</code> lists its operations to pick from.
            </p>

            <div v-if="catalog" class="mt-4">
              <p class="label">{{ catalog.name || 'Catalog' }} · {{ catalog.operations.length }} operations</p>
              <ul class="divide-y divide-line rounded-md border border-line">
                <li v-for="c in catalog.operations" :key="c.id" class="flex items-center gap-3 px-3 py-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 text-sm text-fg">
                      <span class="font-medium">{{ c.name || c.id }}</span>
                      <span v-if="c.version" class="chip-muted font-mono">v{{ c.version }}</span>
                      <span v-if="installed.includes(c.id)" class="chip-muted">installed</span>
                    </div>
                    <p v-if="c.description" class="truncate text-xs text-fg-muted">{{ c.description }}</p>
                  </div>
                  <button class="btn-outline btn-sm shrink-0" :disabled="busy" @click="fetchUrl(c)">Read</button>
                </li>
              </ul>
            </div>
          </div>

          <!-- folder -->
          <div v-else-if="tab === 'folder'">
            <div
              class="grid place-items-center rounded-lg border-2 border-dashed p-8 text-center transition-colors"
              :class="dragging ? 'border-accent bg-accent-soft' : 'border-line'"
              @dragover.prevent="dragging = true"
              @dragleave="dragging = false"
              @drop.prevent="onDrop"
            >
              <Icon name="folder" :size="28" class="mb-2 text-fg-subtle" />
              <p class="text-sm text-fg">Drop the operation folder here</p>
              <p class="mb-3 text-xs text-fg-muted">or</p>
              <button class="btn-outline" :disabled="busy" @click="fileInput?.click()">
                <Icon name="upload" :size="14" /> Choose folder…
              </button>
              <input
                ref="fileInput"
                type="file"
                class="hidden"
                webkitdirectory
                multiple
                @change="filesChosen(($event.target as HTMLInputElement).files)"
              />
            </div>
            <p class="mt-1.5 text-[11px] text-fg-subtle">
              Only the manifest, the flow files it names and the README leave your browser. The folder may hold one operation or be a catalog checkout (the
              shallowest manifest is used).
            </p>
          </div>

          <!-- paste -->
          <div v-else>
            <label class="label">{{ MANIFEST_FILE }}</label>
            <textarea
              v-model="pasted"
              class="field min-h-[14rem] font-mono text-xs"
              spellcheck="false"
              placeholder='{ "schema": 1, "id": "my-operation", "name": "…", "version": "1.0.0", "flows": [ … ] }'
            ></textarea>
            <p class="mt-1.5 text-[11px] text-fg-subtle">
              A pasted manifest carries no flow files — link each flow to one that already exists in FloMorphic after install.
            </p>
            <button class="btn-primary mt-3" :disabled="!pasted.trim() || busy" @click="usePasted">Review</button>
          </div>
        </template>

        <!-- ===== step 2: review ===== -->
        <template v-else-if="manifest && bundle">
          <div class="mb-4 flex flex-wrap items-start gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-base font-semibold text-fg">{{ manifest.name }}</span>
                <span class="chip-muted font-mono">v{{ manifest.version }}</span>
                <span class="chip-muted font-mono">{{ manifest.id }}</span>
                <span v-if="alreadyInstalled" class="chip">already installed — this will upgrade</span>
              </div>
              <p v-if="manifest.description" class="mt-1 text-sm text-fg-muted">{{ manifest.description }}</p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="s in manifest.scale ?? []" :key="s" class="chip-muted"><Icon name="layers" :size="11" /> {{ SCALE_LABEL[s] ?? s }}</span>
                <span v-for="t in manifest.tags ?? []" :key="t" class="chip-muted"><Icon name="hash" :size="10" /> {{ t }}</span>
              </div>
              <p class="mt-2 text-[11px] text-fg-subtle">
                Source:
                <span v-if="source.kind === 'url'" class="font-mono">{{ source.url }}{{ source.path ? ' · ' + source.path : '' }}{{ source.ref ? ' @' + source.ref : '' }}</span>
                <span v-else-if="source.kind === 'folder'" class="font-mono">local folder "{{ source.folder }}"</span>
                <span v-else>pasted manifest</span>
              </p>
            </div>
          </div>

          <div v-if="problems.length" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            <p class="mb-1 font-semibold">The package cannot be installed as it is:</p>
            <ul class="list-disc pl-4">
              <li v-for="(p, i) in problems" :key="i">{{ p }}</li>
            </ul>
          </div>

          <!-- flows -->
          <section class="mb-4">
            <p class="label">Workflows · {{ manifest.flows.length }}{{ manifest.flows.length > 1 ? ' steps' : '' }}</p>
            <p v-if="bundle.files[manifest.readme || 'README.md'] == null && source.kind === 'paste'" class="mb-2 text-[11px] text-warning">
              A pasted manifest brings no README — the operation page will have no mission write-up until the package is re-imported from its folder.
            </p>
            <ul class="divide-y divide-line rounded-md border border-line">
              <li v-for="f in flowsByStep(manifest.flows)" :key="f.key" class="flex items-start gap-2.5 px-3 py-2">
                <span v-if="f.step" class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg-muted" :title="`step ${f.step}`">{{ f.step }}</span>
                <span class="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" :class="ROLE_CLASS[f.role]">
                  <Icon :name="ROLE_ICON[f.role]" :size="11" /> {{ f.role }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5 text-sm text-fg">
                    <span class="font-medium">{{ f.title || f.key }}</span>
                    <span class="font-mono text-[11px] text-fg-subtle">{{ f.file }}</span>
                    <span v-if="bundle.files[f.file] == null" class="chip-muted text-warning">{{ source.kind === 'paste' ? 'link after install' : 'file missing' }}</span>
                    <span v-if="f.doc" class="chip-muted" :class="bundle.files[f.doc] == null && 'text-warning'"><Icon name="note" :size="10" /> {{ bundle.files[f.doc] == null ? 'doc missing' : 'documented' }}</span>
                  </div>
                  <p v-if="f.description" class="text-xs text-fg-muted">{{ f.description }}</p>
                  <p class="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-fg-subtle">
                    <span v-if="f.schedule"><Icon name="clock" :size="10" /> {{ describeCron(f.schedule) }}</span>
                    <span v-if="f.subject?.length"><Icon name="target" :size="10" /> on {{ f.subject.join(' / ') }}</span>
                    <span v-if="f.writes?.length"><Icon name="arrowRight" :size="10" /> writes {{ f.writes.join(', ') }}</span>
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <!-- params -->
          <section v-if="manifest.params && Object.keys(manifest.params).length" class="mb-4">
            <p class="label">Parameters — adapt it to your estate</p>
            <div class="rounded-md border border-line p-3">
              <ParamsForm v-model="params" :specs="manifest.params" />
            </div>
          </section>

          <!-- readiness -->
          <section>
            <p class="label">Readiness</p>
            <ReadinessList :checks="checks" />
            <p v-if="!summary.ready" class="mt-2 text-[11px] text-fg-subtle">
              You can install now and fix these afterwards — the operation page keeps the checklist until every flow can run.
            </p>
          </section>
        </template>

        <p v-if="error" class="mt-4 whitespace-pre-line rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{{ error }}</p>
      </div>

      <div class="flex items-center gap-2 border-t border-line px-4 py-3">
        <button v-if="step === 'review'" class="btn-ghost" :disabled="busy" @click="((step = 'source'), (error = ''))">
          <Icon name="chevronLeft" :size="14" /> Back
        </button>
        <span class="flex-1"></span>
        <button class="btn-outline" @click="emit('close')">Cancel</button>
        <button v-if="step === 'review'" class="btn-primary" :disabled="!canInstall" @click="install">
          <Icon :name="busy ? 'loader' : 'download'" :size="14" :class="busy && 'animate-spin'" />
          {{ alreadyInstalled ? 'Upgrade' : 'Install' }}
        </button>
      </div>
    </div>
  </div>
</template>
