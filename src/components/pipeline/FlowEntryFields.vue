<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/components/Icon.vue'
import TagsField from '@/components/TagsField.vue'
import JsonEditor from '@/components/json/JsonEditor.vue'
import { coerceEntryValue, entryFields, entryIsSchema, entryRows, entryTarget } from '@/lib/flowEntry'
import type { EntryField, EntryFieldKind, FlowEntryForm } from '@/api/types'

// The renderer for a flow's entry form — the input a flow asks for before it
// runs, declared by whoever designed it rather than typed from memory by
// whoever runs it.
//
// A flow declares that input in whichever of two ways suits the person writing
// it, and this component is where the choice pays off:
//
//   - A JSON SCHEMA → a built form: one typed control per declared property,
//     the same controls an operation's params get, so a flow's form looks like
//     the rest of venapce instead of like a foreign widget set.
//   - A PLAIN JSON OBJECT → a flat key/value table. The easy way in: the
//     document IS what gets seeded, so an author pastes the shape the flow
//     should be given and an operator fills it in. A value that is itself an
//     object or an array is edited as JSON in its own row rather than dropped —
//     the table is for flat documents and this keeps a nested one honest.
//
// And behind both, one view toggle: RAW JSON for the whole document. A built
// form is the better way to fill in a shape someone else designed, but it can
// only draw what it understands, and an operator who knows exactly what they
// want to seed should never be boxed in by it — that was the one virtue of the
// bare JSON box this form replaced, and it is kept.
//
// Nothing here validates against the flow's schema and nothing seeds: the
// engine does both at launch (it writes the one context path the entry names).
// A second implementation of that contract would only drift from it. What this
// component reports is whether the values are even JSON yet.
const props = defineProps<{
  entry: FlowEntryForm
  modelValue: Record<string, unknown>
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, unknown>]; 'update:valid': [ok: boolean] }>()

const isSchema = computed(() => entryIsSchema(props.entry))
const fields = computed(() => entryFields(props.entry))
const rows = computed(() => entryRows(props.entry, props.modelValue))
const target = computed(() => entryTarget(props.entry))

/** The raw-JSON view of the whole document, rather than the built form. */
const raw = ref(false)
const rawValid = ref(true)

/** Per-cell JSON drafts: a half-typed object must survive a keystroke, so the
 *  text is kept until it parses and only then committed. */
const jsonDrafts = ref<Record<string, string>>({})
const jsonErrors = ref<Record<string, string>>({})

/** Valid enough to launch: every JSON cell parses, and in the raw view the
 *  document itself does. The flow's own rules are the engine's to enforce. */
const valid = computed(() => (raw.value ? rawValid.value : Object.keys(jsonErrors.value).length === 0))
watch(valid, (ok) => emit('update:valid', ok), { immediate: true })

/** The path a flow reads this field at — the entry's target plus the key. What
 *  the operator types here is what the graph sees there, and saying so is how
 *  a form teaches the flow it belongs to. */
function pathFor(key: string): string {
  const t = target.value
  return `${t === '$' ? '$' : t}.${key}`
}

function set(key: string, value: unknown) {
  const next = { ...props.modelValue }
  // An empty optional control is an ABSENT field, not `""`: a flow reads those
  // differently, and the engine fills its own defaults in for what is absent.
  if (value === undefined) delete next[key]
  else next[key] = value
  emit('update:modelValue', next)
}

function setField(field: EntryField, value: unknown) {
  set(field.name, coerceEntryValue(field, value))
}

function text(key: string): string {
  const v = props.modelValue[key]
  if (v == null) return ''
  return typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v)
}

function list(key: string): string[] {
  const v = props.modelValue[key]
  return Array.isArray(v) ? v.map(String) : []
}

function checked(field: EntryField): boolean {
  const v = props.modelValue[field.name]
  return v === undefined ? field.default === true : v === true
}

/** What a field shows when it is empty: the default the flow would use, which
 *  is the one thing an operator needs to know before leaving it alone. */
function placeholder(field: EntryField): string {
  if (field.default === undefined) return field.required ? 'required' : ''
  return `default: ${typeof field.default === 'string' ? field.default : JSON.stringify(field.default)}`
}

