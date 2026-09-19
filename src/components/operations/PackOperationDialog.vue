<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { ROLE_CLASS, ROLE_ICON, SCALE_LABEL } from '@/lib/operations'
import Icon from '@/components/Icon.vue'
import TagsField from '@/components/TagsField.vue'
import type { FlowSummary, OperationDetail, OperationFlowRole, OperationScale, PackFlowInput, PackInput } from '@/api/types'

// "New operation from FloMorphic flows" — the export side of the package
// manager. Flows built on the canvas (by hand, by MCP, by the AI designer)
// are exported and wrapped into a package: PICK the flows, DESCRIBE the
// mission and each flow's part (role, step, what it writes), then either
// install the package here — already bound to those flows — or download it
// as a zip to publish in a catalog. The manifest's `requires` comes from what
// the exports declare; the README is scaffolded from what is typed here and
// meant to be edited before publishing.
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; installed: [op: OperationDetail] }>()

const conn = useConnectionStore()

const step = ref<'pick' | 'describe'>('pick')
const busy = ref('')
const error = ref('')

// -- pick
const flows = ref<FlowSummary[]>([])
const loading = ref(false)
const search = ref('')
const picked = ref<FlowSummary[]>([])

// -- describe
const name = ref('')
const id = ref('')
const idTouched = ref(false)
const version = ref('1.0.0')
const description = ref('')
const tags = ref<string[]>([])
const scale = ref<OperationScale[]>([])
const readme = ref('')
const rows = ref<PackFlowInput[]>([])

const ROLES: OperationFlowRole[] = ['entry', 'on-row', 'helper']
const SUBJECTS = ['stage', 'finding', 'issue'] as const
const WRITES = ['stage', 'findings', 'issues', 'activities'] as const

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? flows.value.filter((f) => f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)) : flows.value
})
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
const canDescribe = computed(() => picked.value.length > 0)
const canPack = computed(() => name.value.trim().length > 0 && rows.value.length > 0 && !busy.value)

function isPicked(f: FlowSummary) {
  return picked.value.some((p) => p.id === f.id)
}
function toggle(f: FlowSummary) {
  picked.value = isPicked(f) ? picked.value.filter((p) => p.id !== f.id) : [...picked.value, f]
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    flows.value = await conn.client.listFlows()
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    loading.value = false
  }
}

function describe() {
  // One manifest row per picked flow: the first is the entry by default, the
  // rest on-row steps — the usual shape of a mission (a sweep, then triage).
  rows.value = picked.value.map((f, i) => ({
    flowId: f.id,
    key: slug(f.title),
    title: f.title,
    role: i === 0 ? 'entry' : 'on-row',
    step: i + 1,
    subject: i === 0 ? undefined : ['stage'],
    writes: i === 0 ? ['stage'] : ['activities'],
  }))
  if (!name.value) name.value = picked.value.length === 1 ? picked.value[0]!.title : ''
  step.value = 'describe'
}

watch(name, (n) => {
  if (!idTouched.value) id.value = slug(n)
})

function input(): PackInput {
  return {
    id: id.value.trim() || undefined,
    name: name.value.trim(),
    version: version.value.trim() || '1.0.0',
    description: description.value.trim() || undefined,
    tags: tags.value.length ? tags.value : undefined,
    scale: scale.value.length ? scale.value : undefined,
    readme: readme.value.trim() || undefined,
    flows: rows.value.map((r) => ({
      ...r,
      key: r.key?.trim() || undefined,
      description: r.description?.trim() || undefined,
      schedule: r.schedule?.trim() || undefined,
      subject: r.role === 'on-row' ? r.subject : undefined,
    })),
  }
}

async function install() {
  busy.value = 'install'
  error.value = ''
  try {
    const op = await conn.client.packAndInstallOperation(input())
    emit('installed', op)
    emit('close')
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    busy.value = ''
  }
}

async function download() {
  busy.value = 'zip'
  error.value = ''
  try {
    const blob = await conn.client.packOperationZip(input())
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${id.value || slug(name.value) || 'operation'}-${version.value || '1.0.0'}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    busy.value = ''
  }
}

