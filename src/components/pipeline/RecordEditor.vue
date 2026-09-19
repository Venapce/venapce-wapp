<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import JsonEditor from '@/components/json/JsonEditor.vue'
import TagsField from '@/components/TagsField.vue'
import type { FieldSpec } from '@/lib/pipeline'

// Spec-driven edit form for a pipeline row. Holds a draft copy of the fields
// it was given; on Save it emits ONLY the fields that changed (the update
// endpoints are partial), so an untouched JSON document is never rewritten.
const props = defineProps<{
  fields: FieldSpec[]
  row: Record<string, unknown>
  saving?: boolean
  error?: string
}>()
const emit = defineEmits<{ save: [patch: Record<string, unknown>]; cancel: [] }>()

// `any` rather than `unknown`: the inputs v-model straight into the draft,
// and each field's kind (not its static type) says what lives in it.
const draft = reactive<Record<string, any>>({})
const jsonValid = reactive<Record<string, boolean>>({})

function reset() {
  for (const f of props.fields) {
    const v = props.row[f.key]
    draft[f.key] = f.kind === 'tags' ? [...((v as string[]) ?? [])] : f.kind === 'json' ? clone(v ?? {}) : (v ?? '')
    jsonValid[f.key] = true
  }
}
watch(() => props.row, reset, { immediate: true })

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

const allValid = () => Object.values(jsonValid).every(Boolean)

function changed(f: FieldSpec): boolean {
  const a = draft[f.key]
  const b = props.row[f.key]
  if (f.kind === 'tags' || f.kind === 'json') return JSON.stringify(a) !== JSON.stringify(b ?? (f.kind === 'tags' ? [] : {}))
  if (f.kind === 'number') return Number(a) !== Number(b ?? 0)
  return String(a ?? '') !== String(b ?? '')
}

function submit() {
  if (!allValid()) return
  const patch: Record<string, unknown> = {}
  for (const f of props.fields) {
    if (!changed(f)) continue
    patch[f.key] = f.kind === 'number' ? Number(draft[f.key]) || 0 : draft[f.key]
  }
  emit('save', patch)
}

const listId = ref(`sugg-${Math.random().toString(36).slice(2, 8)}`)
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="f in fields"
        :key="f.key"
        :class="f.kind === 'json' || f.kind === 'textarea' || f.kind === 'tags' ? 'md:col-span-2' : ''"
      >
        <label class="label" :for="`f-${f.key}`">{{ f.label }}</label>

        <select v-if="f.kind === 'select'" :id="`f-${f.key}`" v-model="draft[f.key]" class="field">
          <option v-for="o in f.options" :key="o" :value="o">{{ o.replace(/_/g, ' ') }}</option>
        </select>

        <template v-else-if="f.kind === 'suggest'">
          <input :id="`f-${f.key}`" v-model="draft[f.key]" class="field" :list="`${listId}-${f.key}`" :class="f.mono ? 'font-mono text-xs' : ''" />
          <datalist :id="`${listId}-${f.key}`">
            <option v-for="o in f.options" :key="o" :value="o" />
          </datalist>
        </template>

        <textarea v-else-if="f.kind === 'textarea'" :id="`f-${f.key}`" v-model="draft[f.key]" class="field min-h-[4rem]" rows="3" />

        <TagsField v-else-if="f.kind === 'tags'" v-model="draft[f.key] as string[]" />

        <JsonEditor
          v-else-if="f.kind === 'json'"
          v-model="draft[f.key]"
          @update:valid="jsonValid[f.key] = $event"
        />

        <input
          v-else
          :id="`f-${f.key}`"
          v-model="draft[f.key]"
          class="field"
          :type="f.kind === 'number' ? 'number' : 'text'"
          :class="f.mono ? 'font-mono text-xs' : ''"
        />
        <p v-if="f.hint" class="mt-1 text-[11px] text-fg-subtle">{{ f.hint }}</p>
      </div>
    </div>

    <p v-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

    <div class="flex items-center gap-2">
      <button type="submit" class="btn-primary" :disabled="saving || !allValid()">{{ saving ? 'Saving…' : 'Save changes' }}</button>
      <button type="button" class="btn-outline" :disabled="saving" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
