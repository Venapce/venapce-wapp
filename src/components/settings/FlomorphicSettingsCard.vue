<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useFlomorphicStore } from '@/stores/flomorphic'
import { useOsctrlStore } from '@/stores/osctrl'
import { apiErr } from '@/api/venapce'

// One Settings card: connect Venapce to FloMorphic and, through it, provision a
// turnkey osctrl space. Venapce runs as a FloMorphic plugin — the operator
// defines a "venapce" plugin in the FloMorphic panel, pastes its env here, and
// the backend brokers an osctrl space via infra's osspace flow (Google OAuth).
const flo = useFlomorphicStore()
const osctrl = useOsctrlStore()

const env = ref('')
const saving = ref(false)
const error = ref('')

const connecting = ref(false)
const pendingUrl = ref('')
const success = ref(false)
let poll: ReturnType<typeof setInterval> | null = null

// Closed accordion once the plugin is registered; open it to review or reconnect.
const open = ref(!flo.configured)
let didInit = false
watch(
  () => [flo.loaded, flo.configured] as const,
  ([loaded]) => {
    if (!loaded || didInit) return
    open.value = !flo.configured
    didInit = true
  },
  { immediate: true },
)

const osctrlActive = computed(() => osctrl.managed && osctrl.connected !== false && osctrl.configured)

const badge = computed(() => {
  if (osctrlActive.value) return { text: 'osctrl active', cls: 'bg-success-soft text-success' }
  if (flo.configured) return { text: 'Plugin registered', cls: 'bg-accent-soft text-accent' }
  return { text: 'Not connected', cls: 'bg-surface-2 text-fg-muted' }
})

function stopPoll() {
  if (poll) {
    clearInterval(poll)
    poll = null
  }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await flo.save(env.value)
    env.value = ''
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function connect() {
  connecting.value = true
  error.value = ''
  success.value = false
  pendingUrl.value = ''
  try {
    const res = await flo.connectOsspace()
    if (res.status === 'connected') {
      success.value = true
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
        success.value = true
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
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">⚡</span>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-fg">Connect FloMorphic</h2>
        <p class="truncate text-xs text-fg-muted">
          <template v-if="flo.configured">Plugin registered · {{ flo.infraBase }}</template>
          <template v-else>Register the venapce plugin to get a turnkey osctrl space.</template>
        </p>
      </div>
      <span class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" :class="badge.cls">
        {{ badge.text }}
      </span>
      <span class="ml-1 shrink-0 text-fg-subtle" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
    </button>

    <div v-show="open" class="mt-4">
    <!-- Tutorial -->
    <ol class="mb-4 space-y-3 text-sm text-fg">
      <li class="flex gap-3">
        <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg-muted">1</span>
        <span>
          Install <span class="font-medium">FloMorphic</span> (it ships with Venapce). All operations and logic are
          defined in FloMorphic — without it you can't define rules or logic on your data, and Node data won't flow
          into Venapce's databases and tables.
        </span>
      </li>
      <li class="flex gap-3">
        <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg-muted">2</span>
        <span>
          In the FloMorphic panel, open the <span class="font-medium">extension / plugin</span> menu and define a
          new <span class="font-medium">venapce</span> plugin.
        </span>
      </li>
      <li class="flex gap-3">
        <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg-muted">3</span>
        <span>Copy the plugin's <span class="font-medium">env values</span> and paste them below, then Save.</span>
      </li>
    </ol>

    <div class="space-y-3">
      <div>
        <label class="label">Plugin env</label>
        <textarea
          v-model="env"
          rows="5"
          class="field font-mono text-xs"
          :placeholder="flo.configured ? 'Registered — paste again to update' : 'PLUGIN_ID=…\nINFRA_CRED=…\nINFRA_URL=nats://infra:4222'"
          autocomplete="off"
          spellcheck="false"
        ></textarea>
        <p v-if="flo.configured" class="mt-1 text-xs text-fg-subtle">
          Connected to infra at <span class="font-mono">{{ flo.infraBase }}</span>.
        </p>
      </div>

      <p v-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

      <div class="flex gap-2">
        <button type="button" class="btn-primary" :disabled="saving || !env.trim()" @click="save">
          {{ saving ? 'Saving…' : flo.configured ? 'Update plugin' : 'Save plugin' }}
        </button>
      </div>
    </div>

    <!-- osctrl space provisioning -->
    <div v-if="flo.configured" class="mt-5 border-t border-line pt-5">
      <h3 class="mb-1 text-sm font-semibold text-fg">Your osctrl space</h3>
      <p class="mb-3 text-xs text-fg-muted">
        Provision an osctrl space for this install. You'll sign in with Google once; afterwards Nodes and Enroll
        work directly against <span class="font-mono">osctrl.inflowenger.com</span>.
      </p>

      <p v-if="osctrlActive || success" class="mb-3 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
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
        v-if="!osctrlActive && !success"
        type="button"
        class="btn-primary"
        :disabled="connecting"
        @click="connect"
      >
        {{ connecting ? 'Waiting…' : 'Create / connect osctrl space' }}
      </button>

      <p class="mt-3 text-xs text-fg-subtle">
        Prefer to run your own osctrl? Configure it directly in the osctrl card below (recommended for production).
      </p>
    </div>
    </div>
  </section>
</template>
