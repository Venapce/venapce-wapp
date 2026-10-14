<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { errorKindCounts, errorSummary } from '@/lib/runErrors'
import type { RunErrors } from '@/api/types'

/**
 * "This run hit things" — the chip that keeps a run which recorded errors from
 * reading like a clean one.
 *
 * A flow does not stop for a node error, so the status badge next to this one
 * can quite legitimately say `finished` on a run that failed at half its
 * nodes. This is the counterweight, and it carries the count so the scale is
 * visible without opening anything. Clicking it (when the view can expand)
 * lists what they were.
 */
const props = withDefaults(defineProps<{ errors: RunErrors; expanded?: boolean; interactive?: boolean }>(), {
  expanded: false,
  interactive: true,
})
defineEmits<{ toggle: [] }>()

const counts = computed(() => errorKindCounts(props.errors.items))
/** All-platform ledgers are toned down: nothing in the flow caused them and
 *  nothing in the flow mends them, so they are a health signal, not a defect. */
const tone = computed(() =>
  counts.value.node === 0
    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    : 'bg-red-500/15 text-red-600 dark:text-red-400',
)
const label = computed(() => `${props.errors.count} error${props.errors.count === 1 ? '' : 's'}`)
const hint = computed(() => errorSummary(props.errors) + (props.interactive ? ' — click to list them' : ''))
</script>

<template>
  <component
    :is="interactive ? 'button' : 'span'"
    :type="interactive ? 'button' : undefined"
    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
    :class="[tone, interactive ? 'transition-opacity hover:opacity-80' : '']"
    :title="hint"
    @click.stop.prevent="interactive && $emit('toggle')"
  >
    <Icon name="alert" :size="11" class="shrink-0" />
    {{ label }}
    <Icon v-if="interactive" :name="expanded ? 'chevronDown' : 'chevronRight'" :size="11" class="shrink-0 opacity-70" />
  </component>
</template>
