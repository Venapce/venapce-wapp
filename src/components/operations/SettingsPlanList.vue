<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { flowUrl, settingsProfileUrl } from '@/lib/flomorphicLinks'
import type { OperationSettingsNeed, OperationSettingsPlan, SettingsNeedStatus } from '@/api/types'

// The part of an operation that travels in no package: the plugins its flows
// call, and the FloMorphic settings profile each provider node has to be bound
// to.
//
// A flow file names the plugin *action* a node calls — portable — but can
// carry neither a profile id nor a plugin id, since both are addresses on one
// FloMorphic. Installing a flow writes the whole document, so every install
// (and every re-install after an upgrade) leaves those nodes unbound on the
// canvas. Nothing here can bind them for the operator; what it can do is say
// exactly which nodes, on which flow, with which profiles to choose from — and
// take them there.
//
// Shown twice: in the import wizard, before anything is installed (`live`
// false — the verdicts are about this estate, not about bindings that do not
// exist yet), and on the operation page afterwards, where the bound flows have
// been read back and the list is the work still outstanding.
const props = defineProps<{ plan: OperationSettingsPlan; busy?: boolean }>()

const GLYPH: Record<SettingsNeedStatus, { icon: string; cls: string }> = {
  ok: { icon: 'checkCircle', cls: 'text-success' },
  unbound: { icon: 'alertCircle', cls: 'text-warning' },
  noProfile: { icon: 'alertCircle', cls: 'text-warning' },
  notInstalled: { icon: 'xCircle', cls: 'text-danger' },
  unknown: { icon: 'info', cls: 'text-fg-subtle' },
}

// Worst first: a plugin that is not here blocks the node entirely, then what
// has nothing to bind, then what is only unbound. Settled and optional rows
// sink to the bottom but stay visible — an operator comparing the canvas to
// this list needs every node in it.
const RANK: Record<SettingsNeedStatus, number> = { notInstalled: 0, noProfile: 1, unbound: 2, unknown: 3, ok: 4 }
const needs = computed(() =>
  [...(props.plan.needs ?? [])].sort((a, b) => {
    const ra = RANK[a.status] + (a.required ? 0 : 5)
    const rb = RANK[b.status] + (b.required ? 0 : 5)
    return ra - rb
  }),
)
const pendingPlugins = computed(() => (props.plan.plugins ?? []).filter((p) => p.status === 'notInstalled'))

/** The flow to open for a need: the backend's link, or one built here from the
 *  configured web app address. */
function flowHref(n: OperationSettingsNeed): string {
  return n.href || (n.flowId ? flowUrl(n.flowId) : '')
}
function settingsHref(n: { settingsHref?: string }): string {
  return n.settingsHref || settingsProfileUrl()
}
</script>

