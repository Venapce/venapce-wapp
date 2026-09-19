<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import TagChip from './TagChip.vue'
import JsonPanel from '@/components/json/JsonPanel.vue'
import PipelineChain from './PipelineChain.vue'
import RecordFields from './RecordFields.vue'
import RecordEditor from './RecordEditor.vue'
import { JSON_DOCS, type FieldSpec } from '@/lib/pipeline'
import { relativeTime } from '@/lib/format'

// The detail page every pipeline table shares: back link + title + badges,
// the row's place in the stage → finding → issue chain, its fields (or the
// editor), and the three JSON documents as explorable trees. The view that
// wraps it supplies the badges, the actions (promote / delete) and any related
// rows through slots; it owns loading and saving.
const props = defineProps<{
  kind: 'stage' | 'finding' | 'issue'
  /** Where "← back" goes and what it says. */
  backTo: { name: string }
  backLabel: string
  row: Record<string, unknown> | null
  fields: FieldSpec[]
  loading: boolean
  error: string
  /** Rendering a built-in sample because the backend is unreachable. */
  sample: boolean
  editing: boolean
  saving: boolean
  saveError: string
  /** A transient success line (e.g. after a promote), with an optional link. */
  notice?: { text: string; to?: { name: string; params: Record<string, string> }; linkText?: string } | null
}>()

const emit = defineEmits<{
  edit: []
  cancel: []
  save: [patch: Record<string, unknown>]
  remove: []
  refresh: []
}>()

const title = computed(() => (props.row?.title as string) || `${props.kind} #${props.row?.id ?? ''}`)

// The three typed links, read from whichever the row carries. The row's own
// id fills its level.
const ids = computed(() => {
  const r = props.row ?? {}
  return {
    stageId: props.kind === 'stage' ? r.id : r.stageId,
    findingId: props.kind === 'finding' ? r.id : r.findingId,
    issueId: props.kind === 'issue' ? r.id : r.issueId,
  } as { stageId?: number | string | null; findingId?: number | string | null; issueId?: number | string | null }
})

// Producers often write the summary as a pipe-separated fact list
// ("host-a | nginx: host | http listeners: 11 | hostnames: 14"). When it reads
// that way, show each fact as a chip (label: value) instead of a flat line.
const summaryFacts = computed<{ label: string; value: string }[] | null>(() => {
  const text = String(props.row?.summary ?? '')
  if (!text.includes('|')) return null
  const parts = text.split('|').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const facts = parts.map((p) => {
    const i = p.indexOf(':')
    return i > 0 && i < 40 ? { label: p.slice(0, i).trim(), value: p.slice(i + 1).trim() } : { label: '', value: p }
  })
  // A real fact list has mostly labelled parts; otherwise it is just prose.
  return facts.filter((f) => f.label).length >= Math.ceil(parts.length / 2) ? facts : null
})

const timestamps = computed(() => {
  const r = props.row ?? {}
  const out: { label: string; iso: string }[] = []
  for (const [k, label] of [
    ['receivedAt', 'Received'],
    ['createdAt', 'Created'],
    ['updatedAt', 'Updated'],
  ] as const) {
    if (r[k]) out.push({ label, iso: String(r[k]) })
  }
  return out
})
</script>

