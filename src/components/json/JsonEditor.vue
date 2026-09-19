<script setup lang="ts">
import { ref, watch } from 'vue'

// A textarea for editing one JSON document with live validation. The model is
// the parsed value (any shape); the textarea holds its pretty-printed text.
// While the text does not parse, the model is left untouched and `valid` is
// false — the parent disables Save on that.
const props = defineProps<{ modelValue: unknown; rows?: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; 'update:valid': [ok: boolean] }>()

const text = ref(pretty(props.modelValue))
const error = ref('')

function pretty(v: unknown) {
  return JSON.stringify(v ?? {}, null, 2)
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}

// Keep the text in sync when the parent swaps the model (e.g. after a reload),
// but not on our own emits — comparing the serialised form avoids the loop.
watch(
  () => props.modelValue,
  (v) => {
    if (!error.value && pretty(v) !== pretty(safeParse(text.value))) text.value = pretty(v)
  },
)

function onInput() {
  try {
    const v = text.value.trim() === '' ? {} : JSON.parse(text.value)
    error.value = ''
    emit('update:modelValue', v)
    emit('update:valid', true)
  } catch (e) {
    error.value = (e as Error).message.replace(/^JSON\.parse: /, '')
    emit('update:valid', false)
  }
}

function format() {
  if (error.value) return
  text.value = pretty(safeParse(text.value))
}
</script>

<template>
  <div>
    <textarea
      v-model="text"
      class="field min-h-[8rem] resize-y font-mono text-xs leading-5"
      :class="error ? 'border-danger focus:border-danger' : ''"
      :rows="rows ?? 8"
      spellcheck="false"
      @input="onInput"
      @blur="format"
    />
    <p v-if="error" class="mt-1 text-[11px] text-danger">Invalid JSON — {{ error }}</p>
  </div>
</template>
