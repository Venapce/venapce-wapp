<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

// The theme selector widget (ported from FloMorphic): cycles light → dark →
// system, showing sun / moon / monitor. Self-contained inline SVGs so it carries
// no icon-library dependency.
const ui = useUiStore()
const label = computed(() => `Theme: ${ui.theme}`)
</script>

<template>
  <button
    class="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-accent-soft hover:text-fg"
    :title="label"
    @click="ui.cycleTheme()"
  >
    <!-- light -->
    <svg v-if="ui.theme === 'light'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
    <!-- dark -->
    <svg v-else-if="ui.theme === 'dark'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
    <!-- system -->
    <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  </button>
</template>
