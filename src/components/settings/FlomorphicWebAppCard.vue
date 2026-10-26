<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useFlomorphicStore } from '@/stores/flomorphic'
import { apiErr } from '@/api/venapce'
import { DEFAULT_PANEL_URL, flomorphicUrl, panelBase, trimBase } from '@/lib/flomorphicLinks'
import Icon from '@/components/Icon.vue'
import type { IconName } from '@/lib/icons'

// One Settings card: where the FloMorphic web app answers in a browser.
//
// Venapce's pages are full of outcomes produced somewhere else — a flow on
// FloMorphic's canvas, a run in its process list, the context document that run
// read and wrote, the settings profile a provider node has to be bound to. Each
// of those is a link out, and a link needs a *browser-side* address.
//
// That address is not the FloMorphic API URL and cannot be derived from it. Both
// systems run in Docker containers: the backend reaches FloMorphic by its
// container name on the compose network (http://flomorphic:8025), while the
// operator's browser reaches the port the FloMorphic compose publishes on the
// Docker host (http://localhost:8088) — or, past a reverse proxy or on a remote
// install, a host name that exists nowhere in that network. Only the operator
// knows which. Hence its own card, next to the API one rather than inside it.
//
// It is saved in the backend's config, so it holds for everyone who opens
// Venapce and survives a container recreate — unlike .env, which does not take
// effect until the container is recreated.
const flo = useFlomorphicStore()

const editing = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const draft = ref('')

/** What the links actually use right now, default included — so the card shows
 *  the effective address rather than an empty row before anyone has saved. */
const effective = computed(() => (flo.loaded ? panelBase() : trimBase(flo.panelUrl)))
const isDefault = computed(() => flo.panelFromEnv && effective.value === DEFAULT_PANEL_URL)

const badge = computed(() => {
  if (!flo.panelFromEnv) return { text: 'Set here', cls: 'bg-success-soft text-success' }
  if (isDefault.value) return { text: 'Default', cls: 'bg-surface-2 text-fg-muted' }
  return { text: 'From environment', cls: 'bg-surface-2 text-fg-muted' }
})

// An address pasted from a browser's bar, or a container name typed in by
// reflex: both are worth catching before the round-trip, since a wrong value
// here shows up only later, as a link that opens a dead tab.
const draftError = computed(() => {
  const v = draft.value.trim()
  if (!v) return ''
  if (!/^https?:\/\//i.test(v)) return 'Start with http:// or https:// — this is the address your browser opens.'
  try {
    new URL(v)
  } catch {
    return 'That is not a valid URL.'
  }
  return ''
})

/** The pages Venapce links to, so the address can be proved in one click
 *  instead of waiting for the next failed run to find out it is wrong. */
const TARGETS: { kind: 'home' | 'processes' | 'settings-profile' | 'settings'; label: string; icon: IconName }[] = [
  { kind: 'home', label: 'Workflows', icon: 'workflow' },
  { kind: 'processes', label: 'Processes', icon: 'play' },
  { kind: 'settings-profile', label: 'Settings profiles', icon: 'sliders' },
  { kind: 'settings', label: 'Settings', icon: 'settings' },
]
const targets = computed(() =>
  TARGETS.map((t) => ({ ...t, href: flomorphicUrl(t.kind, '', effective.value) })).filter((t) => t.href),
)

function edit() {
  draft.value = effective.value || DEFAULT_PANEL_URL
  error.value = ''
  notice.value = ''
  editing.value = true
}

async function save() {
  if (draftError.value || !draft.value.trim()) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await flo.savePanelUrl(trimBase(draft.value))
    editing.value = false
    notice.value = 'Saved — every "open in FloMorphic" link now points there.'
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function reset() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await flo.resetPanelUrl()
    editing.value = false
    notice.value = "Back to the backend environment's address."
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!flo.loaded) flo.loadSettings()
})
</script>

