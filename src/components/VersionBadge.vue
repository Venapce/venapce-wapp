<script setup lang="ts">
import { onMounted } from 'vue'
import { useVersionStore } from '@/stores/version'

// The running appliance version, pinned in the top bar next to the theme
// selector. Shows the panel's own build; the tooltip adds the backend's, and a
// mismatch between the two is called out (usually a stale cached bundle).
const version = useVersionStore()

onMounted(() => version.load())
</script>

<template>
  <span
    class="rounded-md px-1.5 py-0.5 font-mono text-[11px] leading-none"
    :class="version.mismatch ? 'bg-warning-soft text-warning' : 'text-fg-subtle'"
    :title="version.mismatch ? `${version.detail}\n\nPanel and API versions differ — reload to pick up the current build.` : version.detail"
  >
    {{ version.panel }}
  </span>
</template>
