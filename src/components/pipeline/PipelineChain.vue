<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { hasLink, rowRoute } from '@/lib/pipeline'

// The row's place in the (optional) stage → finding → issue chain. Each level
// is a link when the row is linked to one, the current level is highlighted,
// and an unlinked level renders as a dashed placeholder — so a row that was
// written straight to issues visibly skipped the earlier levels.
const props = defineProps<{
  current: 'stage' | 'finding' | 'issue'
  stageId?: number | string | null
  findingId?: number | string | null
  issueId?: number | string | null
}>()

const levels = computed(() => [
  { kind: 'stage' as const, label: 'Stage', id: props.stageId, icon: 'inbox' },
  { kind: 'finding' as const, label: 'Finding', id: props.findingId, icon: 'target' },
  { kind: 'issue' as const, label: 'Issue', id: props.issueId, icon: 'flag' },
])
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5 text-xs">
    <template v-for="(l, i) in levels" :key="l.kind">
      <Icon v-if="i > 0" name="arrowRight" :size="14" class="text-fg-subtle" />
      <span
        v-if="l.kind === current"
        class="inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent-soft px-2 py-1 font-medium text-accent"
      >
        <Icon :name="l.icon" :size="13" />
        {{ l.label }} <span class="font-mono">#{{ l.id }}</span>
      </span>
      <RouterLink
        v-else-if="hasLink(l.id)"
        :to="rowRoute(l.kind, l.id!)"
        class="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 font-medium text-fg-muted hover:border-accent-border hover:text-accent"
      >
        <Icon :name="l.icon" :size="13" />
        {{ l.label }} <span class="font-mono">#{{ l.id }}</span>
      </RouterLink>
      <span
        v-else
        class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2 py-1 text-fg-subtle"
        :title="`No ${l.label.toLowerCase()} linked — this level was skipped or not reached.`"
      >
        <Icon :name="l.icon" :size="13" />
        {{ l.label }}
      </span>
    </template>
  </div>
</template>
