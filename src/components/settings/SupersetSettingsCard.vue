<script setup lang="ts">
import { ref } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'

// One Settings card: the Superset data-source connection. Superset is always
// discovered from the environment (fed automatically in both docker and dev), so
// this card is a CLOSED accordion by default — its only reason to open is to
// point Venapce at an EXTERNAL Superset instead, which then becomes the
// operator's to manage. Reverting hands it back to the built-in (env) instance.
const conn = useConnectionStore()

const url = ref(conn.supersetUrl || import.meta.env.VITE_SUPERSET_URL || 'http://localhost:8088')
const username = ref(conn.username || 'admin')
const password = ref('')
const saving = ref(false)
const error = ref('')
const result = ref<{ connected?: boolean; connectedAs?: string; connectionError?: string } | null>(null)
const open = ref(false)

async function save() {
  saving.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await conn.saveSuperset(url.value.trim(), username.value.trim(), password.value)
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
    result.value = await conn.test()
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function revert() {
  saving.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await conn.reset()
    url.value = conn.supersetUrl || url.value
    username.value = conn.username || username.value
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="card p-6">
    <!-- Always a closed accordion: click the header to open the external-Superset form. -->
    <button type="button" class="flex w-full items-start gap-3 text-left" @click="open = !open">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">⛁</span>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-fg">Superset connection</h2>
        <p class="truncate text-xs text-fg-muted">
          <template v-if="conn.configured">
            {{ conn.managed ? 'Built-in' : 'External' }} · {{ conn.supersetUrl }} — open to use an external Superset.
          </template>
          <template v-else>Not configured — open to connect an external Superset.</template>
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
      <span class="ml-1 shrink-0 text-fg-subtle" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
    </button>

    <div v-show="open" class="mt-4 space-y-4">
      <!-- Current connection (read-only summary). -->
      <dl v-if="conn.configured" class="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
        <dt class="text-fg-muted">Source</dt>
        <dd class="text-fg">{{ conn.managed ? 'Built-in (from environment)' : 'External (operator-managed)' }}</dd>
        <dt class="text-fg-muted">URL</dt>
        <dd class="break-all text-fg">{{ conn.supersetUrl || '—' }}</dd>
        <dt class="text-fg-muted">Username</dt>
        <dd class="text-fg">{{ conn.username || '—' }}</dd>
      </dl>

      <form class="space-y-4 border-t border-line pt-4" @submit.prevent="save">
        <p class="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          By default Venapce uses the built-in Superset configured from the environment. Set the fields below to
          point at your own external Superset — it then becomes yours to manage. Revert at any time.
        </p>
        <div>
          <label class="label">Superset URL</label>
          <input v-model="url" class="field" placeholder="https://superset.example.com" autocomplete="off" />
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
            :placeholder="conn.configured && !conn.managed ? 'unchanged — leave blank to keep' : ''"
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
            {{ saving ? 'Saving…' : 'Use external Superset' }}
          </button>
          <button
            type="button"
            class="btn-outline"
            :disabled="saving || !conn.configured"
            @click="conn.managed ? test() : revert()"
          >
            {{ conn.managed ? 'Test' : 'Revert to built-in' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
