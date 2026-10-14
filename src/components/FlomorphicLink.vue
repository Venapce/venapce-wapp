<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { contextUrl, flowUrl, openInFlomorphic, panelBase, processesUrl } from '@/lib/flomorphicLinks'
import type { IconName } from '@/lib/icons'

/**
 * "Open this in FloMorphic" — the one way out of Venapce and into the flow
 * itself.
 *
 * Every outcome on these pages was produced by a flow somebody designed over
 * there, and the moment a run comes back with errors the question is always
 * the same: which node, and what did it have in front of it. So wherever
 * Venapce names a flow, a run or a context document, it is this link.
 *
 * It renders as a real anchor once the panel address is known (middle-click,
 * copy link, the lot). Until then it is a button that asks for the address
 * once — never a guessed URL opened in a new tab.
 */
const props = withDefaults(
  defineProps<{
    kind: 'flow' | 'processes' | 'context'
    /** The flow or context id; ignored for `processes`. */
    id?: string
    label?: string
    /** Hide the label and show the icon alone (for a crowded row). */
    iconOnly?: boolean
    size?: number
  }>(),
  { id: '', label: '', iconOnly: false, size: 12 },
)

const ICON: Record<string, IconName> = { flow: 'workflow', processes: 'play', context: 'database' }

const text = computed(() => props.label || { flow: 'Open flow', processes: 'Open runs', context: 'Open context' }[props.kind])

const href = computed(() => {
  const base = panelBase()
  if (!base) return ''
  if (props.kind === 'flow') return flowUrl(props.id, base)
  if (props.kind === 'context') return contextUrl(props.id, base)
  return processesUrl(base)
})

/** Nothing to point at — no id for the kinds that need one. */
const missing = computed(() => props.kind !== 'processes' && !props.id)

const hint = computed(
  () =>
    ({
      flow: 'Open this flow on the FloMorphic canvas',
      processes: 'Open the run list in FloMorphic',
      context: 'Open the context document this run read and wrote',
    })[props.kind],
)

const CLASS =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] text-fg-muted transition-colors hover:border-accent-border hover:text-accent'
</script>

<template>
  <a
    v-if="!missing && href"
    :href="href"
    target="_blank"
    rel="noopener"
    :class="CLASS"
    :title="hint"
    @click.stop
  >
    <Icon :name="ICON[kind]" :size="size" class="shrink-0" />
    <span v-if="!iconOnly">{{ text }}</span>
    <Icon name="external" :size="size - 1" class="shrink-0 opacity-60" />
  </a>
  <button
    v-else-if="!missing"
    type="button"
    :class="CLASS"
    :title="`${hint} — Venapce does not know the panel's address yet and will ask once`"
    @click.stop="openInFlomorphic(kind, id)"
  >
    <Icon :name="ICON[kind]" :size="size" class="shrink-0" />
    <span v-if="!iconOnly">{{ text }}</span>
    <Icon name="external" :size="size - 1" class="shrink-0 opacity-60" />
  </button>
</template>
