<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useOsctrlStore } from '@/stores/osctrl'
import { useFlomorphicStore } from '@/stores/flomorphic'
import { apiErr } from '@/api/venapce'
import { relativeTime } from '@/lib/format'
import { SCALE_LABEL, operationRoute } from '@/lib/operations'
import Icon from '@/components/Icon.vue'
import Badge from '@/components/pipeline/Badge.vue'
import ImportOperationDialog from '@/components/operations/ImportOperationDialog.vue'
import PackOperationDialog from '@/components/operations/PackOperationDialog.vue'
import type { Operation, OperationDetail, OperationScale } from '@/api/types'

// Operations — the installed packages of flows that originate data for the
// pipeline. Each card is one package: what it does, whether its estate is
// ready (osctrl, plugins, bound flows), and when it last ran. Import brings a
// new one in from a catalog URL or a folder; the card opens the operation
// page where it is configured, installed into FloMorphic and run.
const conn = useConnectionStore()
const osctrl = useOsctrlStore()
const flo = useFlomorphicStore()
const route = useRoute()
const router = useRouter()

const items = ref<Operation[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const scale = ref<OperationScale | ''>('')
const tag = ref('')
const dialog = ref(false)
const packDialog = ref(false)

const scales = computed(() => {
  const set = new Set<OperationScale>()
  items.value.forEach((o) => o.scale?.forEach((s) => set.add(s)))
  return [...set]
})
const tags = computed(() => {
  const set = new Set<string>()
  items.value.forEach((o) => o.tags?.forEach((t) => set.add(t)))
  return [...set].sort()
})
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter((o) => {
    if (scale.value && !o.scale?.includes(scale.value)) return false
    if (tag.value && !o.tags?.includes(tag.value)) return false
    if (q && ![o.name, o.key, o.description, o.source.url, ...(o.tags ?? [])].some((f) => (f ?? '').toLowerCase().includes(q))) return false
    return true
  })
})
const readyCount = computed(() => items.value.filter((o) => o.ready).length)
const installedKeys = computed(() => items.value.map((o) => o.key))

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await conn.client.listOperations()
  } catch (e) {
    items.value = []
    error.value = apiErr(e)
  } finally {
    loading.value = false
  }
}

function installed(op: OperationDetail) {
  items.value = [op, ...items.value.filter((o) => o.id !== op.id)]
  router.push(operationRoute(op.id))
}

function sourceIcon(o: Operation): string {
  if (o.source.kind === 'url') return o.source.url?.includes('github.com') ? 'github' : 'globe'
  if (o.source.kind === 'flomorphic') return 'workflow'
  return o.source.kind === 'folder' ? 'folder' : 'code'
}
function sourceLabel(o: Operation): string {
  if (o.source.kind === 'url') {
    const u = (o.source.url ?? '').replace(/^https?:\/\/(www\.)?/, '')
    return `${u}${o.source.path ? '/' + o.source.path : ''}`
  }
  if (o.source.kind === 'folder') return `folder · ${o.source.folder ?? ''}`
  if (o.source.kind === 'flomorphic') return 'packed from FloMorphic flows'
  return 'pasted manifest'
}

// Deep links still open the wizards: `?import=1` the importer, `?pack=1` the
// packer. Both are also buttons in the header — there is no menu entry for
// them, importing an operation *is* part of installing one.
watch(
  () => [route.query.import, route.query.pack],
  ([imp, pack]) => {
    if (imp === '1') dialog.value = true
    if (pack === '1') packDialog.value = true
    if (imp === '1' || pack === '1') router.replace({ name: 'operations' })
  },
  { immediate: true },
)

onMounted(() => {
  load()
  if (!osctrl.loaded) osctrl.loadSettings()
  if (!flo.loaded) flo.loadSettings()
})
</script>

