<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { flomorphicUrl, needsId } from '@/lib/flomorphicLinks'
import type { FlomorphicTarget } from '@/lib/flomorphicLinks'
import type { IconName } from '@/lib/icons'

/**
 * "Open this in FloMorphic" — the one way out of Venapce and into the flow
 * itself.
 *
 * Every outcome on these pages was produced by a flow somebody designed over
 * there, and the moment a run comes back with errors the question is always
 * the same: which node, and what did it have in front of it. So wherever
 * Venapce names a flow, a run, a context document or a settings profile, it is
 * this link.
 *
 * It is always a real anchor (middle-click, copy link, the lot): the web app's
 * address has a default — the port the standard FloMorphic compose publishes —
 * so there is never a point at which Venapce has nothing to point at. Settings
 * → FloMorphic web app is where an install whose browser reaches FloMorphic
 * somewhere else corrects it.
 */
const props = withDefaults(
  defineProps<{
    kind: FlomorphicTarget
    /** The flow or context id; ignored for the kinds that address a whole page. */
    id?: string
    label?: string
    /** Hide the label and show the icon alone (for a crowded row). */
    iconOnly?: boolean
    size?: number
  }>(),
  { id: '', label: '', iconOnly: false, size: 12 },
)

const ICON: Record<FlomorphicTarget, IconName> = {
  flow: 'workflow',
  processes: 'play',
  context: 'database',
  'settings-profile': 'sliders',
  settings: 'settings',
  home: 'workflow',
}

const LABEL: Record<FlomorphicTarget, string> = {
  flow: 'Open flow',
  processes: 'Open runs',
  context: 'Open context',
  'settings-profile': 'Profiles',
  settings: 'Open settings',
  home: 'Open FloMorphic',
}

const HINT: Record<FlomorphicTarget, string> = {
  flow: 'Open this flow on the FloMorphic canvas',
  processes: 'Open the run list in FloMorphic',
  context: 'Open the context document this run read and wrote',
  'settings-profile': 'FloMorphic → Node Settings, where a settings profile is created',
  settings: 'Open FloMorphic settings',
  home: 'Open the FloMorphic web app',
}

const text = computed(() => props.label || LABEL[props.kind])
const hint = computed(() => HINT[props.kind])

/** Nothing to point at — no id for the kinds that need one. */
const missing = computed(() => needsId(props.kind) && !props.id)

const href = computed(() => (missing.value ? '' : flomorphicUrl(props.kind, props.id)))

const CLASS =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] text-fg-muted transition-colors hover:border-accent-border hover:text-accent'
</script>

<template>
  <a v-if="href" :href="href" target="_blank" rel="noopener" :class="CLASS" :title="hint" @click.stop>
    <Icon :name="ICON[kind]" :size="size" class="shrink-0" />
    <span v-if="!iconOnly">{{ text }}</span>
    <Icon name="external" :size="size - 1" class="shrink-0 opacity-60" />
  </a>
</template>
