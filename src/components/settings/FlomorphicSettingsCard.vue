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

// Where FloMorphic is (API base + shared secret + infra host). The backend seeds
// these from its environment, but an install that skipped FloMorphic — or one whose
// FloMorphic later moved — must be fixable from here: editing .env means recreating
// the container, and a plain `docker compose restart` keeps the old environment.
// Saving stores an override that applies immediately and outlives a recreate.
const editingApi = ref(false)
const apiSaving = ref(false)
const apiTesting = ref(false)
const apiError = ref('')
const form = ref({ url: '', jwtSecret: '', infraHost: '' })

// The infra host is only ever a hostname — a URL pasted here would be built into an
// unusable nats:// address, so catch it before the round-trip.
const infraHostError = computed(() =>
  /:\/\//.test(form.value.infraHost.trim())
    ? 'Enter a hostname only (no scheme or port) — venapce adds :4222 and :8022 itself.'
    : '',
)

function editApi() {
  form.value = { url: flo.apiUrl, jwtSecret: '', infraHost: flo.infraHost }
  apiError.value = ''
  editingApi.value = true
}

async function saveApi() {
  if (infraHostError.value) return
  apiSaving.value = true
  apiError.value = ''
  notice.value = ''
  try {
    const res = await flo.saveAccess({
      url: form.value.url.trim(),
      jwtSecret: form.value.jwtSecret,
      infraHost: form.value.infraHost.trim(),
    })
    if (res.reachable) {
      editingApi.value = false
      notice.value = 'FloMorphic answered — connect below to register the plugin.'
    } else {
      apiError.value = `Saved, but FloMorphic did not answer: ${res.reachError ?? 'unreachable'}`
    }
  } catch (e) {
    apiError.value = apiErr(e)
  } finally {
    apiSaving.value = false
  }
}

async function testApi() {
  apiTesting.value = true
  apiError.value = ''
  try {
    const res = await flo.testAccess(
      editingApi.value ? { url: form.value.url.trim(), jwtSecret: form.value.jwtSecret } : {},
    )
    if (!res.reachable) apiError.value = `Not reachable: ${res.reachError ?? 'unknown error'}`
  } catch (e) {
    apiError.value = apiErr(e)
  } finally {
    apiTesting.value = false
  }
}

async function resetApi() {
  apiSaving.value = true
  apiError.value = ''
  try {
    await flo.resetAccess()
    editingApi.value = false
  } catch (e) {
    apiError.value = apiErr(e)
  } finally {
    apiSaving.value = false
  }
}

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
      <!-- Where FloMorphic is: env defaults, overridable here -->
      <div class="rounded-lg border border-line bg-surface-2/40 p-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-fg-muted">FloMorphic API</h3>
          <div class="flex items-center gap-2">
            <span
              v-if="flo.reachable !== null"
              class="rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="flo.reachable ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'"
            >
              {{ flo.reachable ? 'Reachable' : 'Unreachable' }}
            </span>
            <span
              class="rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="flo.apiConfigured ? 'bg-success-soft text-success' : 'bg-surface-2 text-fg-muted'"
            >
              {{ flo.apiConfigured ? 'Configured' : 'Not configured' }}
            </span>
          </div>
        </div>

        <!-- Read view -->
        <template v-if="!editingApi">
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
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-fg-muted">Infra host</dt>
              <dd class="min-w-0 truncate font-mono text-xs text-fg" :class="{ 'text-fg-subtle italic': !flo.infraHost }">
                {{ flo.infraHost || 'Not set' }}
              </dd>
            </div>
          </dl>

          <p class="mt-3 text-xs text-fg-subtle">
            <template v-if="flo.apiFromEnv">
              From the backend environment (<span class="font-mono">FLOMORPHIC_URL</span>,
              <span class="font-mono">FLOMORPHIC_JWT_SECRET</span>,
              <span class="font-mono">INFRA_HOST</span>). Set them here instead to change them without
              recreating the container.
            </template>
            <template v-else>
              Set here, overriding the backend environment. Takes effect immediately and survives a
              container restart.
            </template>
          </p>

          <p v-if="apiError" class="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ apiError }}</p>
          <p v-else-if="flo.reachable === false && flo.reachError" class="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {{ flo.reachError }}
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn-outline" @click="editApi">
              {{ flo.apiConfigured ? 'Edit' : 'Set FloMorphic address' }}
            </button>
            <button
              type="button"
              class="btn-outline"
              :disabled="apiTesting || !flo.apiConfigured"
              @click="testApi"
            >
              {{ apiTesting ? 'Testing…' : 'Test' }}
            </button>
            <button
              v-if="!flo.apiFromEnv"
              type="button"
              class="btn-outline"
              :disabled="apiSaving"
              @click="resetApi"
            >
              Reset to environment
            </button>
          </div>
        </template>

        <!-- Edit view -->
        <form v-else class="mt-3 space-y-3" @submit.prevent="saveApi">
          <div>
            <label class="label">FloMorphic API URL</label>
            <input v-model="form.url" class="field" placeholder="http://flomorphic:8025" autocomplete="off" />
            <p class="mt-1 text-xs text-fg-subtle">
              As reached from inside this container — a FloMorphic on the same Docker network is its
              container name; one on the host is the Docker gateway, not
              <span class="font-mono">localhost</span>.
            </p>
          </div>
          <div>
            <label class="label">Shared JWT secret</label>
            <input
              v-model="form.jwtSecret"
              type="password"
              class="field"
              :placeholder="flo.jwtSecretSet ? 'unchanged — leave blank to keep' : ''"
              autocomplete="off"
            />
            <p class="mt-1 text-xs text-fg-subtle">
              FloMorphic's <span class="font-mono">API_JWT_SECRET</span> /
              <span class="font-mono">INFLOW_INFRA_JWT_SECRET</span> — it must match exactly.
            </p>
          </div>
          <div>
            <label class="label">Infra host</label>
            <input v-model="form.infraHost" class="field" placeholder="inflow-infra" autocomplete="off" />
            <p class="mt-1 text-xs" :class="infraHostError ? 'text-danger' : 'text-fg-subtle'">
              <template v-if="infraHostError">{{ infraHostError }}</template>
              <template v-else>
                Hostname only. Venapce reaches NATS on <span class="font-mono">:4222</span> and osspace on
                <span class="font-mono">:8022</span> there.
              </template>
            </p>
          </div>

          <p v-if="apiError" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ apiError }}</p>

          <div class="flex flex-wrap gap-2">
            <button type="submit" class="btn-primary" :disabled="apiSaving || !form.url.trim() || !!infraHostError">
              {{ apiSaving ? 'Saving…' : 'Save' }}
            </button>
            <button type="button" class="btn-outline" :disabled="apiTesting || !form.url.trim()" @click="testApi">
              {{ apiTesting ? 'Testing…' : 'Test' }}
            </button>
            <button type="button" class="btn-outline" :disabled="apiSaving" @click="editingApi = false">
              Cancel
            </button>
          </div>
        </form>
      </div>

      <!-- Register + live status -->
      <div class="mt-4 space-y-3">
        <p v-if="!flo.apiConfigured" class="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          Venapce does not know where FloMorphic is yet. Set its URL and shared secret above, then connect.
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
