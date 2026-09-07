<script setup lang="ts">
import { computed, ref } from 'vue'
import { POPULAR_VIZ, SUPPORTED_COUNT, vizEntry } from '@/lib/vizCatalog'
import type { VizType } from '@/lib/builder'
import Icon from '@/components/Icon.vue'
import VizTypeDialog from './VizTypeDialog.vue'

// Superset's pattern: a handful of common types inline, everything else behind
// a "View all charts" dialog. The current type is always one of the tiles —
// when it isn't popular, it takes the last slot.
const props = defineProps<{ modelValue: VizType }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: VizType): void }>()

const open = ref(false)

const tiles = computed(() => {
  const keys: VizType[] = [...POPULAR_VIZ]
  if (!keys.includes(props.modelValue)) keys[keys.length - 1] = props.modelValue
  return keys.map((k) => ({ key: k, entry: vizEntry(k) }))
})

const current = computed(() => vizEntry(props.modelValue))
</script>

<template>
  <div>
    <div class="mb-1 flex items-center justify-between">
      <label class="label mb-0">Visualization</label>
      <button
        class="btn-sm text-accent hover:bg-accent-soft"
        :title="`Browse every chart type · ${SUPPORTED_COUNT} render natively`"
        @click="open = true"
      >
        <Icon name="chartMapGrid" :size="13" />
        All charts
      </button>
    </div>

    <div class="grid grid-cols-5 gap-1.5">
      <button
        v-for="t in tiles"
        :key="t.key"
        class="flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[10px] leading-tight"
        :class="
          modelValue === t.key
            ? 'border-accent-border bg-accent-soft text-accent'
            : 'border-line text-fg-muted hover:bg-bg'
        "
        :title="t.entry?.description"
        @click="emit('update:modelValue', t.key)"
      >
        <Icon :name="t.entry?.icon ?? 'chartBar'" :size="20" />
        <span class="w-full truncate text-center">{{ t.entry?.name }}</span>
      </button>
    </div>

    <p v-if="current" class="mt-1.5 text-[11px] leading-snug text-fg-subtle">{{ current.description }}</p>

    <VizTypeDialog
      :open="open"
      :selected="modelValue"
      @close="open = false"
      @select="emit('update:modelValue', $event)"
    />
  </div>
</template>
