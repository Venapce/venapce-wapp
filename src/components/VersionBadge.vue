<script setup lang="ts">
import { onMounted } from 'vue'
import { useVersionStore } from '@/stores/version'

// The running appliance version, sitting at the foot of the sidebar under the
// connection rows. Panel and API ship as one release, so a single line is
// enough; the tooltip carries both sides and a mismatch (usually a stale
// cached bundle) is called out in colour.
const version = useVersionStore()

onMounted(() => version.load())
</script>

<template>
  <div
    class="mt-2 border-t border-line px-2.5 pb-1 pt-2 text-center text-[11px] leading-4"
    :class="version.mismatch ? 'text-warning' : 'text-fg-subtle'"
    :title="version.mismatch ? `${version.detail}\n\nPanel and API versions differ — reload to pick up the current build.` : version.detail"
  >
    <div class="font-mono">Venapce - {{ version.panel }}</div>
    <div>by Inflowenger Dev. Team</div>
  </div>
</template>
