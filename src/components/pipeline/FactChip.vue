<script setup lang="ts">
import Icon from '@/components/Icon.vue'

// A neutral "fact" chip for the detail header: an icon, a faint label and the
// value (target, source, origin, category …). Renders nothing for an empty
// value so the header only shows what the row actually has.
defineProps<{ icon: string; label: string; value?: string | null; mono?: boolean }>()
</script>

<template>
  <span
    v-if="value"
    class="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg"
    :title="`${label}: ${value}`"
  >
    <Icon :name="icon" :size="13" class="shrink-0 text-fg-subtle" />
    <span class="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">{{ label }}</span>
    <span class="truncate" :class="mono ? 'font-mono text-[11px]' : ''">{{ value }}</span>
  </span>
</template>
