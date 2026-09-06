<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useFlomorphicStore } from '@/stores/flomorphic'
import { apiErr } from '@/api/venapce'

// One Settings card: connect Venapce to FloMorphic. Venapce runs as a FloMorphic
// plugin — the backend registers it as an extension (create row + mint credential
// + connect the in-process plugin + sync its actions into palette nodes), all via
// the FloMorphic API (FLOMORPHIC_URL + FLOMORPHIC_JWT_SECRET). Connectivity is
// reported as FloMorphic sees it. Refresh re-registers from scratch (delete + add)
// to pick up a changed action set. Once registered, FloMorphic can broker a
// turnkey osctrl space; that provisioning lives in the osctrl connection card.
const flo = useFlomorphicStore()

const saving = ref(false)
const refreshing = ref(false)
const checking = ref(false)
const error = ref('')
const notice = ref('')

// Closed accordion once the plugin is registered; open it to review or reconnect.
const open = ref(!flo.configured)
let didInit = false
watch(
  () => [flo.loaded, flo.configured] as const,
  ([loaded]) => {
    if (!loaded || didInit) return
    open.value = !flo.configured
    didInit = true
    // Registered already: check how FloMorphic sees the plugin without a click.
    if (flo.configured) void check()
  },
  { immediate: true },
)

const badge = computed(() => {
  if (flo.osctrlManaged) return { text: 'osctrl active', cls: 'bg-success-soft text-success' }
  if (flo.configured) return { text: 'Registered', cls: 'bg-accent-soft text-accent' }
  if (!flo.apiConfigured) return { text: 'API not configured', cls: 'bg-surface-2 text-fg-muted' }
  return { text: 'Not connected', cls: 'bg-surface-2 text-fg-muted' }
})

// Connection status as FloMorphic sees it (the reference), from the probe.
const conn = computed(() => {
  const p = flo.probe
  if (!p) return { text: checking.value ? 'Checking…' : 'Unknown', cls: 'bg-surface-2 text-fg-muted', detail: '' }
  if (p.reachable) {
    const n = p.actions ?? flo.nodes ?? undefined
    return { text: 'Connected', cls: 'bg-success-soft text-success', detail: n != null ? `${n} node${n === 1 ? '' : 's'}` : '' }
  }
  return { text: 'Not reachable', cls: 'bg-danger-soft text-danger', detail: p.error ?? '' }
})

function report(res: { nodes?: number; syncError?: string; pluginError?: string }) {
  error.value = ''
  notice.value = ''
  if (res.pluginError) error.value = `Plugin did not connect: ${res.pluginError}`
  else if (res.syncError) error.value = `Connected, but sync failed: ${res.syncError}`
  else notice.value = `Synced ${res.nodes ?? 0} node${res.nodes === 1 ? '' : 's'} into the FloMorphic palette.`
}

async function connect() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    report(await flo.connect())
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function refresh() {
  refreshing.value = true
  error.value = ''
  notice.value = ''
  try {
    report(await flo.refresh())
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    refreshing.value = false
  }
}

async function check() {
  checking.value = true
  error.value = ''
  try {
    await flo.check()
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    checking.value = false
  }
}

onMounted(() => {
  if (!flo.loaded) flo.loadSettings()
})
</script>

<template>
  <section class="card p-6">
    <button type="button" class="flex w-full items-start gap-3 text-left" @click="open = !open">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">⚡</span>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-fg">Connect FloMorphic</h2>
        <p class="truncate text-xs text-fg-muted">
          <template v-if="flo.configured">Registered as {{ flo.pluginId }}</template>
          <template v-else>Register the venapce plugin so its nodes appear in the FloMorphic palette.</template>
        </p>
      </div>
      <span class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" :class="badge.cls">
        {{ badge.text }}
      </span>
      <span class="ml-1 shrink-0 text-fg-subtle" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
    </button>

    <div v-show="open" class="mt-4">
      <!-- FloMorphic API access (from the backend environment) -->
      <div class="rounded-lg border border-line bg-surface-2/40 p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-fg-muted">FloMorphic API</h3>
          <span
            class="rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="flo.apiConfigured ? 'bg-success-soft text-success' : 'bg-surface-2 text-fg-muted'"
          >
            {{ flo.apiConfigured ? 'Configured' : 'Not configured' }}
          </span>
        </div>

        <dl class="mt-3 space-y-2 text-sm">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-fg-muted">API URL</dt>
            <dd class="min-w-0 truncate font-mono text-xs text-fg" :class="{ 'text-fg-subtle italic': !flo.apiUrl }">
              {{ flo.apiUrl || 'Not set' }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-fg-muted">JWT secret</dt>
            <dd class="font-mono text-xs" :class="flo.jwtSecretSet ? 'text-fg' : 'text-fg-subtle italic'">
              <template v-if="flo.jwtSecretSet">•••••••• configured</template>
              <template v-else>Not set</template>
            </dd>
          </div>
        </dl>

        <p class="mt-3 text-xs text-fg-subtle">
          Set from the backend environment
          (<span class="font-mono">FLOMORPHIC_URL</span> and
          <span class="font-mono">FLOMORPHIC_JWT_SECRET</span>). The secret must match FloMorphic's API JWT
          secret. Restart venapce-api after changing them.
        </p>
      </div>

      <!-- Register + live status -->
      <div class="mt-4 space-y-3">
        <p v-if="!flo.apiConfigured" class="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          Set <span class="font-mono">FLOMORPHIC_URL</span> and
          <span class="font-mono">FLOMORPHIC_JWT_SECRET</span> in the backend environment, then reload to connect.
        </p>

        <!-- Plugin connection, as FloMorphic sees it -->
        <div v-if="flo.configured" class="rounded-lg border border-line bg-surface-2/40 p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-fg-muted">Plugin connection</h3>
              <p class="mt-1 truncate text-xs text-fg-subtle">
                FloMorphic's view<template v-if="conn.detail"> · {{ conn.detail }}</template>
              </p>
            </div>
            <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" :class="conn.cls">
              {{ conn.text }}
            </span>
          </div>
          <p class="mt-2 text-xs text-fg-subtle">
            Checked through FloMorphic (a live <span class="font-mono">@actions</span> round-trip to the plugin) —
            FloMorphic is the reference for whether the plugin is connected and listed.
          </p>
        </div>

        <p v-if="notice" class="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{{ notice }}</p>
        <p v-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-primary"
            :disabled="saving || refreshing || !flo.apiConfigured"
            @click="connect"
          >
            {{ saving ? 'Connecting…' : flo.configured ? 'Reconnect + sync' : 'Connect FloMorphic' }}
          </button>
          <button
            v-if="flo.configured"
            type="button"
            class="btn-outline"
            :disabled="refreshing || saving"
            @click="refresh"
          >
            {{ refreshing ? 'Refreshing…' : 'Refresh (re-add)' }}
          </button>
          <button
            v-if="flo.configured"
            type="button"
            class="btn-outline"
            :disabled="checking"
            @click="check"
          >
            {{ checking ? 'Checking…' : 'Check connection' }}
          </button>
        </div>

        <p v-if="flo.configured" class="text-xs text-fg-subtle">
          <span class="font-medium text-fg-muted">Refresh</span> deletes the extension in FloMorphic and adds it
          again — use it after venapce's node set changes so the palette rebuilds from the current actions.
        </p>
      </div>

      <p v-if="flo.configured" class="mt-5 border-t border-line pt-4 text-xs text-fg-subtle">
        Registered. Provision your turnkey osctrl space from the
        <span class="font-medium text-fg-muted">osctrl connection</span> card below.
      </p>
    </div>
  </section>
</template>
