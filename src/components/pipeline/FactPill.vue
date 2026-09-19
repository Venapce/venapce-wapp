<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import { factText } from '@/lib/pipeline'

// A two-tone "label: value" pill — the label on the muted side, the value on
// the bright side. Used for a producer's summary facts and for an activity's
// typed facts ([{k, v}]): a numeric value reads as a figure, a severity-like
// value carries its own colour so "severity: high" stands out in a row of
// pills.
const props = defineProps<{ label?: string; value: unknown; icon?: string }>()

const SEVERITY_TONE: Record<string, string> = {
  critical: 'bg-danger-soft text-danger',
  high: 'bg-danger-soft text-danger',
  medium: 'bg-warning-soft text-warning',
  low: 'bg-surface-2 text-fg-muted',
  info: 'bg-accent-soft text-accent',
}

function tone(): string {
  const t = factText(props.value)
  const key = (props.label ?? '').toLowerCase()
  if ((key === 'severity' || key === 'risk' || key === 'level') && SEVERITY_TONE[t.toLowerCase()]) {
    return SEVERITY_TONE[t.toLowerCase()]
  }
  if (/^-?\d+([.,]\d+)?%?$/.test(t)) return 'bg-accent-soft text-accent'
  if (typeof props.value === 'boolean') return props.value ? 'bg-success-soft text-success' : 'bg-surface-2 text-fg-muted'
  return 'bg-surface text-fg'
}
</script>

<template>
  <span
    class="inline-flex max-w-full items-stretch overflow-hidden rounded-md border border-line text-xs leading-none shadow-sm"
    :title="`${label ? label + ': ' : ''}${factText(value)}`"
  >
    <span v-if="label" class="flex items-center gap-1 bg-surface-2 px-2 py-1.5 text-fg-muted">
      <Icon v-if="icon" :name="icon" :size="11" class="text-fg-subtle" />
      {{ label }}
    </span>
    <span class="flex min-w-0 items-center px-2 py-1.5 font-semibold" :class="[tone(), label ? '' : 'gap-1.5 font-mono']">
      <Icon v-if="!label && icon" :name="icon" :size="12" class="text-fg-subtle" />
      <span class="truncate">{{ factText(value) }}</span>
    </span>
  </span>
</template>