<template>
  <div class="p-6">
    <div class="mb-1 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">Operations</h1>
      <span class="chip">{{ filtered.length }}</span>
      <span v-if="items.length" class="text-xs text-fg-muted">{{ readyCount }} of {{ items.length }} ready to run</span>
      <div class="ml-auto flex items-center gap-2">
        <input v-model="search" class="field max-w-xs" placeholder="Search operations…" />
        <button class="btn-outline" @click="load()">Refresh</button>
        <button class="btn-outline whitespace-nowrap" title="Package flows from your FloMorphic canvas" @click="packDialog = true">
          <Icon name="workflow" :size="14" /> New from FloMorphic
        </button>
        <button class="btn-primary" @click="dialog = true"><Icon name="download" :size="14" /> Import</button>
      </div>
    </div>
    <p class="mb-4 max-w-3xl text-sm text-fg-muted">
      Packaged FloMorphic workflows that originate data for the pipeline — a fleet sweep that fills Stage, an exposure check that raises
      Findings, a tracker sync that advances Issues. Each package declares what your estate must provide (osctrl, plugins, settings) and
      the parameters that adapt it to your organization. Install one, set its parameters, push its flows into FloMorphic, and run.
    </p>

    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

    <!-- scale / tag filters -->
    <div v-if="items.length" class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div class="flex flex-wrap gap-1.5">
        <button
          class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
          :class="scale === '' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
          @click="scale = ''"
        >
          Any estate
        </button>
        <button
          v-for="s in scales"
          :key="s"
          class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
          :class="scale === s ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
          @click="scale = scale === s ? '' : s"
        >
          {{ SCALE_LABEL[s] }}
        </button>
      </div>
      <select v-if="tags.length" v-model="tag" class="field w-auto py-1 text-xs">
        <option value="">All tags</option>
        <option v-for="t in tags" :key="t" :value="t">#{{ t }}</option>
      </select>
    </div>

    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>

    <!-- empty state -->
    <div v-else-if="items.length === 0" class="card mx-auto max-w-xl p-8 text-center">
      <Icon name="box" :size="32" class="mb-3 text-fg-subtle" />
      <h2 class="mb-1 text-base font-semibold text-fg">No operations installed</h2>
      <p class="mb-4 text-sm text-fg-muted">
        Import a package from a catalog repository or a folder on disk. The shipped example — a Linux fleet HTTP audit that writes one Stage
        row per web server — lives in <code class="font-mono text-xs">examples/operations/</code>.
      </p>
      <div class="flex justify-center gap-2">
        <button class="btn-outline" @click="packDialog = true"><Icon name="workflow" :size="14" /> New from FloMorphic flows</button>
        <button class="btn-primary" @click="dialog = true"><Icon name="download" :size="14" /> Import an operation</button>
      </div>
    </div>

    <p v-else-if="filtered.length === 0" class="text-sm text-fg-subtle">No operation matches the filter.</p>

    <!-- cards -->
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <RouterLink
        v-for="o in filtered"
        :key="o.id"
        :to="operationRoute(o.id)"
        class="card flex flex-col p-4 transition-colors hover:border-accent-border"
      >
        <div class="mb-1 flex items-start gap-2">
          <Icon name="box" :size="18" class="mt-0.5 shrink-0 text-accent" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span class="truncate text-sm font-semibold text-fg">{{ o.name }}</span>
              <span class="font-mono text-[11px] text-fg-subtle">v{{ o.version }}</span>
            </div>
            <p class="truncate text-[11px] text-fg-subtle" :title="sourceLabel(o)">
              <Icon :name="sourceIcon(o)" :size="11" /> {{ sourceLabel(o) }}
            </p>
          </div>
          <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="o.ready ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'"
          >
            <Icon :name="o.ready ? 'checkCircle' : 'alertCircle'" :size="11" :width="2" />
            {{ o.ready ? 'ready' : 'needs setup' }}
          </span>
        </div>

        <p v-if="o.description" class="mb-3 line-clamp-3 text-xs text-fg-muted">{{ o.description }}</p>

        <div class="mt-auto space-y-2">
          <div class="flex flex-wrap gap-1">
            <span v-for="s in o.scale ?? []" :key="s" class="chip-muted"><Icon name="layers" :size="10" /> {{ SCALE_LABEL[s] ?? s }}</span>
            <span v-for="t in (o.tags ?? []).slice(0, 4)" :key="t" class="chip-muted">#{{ t }}</span>
          </div>
          <div class="flex items-center gap-3 text-[11px] text-fg-subtle">
            <span class="inline-flex items-center gap-1" :title="'flows bound to FloMorphic'">
              <Icon name="workflow" :size="11" /> {{ o.flowsBound ?? 0 }}/{{ o.flowsTotal ?? '?' }} flows
            </span>
            <span v-if="o.lastRunAt" class="inline-flex items-center gap-1.5">
              <Badge v-if="o.lastRunStatus" kind="activity-status" :value="o.lastRunStatus" />
              {{ relativeTime(o.lastRunAt) }}
            </span>
            <span v-else class="italic">never run</span>
          </div>
        </div>
      </RouterLink>
    </div>

    <ImportOperationDialog :open="dialog" :installed="installedKeys" @close="dialog = false" @installed="installed" />
    <PackOperationDialog :open="packDialog" @close="packDialog = false" @installed="installed" />
  </div>
</template>
