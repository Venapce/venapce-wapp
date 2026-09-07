<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/Icon.vue'

// A collapsible group in the config panel — the equivalent of Superset's
// "Data" / "Chart Options" / "Advanced Analytics" accordions.
const props = defineProps<{ title: string; hint?: string; open?: boolean }>()
const expanded = ref(props.open !== false)
</script>

<template>
  <section class="rounded-md border border-line">
    <button
      class="flex w-full items-center gap-2 px-3 py-2 text-left"
      @click="expanded = !expanded"
    >
      <span class="text-xs font-semibold uppercase tracking-wide text-fg-muted">{{ title }}</span>
      <Icon
        name="chevronDown"
        :size="14"
        class="ml-auto text-fg-subtle transition-transform"
        :class="expanded ? '' : '-rotate-90'"
      />
    </button>
    <div v-if="expanded" class="space-y-3 border-t border-line p-3">
      <p v-if="hint" class="text-[11px] leading-snug text-fg-subtle">{{ hint }}</p>
      <slot />
    </div>
  </section>
</template>