<template>
  <div>
    <p v-if="!plan.known" class="mb-2 rounded-md bg-warning-soft px-3 py-2 text-[11px] text-warning">
      FloMorphic could not be asked which plugins and profiles it has, so nothing below is verified — check Settings → FloMorphic.
    </p>

    <!-- what the flows need, as this FloMorphic has it -->
    <template v-if="plan.plugins?.length">
      <p class="label">Plugins the flows call</p>
      <ul class="divide-y divide-line rounded-md border border-line">
        <li v-for="p in plan.plugins ?? []" :key="p.name" class="flex items-start gap-2.5 px-3 py-2">
          <Icon :name="GLYPH[p.status].icon" :size="15" :class="[GLYPH[p.status].cls, 'mt-0.5 shrink-0']" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5 text-sm text-fg">
              <Icon name="layers" :size="12" class="text-fg-subtle" />
              <span class="font-medium">{{ p.name }}</span>
              <span v-if="p.venapce" class="chip-muted">this panel's plugin</span>
              <span v-else-if="p.builtin" class="chip-muted">FloMorphic builtin</span>
              <span v-if="p.nodes" class="chip-muted">{{ p.nodes }} node{{ p.nodes === 1 ? '' : 's' }}</span>
              <span v-if="!p.venapce && p.status !== 'notInstalled'" class="chip-muted">
                {{ p.profiles }} profile{{ p.profiles === 1 ? '' : 's' }} here
              </span>
            </div>
            <p class="mt-0.5 break-words text-xs text-fg-muted">{{ p.detail }}</p>
            <p v-if="p.actions?.length" class="mt-0.5 flex flex-wrap gap-1">
              <code v-for="a in p.actions" :key="a" class="rounded bg-surface-2 px-1 font-mono text-[10px]" :class="p.missing?.includes(a) ? 'text-danger' : 'text-fg-subtle'">{{ a }}</code>
            </p>
          </div>
          <a v-if="p.href" :href="p.href" target="_blank" rel="noopener" class="btn-outline btn-sm shrink-0">
            <Icon name="external" :size="12" /> Get
          </a>
        </li>
      </ul>
    </template>

    <!-- the profiles the operator has to pick, node by node -->
    <template v-if="needs.length">
      <div class="mb-1 mt-4 flex flex-wrap items-center gap-2">
        <p class="label !mb-0">Node settings to configure</p>
        <span v-if="plan.pending" class="chip bg-warning-soft text-warning">{{ plan.pending }} to bind</span>
        <span v-else class="chip bg-success-soft text-success">all bound</span>
      </div>
      <p class="mb-2 text-[11px] text-fg-subtle">
        These nodes reach a provider and take its credentials from a FloMorphic <em>node settings profile</em>, bound on the node itself.
        A package cannot carry those bindings — the profile id belongs to the install that made it — and installing a flow replaces the
        whole document, so they have to be picked here after
        <template v-if="plan.live">each install and re-install</template><template v-else>the install</template>.
      </p>
      <ul class="divide-y divide-line rounded-md border border-line">
        <li v-for="(n, i) in needs" :key="`${n.flowKey}:${n.ref}:${i}`" class="flex items-start gap-2.5 px-3 py-2">
          <Icon :name="GLYPH[n.status].icon" :size="15" :class="[GLYPH[n.status].cls, 'mt-0.5 shrink-0']" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5 text-sm text-fg">
              <Icon name="sliders" :size="12" class="text-fg-subtle" />
              <span class="font-medium">{{ n.node }}</span>
              <span v-if="n.plugin" class="chip-muted">{{ n.plugin }}</span>
              <span v-if="!n.required" class="chip-muted">optional</span>
              <span v-if="n.boundTo" class="chip-muted text-success">{{ n.boundTo }}</span>
            </div>
            <p class="mt-0.5 break-words text-xs text-fg-muted">{{ n.detail }}</p>
            <p v-if="n.note" class="mt-0.5 break-words text-[11px] italic text-fg-subtle">{{ n.note }}</p>
            <p class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg-subtle">
              <span v-if="n.flowTitle"><Icon name="workflow" :size="10" /> {{ n.flowTitle }}</span>
              <code v-if="n.action" class="font-mono">{{ n.action }}</code>
              <span v-if="n.profiles?.length">profiles here: {{ n.profiles.join(', ') }}</span>
            </p>
          </div>
          <div class="flex shrink-0 flex-col items-stretch gap-1">
            <a v-if="flowHref(n)" :href="flowHref(n)" target="_blank" rel="noopener" class="btn-outline btn-sm" title="Open the flow on the FloMorphic canvas and pick this node's profile">
              <Icon name="external" :size="12" /> Open flow
            </a>
            <a
              v-if="settingsHref(n) && n.status !== 'ok'"
              :href="settingsHref(n)"
              target="_blank"
              rel="noopener"
              class="btn-ghost btn-sm"
              title="FloMorphic → Node Settings, where a profile is created"
            >
              <Icon name="sliders" :size="12" /> Profiles
            </a>
          </div>
        </li>
      </ul>
      <p v-if="pendingPlugins.length" class="mt-1.5 text-[11px] text-danger">
        Install {{ pendingPlugins.map((p) => p.name).join(', ') }} in FloMorphic first — a node whose plugin is not here has no profile to
        bind to.
      </p>
    </template>

    <p v-else-if="!plan.plugins?.length" class="text-xs text-fg-subtle">
      Nothing to configure: no node of this package reaches a provider that needs its own credentials.
    </p>
  </div>
</template>