<template>
  <section class="card p-6">
    <div class="flex items-start gap-3">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
        <Icon name="globe" :size="16" />
      </span>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-fg">FloMorphic web app</h2>
        <p class="truncate text-xs text-fg-muted">
          Where Venapce's "open in FloMorphic" links go — a flow, a run, a context, a settings profile.
        </p>
      </div>
      <span class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" :class="badge.cls">
        {{ badge.text }}
      </span>
    </div>

    <div class="mt-4 rounded-lg border border-line bg-surface-2/40 p-4">
      <!-- Read view -->
      <template v-if="!editing">
        <div class="flex items-baseline justify-between gap-3">
          <dt class="text-sm text-fg-muted">Address</dt>
          <dd class="min-w-0 truncate font-mono text-xs text-fg">
            <a
              v-if="effective"
              :href="effective"
              target="_blank"
              rel="noopener"
              class="hover:text-accent"
              title="Open the FloMorphic web app in a new tab"
            >
              {{ effective }}
            </a>
            <span v-else class="italic text-fg-subtle">Not set</span>
          </dd>
        </div>

        <p class="mt-3 text-xs text-fg-subtle">
          <template v-if="!flo.panelFromEnv">
            Set here, overriding the backend environment. It applies immediately and survives a
            container recreate.
          </template>
          <template v-else-if="isDefault">
            The default, which is the port the standard FloMorphic compose publishes on the Docker
            host. Right for a local install on this machine — change it if your browser reaches
            FloMorphic anywhere else.
          </template>
          <template v-else>
            From the backend environment (<span class="font-mono">FLOMORPHIC_PANEL_URL</span>). Set it
            here instead to change it without recreating the container.
          </template>
        </p>

        <p class="mt-2 text-xs text-fg-subtle">
          This is the address <em>your browser</em> opens, not the one the backend calls: both systems
          run in containers, so Venapce reaches the FloMorphic API by its container name while you
          reach its web app on a published port. Neither follows from the other — see
          <span class="font-medium text-fg-muted">Connect FloMorphic</span> above for the API side.
        </p>

        <!-- Prove it resolves, rather than finding out from a dead link later. -->
        <div v-if="targets.length" class="mt-3 flex flex-wrap items-center gap-1.5">
          <span class="me-1 text-[11px] uppercase tracking-wide text-fg-subtle">Open</span>
          <a
            v-for="t in targets"
            :key="t.kind"
            :href="t.href"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] text-fg-muted transition-colors hover:border-accent-border hover:text-accent"
          >
            <Icon :name="t.icon" :size="12" class="shrink-0" />
            {{ t.label }}
            <Icon name="external" :size="11" class="shrink-0 opacity-60" />
          </a>
        </div>

        <p v-if="notice" class="mt-3 rounded-md bg-success-soft px-3 py-2 text-sm text-success">{{ notice }}</p>
        <p v-if="error" class="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="btn-outline" @click="edit">Edit address</button>
          <button v-if="!flo.panelFromEnv" type="button" class="btn-outline" :disabled="saving" @click="reset">
            Reset to environment
          </button>
        </div>
      </template>

      <!-- Edit view -->
      <form v-else class="space-y-3" @submit.prevent="save">
        <div>
          <label class="label">Web app address</label>
          <input
            v-model="draft"
            class="field"
            :placeholder="DEFAULT_PANEL_URL"
            autocomplete="off"
            spellcheck="false"
          />
          <p class="mt-1 text-xs" :class="draftError ? 'text-danger' : 'text-fg-subtle'">
            <template v-if="draftError">{{ draftError }}</template>
            <template v-else>
              Scheme, host and port, no path — Venapce appends the route itself. Paste what is in
              your browser's address bar when you have FloMorphic open.
            </template>
          </p>
        </div>

        <ul class="space-y-1 text-xs text-fg-subtle">
          <li>
            <span class="font-medium text-fg-muted">FloMorphic on this machine:</span>
            <span class="font-mono">{{ DEFAULT_PANEL_URL }}</span> — the port its compose publishes.
          </li>
          <li>
            <span class="font-medium text-fg-muted">On another host:</span> that host's name or IP with
            the same published port, e.g. <span class="font-mono">http://10.0.0.12:8088</span>.
          </li>
          <li>
            <span class="font-medium text-fg-muted">Behind a reverse proxy:</span> the public address,
            e.g. <span class="font-mono">https://flomorphic.example.com</span>.
          </li>
          <li>
            Never a container name such as <span class="font-mono">http://flomorphic</span> — your
            browser is outside the compose network and cannot resolve it.
          </li>
        </ul>

        <p v-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

        <div class="flex flex-wrap gap-2">
          <button type="submit" class="btn-primary" :disabled="saving || !draft.trim() || !!draftError">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
          <a
            v-if="draft.trim() && !draftError"
            :href="trimBase(draft)"
            target="_blank"
            rel="noopener"
            class="btn-outline"
            title="Open this address in a new tab to check it before saving"
          >
            Try it ↗
          </a>
          <button
            v-if="trimBase(draft) !== DEFAULT_PANEL_URL"
            type="button"
            class="btn-outline"
            :disabled="saving"
            @click="draft = DEFAULT_PANEL_URL"
          >
            Use default
          </button>
          <button type="button" class="btn-outline" :disabled="saving" @click="editing = false">Cancel</button>
        </div>
      </form>
    </div>
  </section>
</template>
