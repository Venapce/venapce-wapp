<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { readinessSummary } from '@/lib/operations'
import type { ReadinessCheck } from '@/api/types'

// The requirement checklist of an operation: one line per check with its
// verdict glyph, the reason, and where it is fixed (a panel route or an
// external link). `unknown` is a check only the operator can confirm (a
// settings profile to pick, a plugin the backend could not see).
const props = defineProps<{ checks: ReadinessCheck[]; compact?: boolean }>()

const summary = computed(() => readinessSummary(props.checks))

const GLYPH: Record<ReadinessCheck['status'], { icon: string; cls: string }> = {
  ok: { icon: 'checkCircle', cls: 'text-success' },
  missing: { icon: 'xCircle', cls: 'text-danger' },
  unknown: { icon: 'alertCircle', cls: 'text-warning' },
}
const KIND_ICON: Record<ReadinessCheck['kind'], string> = {
  osctrl: 'monitor',
  plugin: 'layers',
  settings: 'sliders',
  operation: 'box',
  dataset: 'database',
  flow: 'workflow',
  param: 'sliders',
}
</script>

<template>
  <div>
    <div v-if="!compact" class="mb-2 flex flex-wrap items-center gap-2 text-xs">
      <span class="inline-flex items-center gap-1 text-success"><Icon name="checkCircle" :size="13" /> {{ summary.ok }} ready</span>
      <span v-if="summary.missing" class="inline-flex items-center gap-1 text-danger"><Icon name="xCircle" :size="13" /> {{ summary.missing }} missing</span>
      <span v-if="summary.unknown" class="inline-flex items-center gap-1 text-warning"><Icon name="alertCircle" :size="13" /> {{ summary.unknown }} to confirm</span>
    </div>
    <p v-if="checks.length === 0" class="text-xs text-fg-subtle">Nothing required beyond FloMorphic itself.</p>
    <ul v-else class="divide-y divide-line rounded-md border border-line">
      <li v-for="(c, i) in checks" :key="i" class="flex items-start gap-2.5 px-3 py-2">
        <Icon :name="GLYPH[c.status].icon" :size="15" :class="[GLYPH[c.status].cls, 'mt-0.5 shrink-0']" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 text-sm text-fg">
            <Icon :name="KIND_ICON[c.kind]" :size="12" class="text-fg-subtle" />
            <span class="truncate">{{ c.label }}</span>
          </div>
          <p v-if="c.detail" class="mt-0.5 break-words text-xs text-fg-muted">{{ c.detail }}</p>
        </div>
        <RouterLink v-if="c.fix && c.status !== 'ok'" :to="{ name: c.fix }" class="btn-outline btn-sm shrink-0">Fix</RouterLink>
        <a v-else-if="c.href && c.status !== 'ok'" :href="c.href" target="_blank" rel="noopener" class="btn-outline btn-sm shrink-0">
          <Icon name="external" :size="12" /> Get
        </a>
      </li>
    </ul>
  </div>
</template>
