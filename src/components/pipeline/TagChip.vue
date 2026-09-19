<script setup lang="ts">
import Icon from '@/components/Icon.vue'

// A tag as a hash-chip. Optionally clickable (list views toggle a filter);
// `active` marks a tag that is currently filtering.
defineProps<{ tag: string; active?: boolean; clickable?: boolean; size?: 'sm' | 'md' }>()
const emit = defineEmits<{ click: [tag: string] }>()
</script>

<template>
  <component
    :is="clickable ? 'button' : 'span'"
    :type="clickable ? 'button' : undefined"
    class="inline-flex items-center gap-0.5 rounded-full border font-medium transition-colors"
    :class="[
      size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]',
      active
        ? 'border-accent bg-accent text-accent-fg'
        : 'border-accent-border bg-accent-soft text-accent',
      clickable ? 'hover:border-accent hover:bg-accent hover:text-accent-fg' : '',
    ]"
    @click="clickable && emit('click', tag)"
  >
    <Icon name="hash" :size="size === 'md' ? 12 : 10" :width="2" class="opacity-70" />{{ tag }}
  </component>
</template>
