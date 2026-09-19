<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/Icon.vue'

// Tag chips with an inline input: Enter / comma adds, Backspace on an empty
// input removes the last, × removes one.
const props = defineProps<{ modelValue: string[]; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [tags: string[]] }>()

const draft = ref('')

function commit() {
  const parts = draft.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  if (parts.length) emit('update:modelValue', [...new Set([...props.modelValue, ...parts])])
  draft.value = ''
}
function remove(i: number) {
  const next = [...props.modelValue]
  next.splice(i, 1)
  emit('update:modelValue', next)
}
function onBackspace() {
  if (draft.value === '' && props.modelValue.length) remove(props.modelValue.length - 1)
}
</script>

<template>
  <div class="field flex min-h-[2.5rem] flex-wrap items-center gap-1.5 py-1.5">
    <span v-for="(t, i) in modelValue" :key="t" class="chip-muted">
      {{ t }}
      <button class="-mr-0.5 rounded-full p-0.5 text-fg-subtle hover:text-danger" type="button" @click="remove(i)">
        <Icon name="close" :size="10" />
      </button>
    </span>
    <input
      v-model="draft"
      class="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
      :placeholder="modelValue.length ? '' : placeholder ?? 'Add tag, Enter to commit'"
      @keydown.enter.prevent="commit"
      @keydown.,.prevent="commit"
      @keydown.backspace="onBackspace"
      @blur="commit"
    />
  </div>
</template>