function jsonText(key: string): string {
  const draft = jsonDrafts.value[key]
  if (draft !== undefined) return draft
  const v = props.modelValue[key]
  return v === undefined ? '' : JSON.stringify(v, null, 2)
}

function onJson(key: string, raw: string) {
  jsonDrafts.value = { ...jsonDrafts.value, [key]: raw }
  const errors = { ...jsonErrors.value }
  delete errors[key]
  if (!raw.trim()) {
    jsonErrors.value = errors
    set(key, undefined)
    return
  }
  try {
    set(key, JSON.parse(raw))
  } catch {
    // Kept as a draft until it parses: the row says so and nothing is committed.
    errors[key] = 'not valid JSON yet'
  }
  jsonErrors.value = errors
}

/** The raw view hands back a whole document. Anything that is not a JSON
 *  object cannot be seeded at a single path, so it reads as invalid here rather
 *  than as a launch the engine refuses. */
function onRaw(v: unknown) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    rawValid.value = true
    emit('update:modelValue', v as Record<string, unknown>)
    return
  }
  rawValid.value = false
}

/** Switching views drops the half-typed cells: the document is the truth now,
 *  and a draft that never parsed was never part of it. */
function toggleRaw() {
  raw.value = !raw.value
  jsonDrafts.value = {}
  jsonErrors.value = {}
  rawValid.value = true
}

/** A number row in the plain table, with a non-numeric entry kept as typed: it
 *  may be a `{{$.path}}` template the engine resolves at run time, exactly as
 *  the node forms allow. */
function numberOrText(raw: string): unknown {
  const t = raw.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isNaN(n) ? raw : n
}

function kindLabel(kind: EntryFieldKind): string {
  return kind === 'string[]' ? 'list' : kind === 'text' ? 'string' : kind
}
</script>