function toggleIn<T extends string>(list: T[] | undefined, v: T): T[] {
  const cur = list ?? []
  return cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
}
function toggleScale(s: OperationScale) {
  scale.value = toggleIn(scale.value, s)
}

watch(
  () => props.open,
  (o) => {
    if (!o) return
    step.value = 'pick'
    picked.value = []
    rows.value = []
    name.value = ''
    id.value = ''
    idTouched.value = false
    version.value = '1.0.0'
    description.value = ''
    tags.value = []
    scale.value = []
    readme.value = ''
    error.value = ''
    search.value = ''
    load()
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden">
      <div class="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="workflow" :size="16" class="text-accent" />
        <h2 class="text-sm font-semibold text-fg">
          New operation from FloMorphic flows
          <span class="font-normal text-fg-muted">— {{ step === 'pick' ? 'pick the flows' : 'describe the mission' }}</span>
        </h2>
        <button class="icon-btn-sm ml-auto" title="Close" @click="emit('close')"><Icon name="close" :size="14" /></button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <!-- ===== pick ===== -->
        <template v-if="step === 'pick'">
          <p class="mb-3 text-xs text-fg-muted">
            Flows on your FloMorphic canvas — drawn by hand, by MCP or by the AI designer — become a package: each is exported as a
            portable document (plugin nodes carry only their action, never this install's ids), so the package installs on any Venapce.
          </p>
          <div class="mb-2 flex items-center gap-2">
            <input v-model="search" class="field" placeholder="Search flows…" />
            <button class="icon-btn" title="Reload" :disabled="loading" @click="load"><Icon name="refresh" :size="14" /></button>
          </div>
          <p v-if="loading" class="text-xs text-fg-subtle">Loading flows…</p>
          <p v-else-if="filtered.length === 0" class="text-xs text-fg-subtle">No flow matches.</p>
          <ul v-else class="divide-y divide-line rounded-md border border-line">
            <li v-for="f in filtered" :key="f.id">
              <label class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent-soft">
                <input type="checkbox" :checked="isPicked(f)" @change="toggle(f)" />
                <Icon name="workflow" :size="14" class="shrink-0 text-fg-subtle" />
                <span class="min-w-0 flex-1 truncate text-sm text-fg">{{ f.title }}</span>
                <span class="shrink-0 font-mono text-[10px] text-fg-subtle">{{ f.id }}</span>
              </label>
            </li>
          </ul>
          <p v-if="picked.length" class="mt-2 text-[11px] text-fg-subtle">
            {{ picked.length }} picked — the first becomes the entry flow (step 1); change roles on the next screen.
          </p>
        </template>

        <!-- ===== describe ===== -->
        <template v-else>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="label">Name</label>
              <input v-model="name" class="field" placeholder="Linux fleet HTTP audit" />
            </div>
            <div>
              <label class="label">Id (slug)</label>
              <input v-model="id" class="field font-mono text-xs" placeholder="derived from the name" @input="idTouched = true" />
            </div>
            <div>
              <label class="label">Version</label>
              <input v-model="version" class="field font-mono text-xs" placeholder="1.0.0" />
            </div>
            <div class="sm:col-span-2">
              <label class="label">Mission — what it finds out and where it writes it</label>
              <textarea v-model="description" class="field min-h-[4rem]" placeholder="One paragraph. It opens the README and the operation card."></textarea>
            </div>
            <div>
              <label class="label">Tags</label>
              <TagsField v-model="tags" placeholder="linux, exposure…" />
            </div>
            <div>
              <label class="label">Estate</label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="(label, s) in SCALE_LABEL"
                  :key="s"
                  class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                  :class="scale.includes(s) ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
                  @click="toggleScale(s)"
                >
                  {{ label }}
                </button>
              </div>
            </div>
          </div>

          <!-- flows -->
          <p class="label mt-4">Flows · {{ rows.length }} step{{ rows.length === 1 ? '' : 's' }}</p>
          <ul class="divide-y divide-line rounded-md border border-line">
            <li v-for="(r, i) in rows" :key="r.flowId" class="space-y-2 px-3 py-3">
              <div class="flex flex-wrap items-center gap-2">
                <input v-model.number="r.step" type="number" min="1" class="field w-14 py-1 text-center text-xs" title="step" />
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-fg">{{ r.title }}</span>
                <span class="font-mono text-[10px] text-fg-subtle">{{ r.flowId }}</span>
                <button class="icon-btn-plain icon-btn--danger" title="Drop from the package" @click="rows.splice(i, 1)">
                  <Icon name="close" :size="12" />
                </button>
              </div>
              <div class="grid gap-2 sm:grid-cols-[auto_1fr]">
                <div class="flex gap-1">
                  <button
                    v-for="role in ROLES"
                    :key="role"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    :class="r.role === role ? ROLE_CLASS[role] + ' ring-1 ring-accent' : 'bg-surface-2 text-fg-subtle hover:text-fg'"
                    @click="r.role = role"
                  >
                    <Icon :name="ROLE_ICON[role]" :size="10" /> {{ role }}
                  </button>
                </div>
                <input v-model="r.key" class="field py-1 font-mono text-xs" placeholder="key (slug)" />
              </div>
              <input v-model="r.description" class="field py-1 text-xs" placeholder="What this flow does, what it reads, what it writes (goes into the README)" />
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
                <span v-if="r.role === 'on-row'" class="flex items-center gap-1.5">
                  on
                  <label v-for="sub in SUBJECTS" :key="sub" class="inline-flex items-center gap-1">
                    <input type="checkbox" :checked="r.subject?.includes(sub)" @change="r.subject = toggleIn(r.subject, sub)" /> {{ sub }}
                  </label>
                </span>
                <span class="flex items-center gap-1.5">
                  writes
                  <label v-for="w in WRITES" :key="w" class="inline-flex items-center gap-1">
                    <input type="checkbox" :checked="r.writes?.includes(w)" @change="r.writes = toggleIn(r.writes, w)" /> {{ w }}
                  </label>
                </span>
                <span v-if="r.role === 'entry'" class="flex items-center gap-1.5">
                  schedule <input v-model="r.schedule" class="field w-32 py-0.5 font-mono text-[11px]" placeholder="0 */6 * * *" />
                </span>
              </div>
            </li>
          </ul>

          <details class="mt-4">
            <summary class="cursor-pointer text-xs font-medium text-fg-muted">README — write your own (a scaffold is generated otherwise)</summary>
            <textarea v-model="readme" class="field mt-2 min-h-[10rem] font-mono text-xs" placeholder="# Name&#10;&#10;## Mission&#10;…&#10;&#10;## Flows&#10;### Step 1 — …"></textarea>
          </details>
          <p class="mt-3 text-[11px] text-fg-subtle">
            The manifest's requirements (venapce / other plugins, osctrl) are read from the exported flows. Parameters
            (<code class="font-mono">${'${param.x}'}</code> placeholders) are added by editing the package files after download.
          </p>
        </template>

        <p v-if="error" class="mt-4 whitespace-pre-line rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{{ error }}</p>
      </div>

      <div class="flex items-center gap-2 border-t border-line px-4 py-3">
        <button v-if="step === 'describe'" class="btn-ghost" :disabled="!!busy" @click="step = 'pick'"><Icon name="chevronLeft" :size="14" /> Back</button>
        <span class="flex-1"></span>
        <button class="btn-outline" @click="emit('close')">Cancel</button>
        <button v-if="step === 'pick'" class="btn-primary" :disabled="!canDescribe" @click="describe">
          Next <Icon name="chevronRight" :size="14" />
        </button>
        <template v-else>
          <button class="btn-outline" :disabled="!canPack" title="Download the package as a zip (one folder, ready for a catalog repository)" @click="download">
            <Icon :name="busy === 'zip' ? 'loader' : 'download'" :size="14" :class="busy === 'zip' && 'animate-spin'" /> Download .zip
          </button>
          <button class="btn-primary" :disabled="!canPack" title="Install here, bound to these flows" @click="install">
            <Icon :name="busy === 'install' ? 'loader' : 'box'" :size="14" :class="busy === 'install' && 'animate-spin'" /> Install as operation
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