<template>
  <div class="p-6">
    <!-- breadcrumb + actions -->
    <div class="mb-3 flex items-center gap-2 text-xs text-fg-muted">
      <RouterLink :to="backTo" class="inline-flex items-center gap-1 hover:text-accent">
        <Icon name="chevronLeft" :size="14" />
        {{ backLabel }}
      </RouterLink>
      <span class="text-fg-subtle">/</span>
      <span class="font-mono">#{{ row?.id ?? '…' }}</span>
      <div class="ml-auto flex items-center gap-2">
        <slot name="actions" />
        <button v-if="!editing" class="btn-outline btn-sm" :disabled="!row || sample" title="Edit this row" @click="emit('edit')">
          <Icon name="pencil" :size="13" /> Edit
        </button>
        <button class="btn-danger btn-sm" :disabled="!row || sample" title="Delete this row" @click="emit('remove')">
          <Icon name="trash" :size="13" /> Delete
        </button>
        <button class="icon-btn-sm" title="Reload" @click="emit('refresh')"><Icon name="refresh" :size="14" /></button>
      </div>
    </div>

    <div v-if="sample" class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
      Showing a built-in sample row — the backend has no row with this id (or isn't reachable), so editing is disabled.
    </div>
    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
    <p v-if="notice" class="mb-4 flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
      <Icon name="check" :size="14" />
      {{ notice.text }}
      <RouterLink v-if="notice.to" :to="notice.to" class="font-medium underline">{{ notice.linkText ?? 'open' }}</RouterLink>
    </p>

    <p v-if="loading && !row" class="text-sm text-fg-subtle">Loading…</p>

    <template v-else-if="row">
      <!-- header: title, summary, then the row's lifecycle + facts as chips
           (supplied by the view), then its tags -->
      <div class="mb-5">
        <h1 class="text-xl font-semibold leading-tight text-fg">{{ title }}</h1>
        <div v-if="summaryFacts" class="mt-2.5 flex flex-wrap items-center gap-1.5">
          <!-- two-tone fact pills: label on the muted side, value on the bright side -->
          <span
            v-for="(f, i) in summaryFacts"
            :key="i"
            class="inline-flex items-stretch overflow-hidden rounded-md border border-line text-xs leading-none shadow-sm"
          >
            <span v-if="f.label" class="flex items-center gap-1 bg-surface-2 px-2 py-1.5 text-fg-muted">
              {{ f.label }}
            </span>
            <span
              class="flex items-center px-2 py-1.5 font-semibold"
              :class="[
                /^-?\d+([.,]\d+)?%?$/.test(f.value) ? 'bg-accent-soft text-accent' : 'bg-surface text-fg',
                f.label ? '' : 'gap-1.5 font-mono',
              ]"
            >
              <Icon v-if="!f.label" name="monitor" :size="12" class="text-fg-subtle" />
              {{ f.value }}
            </span>
          </span>
        </div>
        <p v-else-if="row.summary" class="mt-1 max-w-3xl text-sm text-fg-muted">{{ row.summary }}</p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <slot name="badges" />
        </div>
        <div v-if="(row.tags as string[] | undefined)?.length" class="mt-2 flex flex-wrap items-center gap-1.5">
          <Icon name="tag" :size="13" class="text-fg-subtle" />
          <TagChip v-for="t in row.tags as string[]" :key="t" :tag="t" size="md" />
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-subtle">
          <span v-for="t in timestamps" :key="t.label" :title="t.iso" class="inline-flex items-center gap-1">
            <Icon name="clock" :size="11" />{{ t.label }} {{ relativeTime(t.iso) }}
          </span>
        </div>
      </div>

      <!-- pipeline position -->
      <div class="mb-5">
        <h3 class="label">Pipeline</h3>
        <PipelineChain :current="kind" v-bind="ids" />
      </div>

      <!-- Two columns while viewing (fields | documents); the editor, which holds
           the documents itself, takes the full width. -->
      <div class="grid gap-5" :class="editing ? 'max-w-4xl' : 'xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]'">
        <!-- left: fields / editor -->
        <div class="min-w-0 space-y-5">
          <section>
            <h3 class="label">{{ editing ? 'Edit' : 'Fields' }}</h3>
            <div v-if="editing" class="card p-4">
              <RecordEditor
                :fields="fields"
                :row="row"
                :saving="saving"
                :error="saveError"
                @save="emit('save', $event)"
                @cancel="emit('cancel')"
              />
            </div>
            <RecordFields v-else :fields="fields" :row="row" />
          </section>
          <slot name="related" />
        </div>

        <!-- right: the free-form documents -->
        <div v-if="!editing" class="min-w-0 space-y-4">
          <JsonPanel
            v-for="d in JSON_DOCS"
            :key="d.key"
            :title="d.label"
            :hint="d.hint"
            :value="row[d.key]"
            :collapsed="d.key === 'ref'"
          />
        </div>
      </div>
    </template>
  </div>
</template>