<template>
  <div>
    <!-- The view toggle. Named for what each view IS, not for what it does, so
         the current one reads as a state rather than as a pending action. -->
    <div class="mb-2 flex items-center justify-end gap-1.5 text-[11px]">
      <span class="mr-auto text-fg-subtle">
        Seeded at <code class="font-mono text-fg-muted">{{ target }}</code>
      </span>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors"
        :class="!raw ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
        title="Fill in the form the flow declared"
        @click="raw && toggleRaw()"
      >
        <Icon name="sliders" :size="11" /> Form
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors"
        :class="raw ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
        title="Edit the whole document as JSON"
        @click="!raw && toggleRaw()"
      >
        <Icon name="code" :size="11" /> JSON
      </button>
    </div>

    <!-- The raw view: the document itself, for an operator who knows the shape
         and for anything the built form cannot express. -->
    <JsonEditor
      v-if="raw"
      :model-value="modelValue"
      :rows="8"
      @update:model-value="onRaw"
      @update:valid="rawValid = $event"
    />
    <p v-if="raw && !rawValid" class="mt-1 text-[11px] text-danger">
      The seed has to be a JSON object — one key per field.
    </p>

    <!-- A JSON Schema entry: one typed control per declared property. -->
    <div v-else-if="isSchema" class="space-y-3">
      <p v-if="fields.length === 0" class="flex items-center gap-2 text-xs text-fg-subtle">
        <Icon name="info" :size="14" /> This form declares no fields.
      </p>
      <div v-for="f in fields" :key="f.name">
        <label class="label flex items-center gap-1.5" :for="`entry-${f.name}`">
          {{ f.label }}
          <span v-if="f.required" class="text-danger" title="required">*</span>
          <code class="font-mono text-[10px] normal-case tracking-normal text-fg-subtle">{{ pathFor(f.name) }}</code>
        </label>

        <label v-if="f.kind === 'boolean'" class="inline-flex items-center gap-2 text-sm text-fg">
          <input
            :id="`entry-${f.name}`"
            type="checkbox"
            :checked="checked(f)"
            :disabled="disabled"
            @change="setField(f, ($event.target as HTMLInputElement).checked)"
          />
          {{ f.description || 'enabled' }}
        </label>

        <select
          v-else-if="f.kind === 'enum'"
          :id="`entry-${f.name}`"
          class="field"
          :disabled="disabled"
          :value="text(f.name)"
          @change="setField(f, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ placeholder(f) || '—' }}</option>
          <option v-for="opt in f.options" :key="String(opt)" :value="String(opt)">{{ String(opt) }}</option>
        </select>

        <TagsField
          v-else-if="f.kind === 'string[]'"
          :model-value="list(f.name)"
          :placeholder="placeholder(f)"
          @update:model-value="setField(f, $event)"
        />

        <!-- A shape the built form will not pretend to draw: edited as the JSON
             it is, in place, so the rest of the form still works. -->
        <textarea
          v-else-if="f.kind === 'json'"
          :id="`entry-${f.name}`"
          class="field min-h-[5rem] font-mono text-xs"
          :class="jsonErrors[f.name] ? 'border-danger' : ''"
          :value="jsonText(f.name)"
          :placeholder="placeholder(f)"
          :disabled="disabled"
          spellcheck="false"
          @input="onJson(f.name, ($event.target as HTMLTextAreaElement).value)"
        ></textarea>

        <textarea
          v-else-if="f.kind === 'text'"
          :id="`entry-${f.name}`"
          class="field min-h-[4.5rem]"
          :value="text(f.name)"
          :placeholder="placeholder(f)"
          :disabled="disabled"
          @input="setField(f, ($event.target as HTMLTextAreaElement).value)"
        ></textarea>

        <input
          v-else
          :id="`entry-${f.name}`"
          class="field"
          :type="f.kind === 'number' ? 'number' : f.secret ? 'password' : (f.inputType ?? 'text')"
          :value="text(f.name)"
          :placeholder="placeholder(f)"
          :disabled="disabled"
          @input="setField(f, ($event.target as HTMLInputElement).value)"
        />

        <p v-if="jsonErrors[f.name]" class="mt-1 text-[11px] text-danger">{{ jsonErrors[f.name] }}</p>
        <p v-else-if="f.description && f.kind !== 'boolean'" class="mt-1 text-[11px] text-fg-subtle">{{ f.description }}</p>
      </div>
    </div>

    <!-- A plain-values entry: the document the author pasted, as a table. -->
    <div v-else-if="rows.length" class="divide-y divide-line overflow-hidden rounded-md border border-line">
      <div v-for="row in rows" :key="row.key" class="grid grid-cols-[minmax(6rem,9rem)_1fr] items-start gap-3 px-3 py-2">
        <label class="min-w-0 pt-1.5 text-xs font-medium text-fg" :for="`entry-${row.key}`" :title="pathFor(row.key)">
          <span class="break-words font-mono">{{ row.key }}</span>
          <span
            v-if="!row.declared"
            class="ml-1 text-[10px] font-normal uppercase tracking-wide text-fg-subtle"
            title="Supplied for this run, but not in the flow's entry document"
          >
            extra
          </span>
        </label>

        <div class="min-w-0">
          <input
            v-if="row.kind === 'boolean'"
            :id="`entry-${row.key}`"
            type="checkbox"
            class="mt-1.5 h-4 w-4"
            :disabled="disabled"
            :checked="modelValue[row.key] === true"
            @change="set(row.key, ($event.target as HTMLInputElement).checked)"
          />
          <input
            v-else-if="row.kind === 'number'"
            :id="`entry-${row.key}`"
            class="field"
            :disabled="disabled"
            :value="text(row.key)"
            @input="set(row.key, numberOrText(($event.target as HTMLInputElement).value))"
          />
          <textarea
            v-else-if="row.kind === 'json'"
            :id="`entry-${row.key}`"
            class="field min-h-[5rem] font-mono text-xs"
            :class="jsonErrors[row.key] ? 'border-danger' : ''"
            :disabled="disabled"
            :value="jsonText(row.key)"
            spellcheck="false"
            @input="onJson(row.key, ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <input
            v-else
            :id="`entry-${row.key}`"
            class="field"
            :disabled="disabled"
            :value="text(row.key)"
            @input="set(row.key, ($event.target as HTMLInputElement).value || undefined)"
          />
          <p v-if="jsonErrors[row.key]" class="mt-1 text-[11px] text-danger">{{ jsonErrors[row.key] }}</p>
          <p v-else class="mt-1 text-[10px] text-fg-subtle">{{ kindLabel(row.kind) }}</p>
        </div>
      </div>
    </div>

    <p v-else class="flex items-center gap-2 text-xs text-fg-subtle">
      <Icon name="info" :size="14" /> This entry form has no fields yet.
    </p>
  </div>
</template>
