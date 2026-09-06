<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useOsctrlStore } from '@/stores/osctrl'
import { useFlomorphicStore } from '@/stores/flomorphic'
import { apiErr } from '@/api/venapce'

// The osctrl connection card. osctrl backs the Nodes area (enrolled systems +
// enroll commands). Two ways in: a managed inflowenger space (provisioned here
// through FloMorphic), or — recommended for production — your own self-hosted
// osctrl configured below. The backend stores/encrypts the credentials and
// probes the API login; the JWT never reaches the browser.
const osctrl = useOsctrlStore()
const flo = useFlomorphicStore()

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

// ---- Managed space provisioning (brokered through FloMorphic's osspace flow) ----
// A managed osctrl space is provisioned once per inflowenger license; it depends
// on the FloMorphic plugin being registered, so this section is disabled until
// FloMorphic is connected.
const connecting = ref(false)
const pendingUrl = ref('')
const provisioned = ref(false)
let poll: ReturnType<typeof setInterval> | null = null

function stopPoll() {
  if (poll) {
    clearInterval(poll)
    poll = null
  }
}

async function connect() {
  connecting.value = true
  error.value = ''
  provisioned.value = false
  pendingUrl.value = ''
  try {
    const res = await flo.connectOsspace()
    if (res.status === 'connected') {
      provisioned.value = true
      connecting.value = false
      return
    }
    // Pending: the user must authenticate with Google to provision the space.
    if (res.redirect) {
      pendingUrl.value = res.redirect
      window.open(res.redirect, '_blank', 'noopener')
      startPoll()
    }
  } catch (e) {
    error.value = apiErr(e)
    connecting.value = false
  }
}

function startPoll() {
  stopPoll()
  poll = setInterval(async () => {
    try {
      const res = await flo.connectOsspace()
      if (res.status === 'connected') {
        stopPoll()
        connecting.value = false
        pendingUrl.value = ''
        provisioned.value = true
      }
    } catch {
      // Stay quiet during the poll; the user may still be authenticating.
    }
  }, 4000)
}

onMounted(() => {
  if (!flo.loaded) flo.loadSettings()
})
onUnmounted(stopPoll)
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
    <!-- Managed inflowenger space, provisioned through FloMorphic. -->
    <div
      class="mb-4 rounded-md border border-line bg-surface-2 p-4"
      :class="{ 'opacity-60': !flo.configured && !osctrl.managed }"
    >
      <div class="mb-2 flex items-center gap-2">
        <span class="text-sm font-medium text-fg">Managed osctrl space</span>
        <span class="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">via FloMorphic</span>
      </div>

      <!-- Already provisioned: read-only details. -->
      <template v-if="osctrl.managed">
        <dl class="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
          <dt class="text-fg-muted">Host</dt>
          <dd class="text-fg break-all">{{ osctrl.url || '—' }}</dd>
          <dt class="text-fg-muted">Environment</dt>
          <dd class="text-fg font-mono">{{ osctrl.environment || '—' }}</dd>
          <dt class="text-fg-muted">Username</dt>
          <dd class="text-fg">{{ osctrl.username || '—' }}</dd>
        </dl>
        <p class="mt-2 text-xs text-fg-subtle">
          Provisioned once through FloMorphic. Clicking connect again just returns this same space — you can't
          provision a second one. Manage it in the osctrl panel, or connect your own instance below.
        </p>
      </template>

      <!-- Not yet provisioned: offer to create/connect the space. -->
      <template v-else>
        <p class="mb-3 text-xs text-fg-muted">
          Provision a turnkey osctrl space for this install. You'll sign in with Google once; afterwards Nodes and
          Enroll work directly against <span class="font-mono">osctrl.inflowenger.com</span>.
        </p>

        <p v-if="provisioned" class="mb-3 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          osctrl space active — Nodes and Enroll are live. Environment
          <span class="font-mono">{{ osctrl.environment || '—' }}</span>.
        </p>
        <p v-else-if="connecting" class="mb-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          Waiting for Google sign-in in the new tab… this page will update automatically once your space is ready.
          <a v-if="pendingUrl" :href="pendingUrl" target="_blank" rel="noopener" class="text-accent hover:underline">
            Reopen sign-in ↗
          </a>
        </p>

        <button
          v-if="!provisioned"
          type="button"
          class="btn-primary"
          :disabled="!flo.configured || connecting"
          @click="connect"
        >
          {{ connecting ? 'Waiting…' : 'Create / connect osctrl space' }}
        </button>

        <p class="mt-2 text-xs text-fg-subtle">
          <template v-if="flo.configured">Works through FloMorphic — provisioning is brokered by the venapce plugin.</template>
          <template v-else>Works with FloMorphic — connect the FloMorphic plugin above to enable this.</template>
        </p>
      </template>
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
