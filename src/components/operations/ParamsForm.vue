<script setup lang="ts">
import { computed } from 'vue'
import TagsField from '@/components/TagsField.vue'
import { coerceParam } from '@/lib/operations'
import type { OperationParamSpec } from '@/api/types'

// The operator's knobs of an operation, rendered from the manifest's `params`:
// one control per declared param, typed by its spec. Values are emitted
// already coerced to the declared type; an empty control means "use the
// default" (the effective value is resolved by lib/operations.effectiveParams).
const props = defineProps<{
  specs: Record<string, OperationParamSpec>
  modelValue: Record<string, unknown>
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, unknown>] }>()

const entries = computed(() => Object.entries(props.specs))

function set(name: string, raw: unknown) {
  const spec = props.specs[name]!
  const next = { ...props.modelValue }
  const v = coerceParam(spec, raw)
  if (v === undefined || v === '') delete next[name]
  else next[name] = v
  emit('update:modelValue', next)
}
function text(name: string): string {
  const v = props.modelValue[name]
  if (v == null) return ''
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : JSON.stringify(v, null, 2)
}
function list(name: string): string[] {
  const v = props.modelValue[name] ?? props.specs[name]?.default
  return Array.isArray(v) ? v.map(String) : []
}
function placeholder(spec: OperationParamSpec): string {
  if (spec.default === undefined) return spec.required ? 'required' : ''
  return `default: ${typeof spec.default === 'string' ? spec.default : JSON.stringify(spec.default)}`
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="entries.length === 0" class="text-xs text-fg-subtle">This operation has no parameters.</p>
    <div v-for="[name, spec] in entries" :key="name">
      <label class="label flex items-center gap-1.5">
        {{ spec.label || name }}
        <span v-if="spec.required" class="text-danger" title="required">*</span>
        <code class="font-mono text-[10px] normal-case tracking-normal text-fg-subtle">${param.{{ name }}}</code>
      </label>

      <label v-if="spec.type === 'boolean'" class="inline-flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          :checked="modelValue[name] === undefined ? !!spec.default : !!modelValue[name]"
          :disabled="disabled"
          @change="set(name, ($event.target as HTMLInputElement).checked)"
        />
        {{ spec.description || 'enabled' }}
      </label>

      <select v-else-if="spec.enum" class="field" :disabled="disabled" :value="text(name)" @change="set(name, ($event.target as HTMLSelectElement).value)">
        <option value="">{{ placeholder(spec) || '—' }}</option>
        <option v-for="opt in spec.enum" :key="String(opt)" :value="String(opt)">{{ String(opt) }}</option>
      </select>

      <TagsField v-else-if="spec.type === 'string[]'" :model-value="list(name)" :placeholder="placeholder(spec)" @update:model-value="set(name, $event)" />

      <textarea
        v-else-if="spec.type === 'json'"
        class="field min-h-[5rem] font-mono text-xs"
        :value="text(name)"
        :placeholder="placeholder(spec)"
        :disabled="disabled"
        spellcheck="false"
        @change="set(name, ($event.target as HTMLTextAreaElement).value)"
      ></textarea>

      <input
        v-else
        class="field"
        :type="spec.type === 'number' ? 'number' : spec.secret ? 'password' : 'text'"
        :value="text(name)"
        :placeholder="placeholder(spec)"
        :disabled="disabled"
        @change="set(name, ($event.target as HTMLInputElement).value)"
      />
      <p v-if="spec.description && spec.type !== 'boolean'" class="mt-1 text-[11px] text-fg-subtle">{{ spec.description }}</p>
    </div>
  </div>
</template>
