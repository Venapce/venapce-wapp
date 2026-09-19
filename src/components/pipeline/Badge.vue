<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { BADGE_KINDS, badgeClass, humanize, type BadgeKind } from '@/lib/pipeline'

// A lifecycle pill — severity, finding status, issue status or stage
// disposition — with the value's own glyph and colour. `md` is the detail
// header size; `sm` fits a table cell.
const props = withDefaults(defineProps<{ kind: BadgeKind; value?: string; size?: 'sm' | 'md' }>(), { size: 'sm' })

const def = computed(() => BADGE_KINDS[props.kind])
const value = computed(() => props.value || (props.kind === 'severity' ? 'info' : ''))
const icon = computed(() => def.value.icons[value.value] ?? def.value.fallbackIcon)
const cls = computed(() => badgeClass(def.value.classes, value.value))
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full font-medium capitalize"
    :class="[cls, size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]']"
    :title="`${kind.replace('-', ' ')}: ${humanize(value)}`"
  >
    <Icon :name="icon" :size="size === 'md' ? 14 : 12" :width="2" />
    {{ humanize(value) }}
  </span>
</template>
