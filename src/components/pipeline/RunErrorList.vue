<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import FlomorphicLink from '@/components/FlomorphicLink.vue'
import { errorKind, errorKindClass, formatErrorTime } from '@/lib/runErrors'
import type { RunErrorKind, RunErrors } from '@/api/types'

/**
 * One run's error ledger, as a list: what went wrong, at which node, whose
 * fault it was and when.
 *
 * The engine names nodes by id — titles live on the FloMorphic canvas, not on
 * the wire — so each entry links to the flow it was raised in, which is where
 * the id can actually be placed. A run that went through a GoTo has entries
 * from more than one flow, hence the link per entry rather than one at the top.
 *
 * Shared by every place a run's errors are read: expanded on the timeline, on
 * the activity page, under a row in the activities table.
 */
const props = defineProps<{ errors: RunErrors }>()

/** What a kind badge means, spelled out — the distinction is the point of the
 *  badge and is not obvious from one word. */
function kindHint(kind: RunErrorKind): string {
  return kind === 'system'
    ? 'A platform error: nothing in the flow caused it and nothing in the flow mends it'
    : 'The flow’s own error: its node data, its js or rego, or something its node called that did not deliver'
}

const rows = computed(() =>
  props.errors.items.map((item, i) => ({
    ...item,
    kind: errorKind(item),
    // ts alone does not separate two errors raised in the same millisecond on
    // a fan-out, so the index goes in the key.
    key: `${item.ts}-${item.node}-${i}`,
  })),
)

/**
 * How many entries the engine counted but did not carry. The ledger rides
 * inside the context document, which has a publish limit, so a cascading run's
 * entries are capped at the earliest ones — saying so is what stops the list
 * reading as the whole story.
 */
const dropped = computed(() => Math.max(0, props.errors.count - props.errors.items.length))
</script>

<template>
  <div class="space-y-1.5">
    <ul class="space-y-1.5">
      <li v-for="row in rows" :key="row.key" class="rounded-lg border border-line bg-surface px-3 py-2 text-[12px]">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            :class="errorKindClass(row.kind)"
            :title="kindHint(row.kind)"
          >
            {{ row.kind }}
          </span>
          <span v-if="row.node" class="font-mono text-fg" title="The node the error was raised at">{{ row.node }}</span>
          <span v-if="row.src" class="font-mono text-[11px] text-fg-subtle" title="The actor that raised it">{{ row.src }}</span>
          <span v-if="row.code" class="font-mono text-[11px] text-fg-subtle" title="Engine status code">#{{ row.code }}</span>
          <FlomorphicLink
            v-if="row.flow"
            kind="flow"
            :id="row.flow"
            label="Open the node"
            title="Open this flow on the FloMorphic canvas, where the node id has a name and a place"
          />
          <span v-if="row.ts" class="ml-auto font-mono text-[11px] text-fg-subtle">{{ formatErrorTime(row.ts) }}</span>
        </div>
        <p class="mt-1 break-words text-fg-muted">{{ row.msg || '—' }}</p>
        <!-- Only a node running over a fan-out has one, and then the node id
             alone does not place the failure. -->
        <p v-if="row.loc" class="mt-0.5 font-mono text-[11px] text-fg-subtle" title="Path the failure happened on">at {{ row.loc }}</p>
      </li>
    </ul>

    <p v-if="dropped" class="flex items-start gap-1.5 text-[11px] text-fg-subtle">
      <Icon name="info" :size="12" class="mt-0.5 shrink-0" />
      <span>
        {{ dropped }} more error{{ dropped === 1 ? '' : 's' }} were recorded but not carried — the ledger keeps the earliest
        {{ props.errors.items.length }}, which is where a cascade starts.
      </span>
    </p>
  </div>
</template>
