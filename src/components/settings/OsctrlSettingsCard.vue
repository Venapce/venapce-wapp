<script setup lang="ts">
import { ref, watch } from 'vue'
import { useOsctrlStore } from '@/stores/osctrl'
import { apiErr } from '@/api/venapce'

// The osctrl connection card. osctrl backs the Nodes area (enrolled systems +
// enroll commands). Like Superset, the backend stores/encrypts the credentials
// and probes the API login; the JWT never reaches the browser.
const osctrl = useOsctrlStore()

const url = ref(osctrl.url || 'http://localhost:9002')
const username = ref(osctrl.username || 'admin')
const password = ref('')
const environment = ref(osctrl.environment || '')
const saving = ref(false)
const error = ref('')
const result = ref<{ connected?: boolean; connectedAs?: string; connectionError?: string } | null>(null)

// The store loads its settings asynchronously (SettingsView triggers loadSettings
// on mount), so on a page refresh this card mounts before the saved config
// arrives and the refs above snapshot an empty store. Re-populate the form once
// the persisted values land so a saved connection survives refresh/reopen.
watch(
  () => [osctrl.loaded, osctrl.url, osctrl.username, osctrl.environment] as const,
  ([loaded]) => {
    if (!loaded) return
    if (osctrl.url) url.value = osctrl.url
    if (osctrl.username) username.value = osctrl.username
    environment.value = osctrl.environment || environment.value
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
    <div class="mb-4 flex items-start gap-3">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">🖧</span>
      <div>
        <h2 class="text-sm font-semibold text-fg">osctrl connection</h2>
        <p class="text-xs text-fg-muted">
          Fleet manager behind the Nodes area. Credentials are stored and encrypted by the backend.
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
    </div>

    <form class="space-y-4" @submit.prevent="save">
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
          :placeholder="osctrl.configured ? 'unchanged — leave blank to keep' : ''"
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
  </section>
</template>
