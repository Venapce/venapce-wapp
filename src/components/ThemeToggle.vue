<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import Icon from '@/components/Icon.vue'

// The theme selector (ported from FloMorphic): cycles light → dark → system,
// showing sun / moon / monitor from the shared icon set.
const ui = useUiStore()
const label = computed(() => `Theme: ${ui.theme}`)
const icon = computed(() => (ui.theme === 'light' ? 'sun' : ui.theme === 'dark' ? 'moon' : 'monitor'))
</script>

<template>
  <button
    class="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-accent-soft hover:text-fg"
    :title="label"
    @click="ui.cycleTheme()"
  >
    <Icon :name="icon" :size="17" :width="2" />
  </button>
</template>
