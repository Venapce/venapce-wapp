<script setup lang="ts">
import { ref, watch } from 'vue'
import { useOsctrlStore } from '@/stores/osctrl'
import { apiErr } from '@/api/venapce'

// The osctrl connection card. osctrl backs the Nodes area (enrolled systems +
// enroll commands). Two ways in: a managed inflowenger space (provisioned via
// the Connect FloMorphic card above), or — recommended for production — your own
// self-hosted osctrl configured here. The backend stores/encrypts the
// credentials and probes the API login; the JWT never reaches the browser.
const osctrl = useOsctrlStore()

const url = ref(osctrl.url || 'http://localhost:9002')
const username = ref(osctrl.username || 'admin')
const password = ref('')
const environment = ref(osctrl.environment || '')
const saving = ref(false)
const error = ref('')
const result = ref<{ connected?: boolean; connectedAs?: string; connectionError?: string } | null>(null)

// The card is a closed accordion once osctrl is configured — open it to review
// or change the connection. Collapsed default keeps a working Settings tidy.
const open = ref(!osctrl.configured)
let didInit = false

watch(
  () => [osctrl.loaded, osctrl.url, osctrl.username, osctrl.environment, osctrl.managed] as const,
  ([loaded]) => {
    if (!loaded) return
    if (osctrl.url) url.value = osctrl.url
    if (osctrl.username) username.value = osctrl.username
    environment.value = osctrl.environment || environment.value
    // Set the default open state once (don't fight the user afterwards).
    if (!didInit) {
      open.value = !osctrl.configured
      didInit = true
    }
  },
  { immediate: true },
)

async function save() {
  saving.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await osctrl.save(
      url.value.trim(),
      username.value.trim(),
      password.value,
      environment.value.trim(),
    )
    password.value = ''
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function test() {
  saving.value = true
  error.value = ''
  try {
    result.value = await osctrl.test()
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="card p-6">
    <button type="button" class="flex w-full items-start gap-3 text-left" @click="open = !open">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">🖧</span>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-fg">osctrl connection</h2>
        <p class="truncate text-xs text-fg-muted">
          <template v-if="osctrl.configured">
            {{ osctrl.managed ? 'Managed space' : 'Self-hosted' }} · {{ osctrl.url }}
          </template>
          <template v-else>Fleet manager behind the Nodes area — not configured.</template>
        </p>
      </div>
      <span
        class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
        :class="
          !osctrl.configured
            ? 'bg-surface-2 text-fg-muted'
            : osctrl.connected === false
              ? 'bg-danger-soft text-danger'
              : 'bg-success-soft text-success'
        "
      >
        {{ !osctrl.configured ? 'Not configured' : osctrl.connected === false ? 'Login failing' : 'Connected' }}
      </span>
      <span class="ml-1 shrink-0 text-fg-subtle" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
    </button>

    <!-- Always-visible data disclaimer -->
    <p class="mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs leading-relaxed text-fg-muted">
      <span class="font-medium text-fg-muted">inflowenger takes no responsibility for your data.</span>
      This all-in-one osctrl is provided to help you trial and quickly bootstrap Venapce, so you can seamlessly get up
      and running in your own environment.
      <a
        href="https://github.com/Venapce/aio-osctrl"
        target="_blank"
        rel="noopener"
        class="text-accent hover:underline"
      >github.com/Venapce/aio-osctrl ↗</a>
    </p>

    <div v-show="open" class="mt-4">
    <!-- Managed inflowenger space: read-only. -->
    <div v-if="osctrl.managed" class="mb-4 rounded-md border border-line bg-surface-2 p-4">
      <div class="mb-2 flex items-center gap-2">
        <span class="text-sm font-medium text-fg">Managed via your inflowenger space</span>
        <span class="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">Managed</span>
      </div>
      <dl class="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
        <dt class="text-fg-muted">Host</dt>
        <dd class="text-fg break-all">{{ osctrl.url || '—' }}</dd>
        <dt class="text-fg-muted">Environment</dt>
        <dd class="text-fg font-mono">{{ osctrl.environment || '—' }}</dd>
        <dt class="text-fg-muted">Username</dt>
        <dd class="text-fg">{{ osctrl.username || '—' }}</dd>
      </dl>
      <p class="mt-2 text-xs text-fg-subtle">
        Provisioned through FloMorphic. Manage it in the osctrl panel, or connect your own instance below.
      </p>
    </div>

    <!-- Self-hosted (recommended). -->
    <div class="flex items-center gap-2 text-sm font-medium text-fg">
      <span>Run your own osctrl</span>
      <span class="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">Recommended</span>
    </div>

    <form class="mt-4 space-y-4" @submit.prevent="save">
      <p class="rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-muted">
        For production we strongly recommend running your own osctrl server and setting its API credentials here —
        you keep full control of your fleet data. The managed space is a quick way to get started.
      </p>
      <div>
        <label class="label">osctrl API URL</label>
        <input v-model="url" class="field" placeholder="http://localhost:9002" autocomplete="off" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">Username</label>
          <input v-model="username" class="field" autocomplete="username" />
        </div>
        <div>
          <label class="label">Default environment</label>
          <input v-model="environment" class="field" placeholder="e.g. prod-edge" autocomplete="off" />
        </div>
      </div>
      <div>
        <label class="label">Password</label>
        <input
          v-model="password"
          type="password"
          class="field"
          :placeholder="osctrl.configured && !osctrl.managed ? 'unchanged — leave blank to keep' : ''"
          autocomplete="current-password"
        />
      </div>

      <p v-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
      <p v-if="result?.connected" class="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
        Connected{{ result.connectedAs ? ` as ${result.connectedAs}` : '' }}.
      </p>
      <p
        v-else-if="result && result.connected === false"
        class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger"
      >
        Saved, but login failed: {{ result.connectionError }}
      </p>

      <div class="flex gap-2">
        <button type="submit" class="btn-primary flex-1" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save connection' }}
        </button>
        <button type="button" class="btn-outline" :disabled="saving || !osctrl.configured" @click="test">
          Test
        </button>
      </div>
    </form>
    </div>
  </section>
</template>
