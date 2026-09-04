<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'

// One Settings card: the Superset data-source connection. The backend stores and
// encrypts the credentials and probes the login; the browser never holds a token.
const conn = useConnectionStore()
const router = useRouter()
const route = useRoute()

const url = ref(conn.supersetUrl || import.meta.env.VITE_SUPERSET_URL || 'http://localhost:8088')
const username = ref(conn.username || 'admin')
const password = ref('')
const saving = ref(false)
const error = ref('')
const result = ref<{ connected?: boolean; connectedAs?: string; connectionError?: string } | null>(null)

async function save() {
  saving.value = true
  error.value = ''
  result.value = null
  try {
    const view = await conn.saveSuperset(url.value.trim(), username.value.trim(), password.value)
    password.value = ''
    result.value = view
    // First-time setup: once connected, head into the app.
    if (route.query.setup === '1' && view.connected) router.push({ name: 'dashboards' })
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
    result.value = await conn.test()
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
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">⛁</span>
      <div>
        <h2 class="text-sm font-semibold text-fg">Superset connection</h2>
        <p class="text-xs text-fg-muted">
          The data source Venapce renders. Credentials are stored and encrypted by the backend.
        </p>
      </div>
      <span
        class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
        :class="
          !conn.configured
            ? 'bg-surface-2 text-fg-muted'
            : conn.connected === false
              ? 'bg-danger-soft text-danger'
              : 'bg-success-soft text-success'
        "
      >
        {{ !conn.configured ? 'Not configured' : conn.connected === false ? 'Login failing' : 'Connected' }}
      </span>
    </div>

    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="label">Superset URL</label>
        <input v-model="url" class="field" placeholder="http://localhost:8088" autocomplete="off" />
      </div>
      <div>
        <label class="label">Username</label>
        <input v-model="username" class="field" autocomplete="username" />
      </div>
      <div>
        <label class="label">Password</label>
        <input
          v-model="password"
          type="password"
          class="field"
          :placeholder="conn.configured ? 'unchanged — leave blank to keep' : ''"
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
        <button type="button" class="btn-outline" :disabled="saving || !conn.configured" @click="test">
          Test
        </button>
      </div>
    </form>
  </section>
</template>
