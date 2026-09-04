<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import type { DatasetSummary, SupersetDatabase } from '@/api/types'

const conn = useConnectionStore()
const databases = ref<SupersetDatabase[]>([])
const datasets = ref<DatasetSummary[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const client = conn.client!
    ;[databases.value, datasets.value] = await Promise.all([client.databases(), client.datasets(search.value)])
  } catch (e) {
    const err = e as { message?: string }
    error.value = err.message ?? 'Failed to load'
  } finally {
    loading.value = false
  }
}

// ---- Add Dataset dialog ----
// A dataset just registers a table on an *existing* database connection. New
// external connections (ClickHouse etc.) are added in Settings → Advanced.
const showAdd = ref(false)
const saving = ref(false)
const addError = ref('')
const form = ref<{ database: number | null; schema: string; table: string }>({
  database: null,
  schema: '',
  table: '',
})
const schemas = ref<string[]>([])
const tables = ref<string[]>([])
const loadingSchemas = ref(false)
const loadingTables = ref(false)

function openAdd() {
  addError.value = ''
  form.value = { database: databases.value[0]?.id ?? null, schema: '', table: '' }
  schemas.value = []
  tables.value = []
  showAdd.value = true
}

// When the database changes, try to fetch its schemas (introspection may be
// unsupported by the driver — fall back to a free-text field on failure).
watch(
  () => form.value.database,
  async (dbId) => {
    schemas.value = []
    tables.value = []
    form.value.schema = ''
    form.value.table = ''
    if (!dbId) return
    loadingSchemas.value = true
    try {
      schemas.value = await conn.client!.databaseSchemas(dbId)
    } catch {
      /* driver can't list schemas — user types it manually */
    } finally {
      loadingSchemas.value = false
    }
  },
)

// When the schema changes, try to fetch its tables.
watch(
  () => form.value.schema,
  async (schema) => {
    tables.value = []
    if (!form.value.database) return
    loadingTables.value = true
    try {
      tables.value = await conn.client!.databaseTables(form.value.database, schema)
    } catch {
      /* driver can't list tables — user types it manually */
    } finally {
      loadingTables.value = false
    }
  },
)

async function submitAdd() {
  addError.value = ''
  if (!form.value.database || !form.value.table.trim()) {
    addError.value = 'Pick a database connection and a table name.'
    return
  }
  saving.value = true
  try {
    await conn.client!.createDataset({
      database: form.value.database,
      schema: form.value.schema.trim() || undefined,
      table_name: form.value.table.trim(),
    })
    showAdd.value = false
    await load()
  } catch (e) {
    addError.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="p-6">
    <div class="mb-5 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">Datasets &amp; Databases</h1>
      <input
        v-model="search"
        class="field ml-auto max-w-xs"
        placeholder="Search datasets…"
        @keyup.enter="load"
      />
      <button class="btn-outline" @click="load">Refresh</button>
      <button class="btn" :disabled="!databases.length" @click="openAdd">+ Add Dataset</button>
    </div>

    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>

    <template v-else>
      <!-- Databases -->
      <h2 class="label">Databases ({{ databases.length }})</h2>
      <div class="mb-6 flex flex-wrap gap-2">
        <div v-for="db in databases" :key="db.id" class="card px-4 py-2 text-sm">
          <div class="font-medium text-fg">{{ db.database_name }}</div>
          <div class="text-xs text-fg-subtle">{{ db.backend || 'sqlalchemy' }}</div>
        </div>
        <p v-if="!databases.length" class="text-sm text-fg-subtle">
          No database connections yet — add one in
          <RouterLink :to="{ name: 'settings' }" class="text-accent hover:underline">Settings</RouterLink>.
        </p>
      </div>

      <!-- Datasets -->
      <h2 class="label">Datasets ({{ datasets.length }})</h2>
      <div class="card overflow-hidden">
        <table class="min-w-full text-sm">
          <thead class="bg-surface-2 text-left text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th class="px-4 py-2">Dataset</th>
              <th class="px-4 py-2">Schema</th>
              <th class="px-4 py-2">Database</th>
              <th class="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in datasets" :key="d.id" class="border-t border-line hover:bg-bg">
              <td class="px-4 py-2 font-medium text-fg">{{ d.table_name }}</td>
              <td class="px-4 py-2 text-fg-muted">{{ d.schema || '—' }}</td>
              <td class="px-4 py-2 text-fg-muted">{{ d.database?.database_name || '—' }}</td>
              <td class="px-4 py-2 text-right">
                <RouterLink :to="{ name: 'builder' }" class="text-xs font-medium text-accent hover:underline">
                  Build chart →
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Add Dataset modal -->
    <div
      v-if="showAdd"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      @click.self="showAdd = false"
    >
      <div class="card w-full max-w-md p-5">
        <h3 class="mb-1 text-base font-semibold text-fg">Add dataset</h3>
        <p class="mb-4 text-xs text-fg-muted">
          Register a table from an existing database connection so you can build charts on it.
        </p>

        <label class="label">Database connection</label>
        <select v-model.number="form.database" class="field mb-3 w-full">
          <option v-for="db in databases" :key="db.id" :value="db.id">{{ db.database_name }}</option>
        </select>

        <label class="label">Schema <span class="text-fg-subtle">(optional)</span></label>
        <input
          v-if="!schemas.length"
          v-model="form.schema"
          class="field mb-3 w-full"
          :placeholder="loadingSchemas ? 'Loading schemas…' : 'e.g. default'"
        />
        <select v-else v-model="form.schema" class="field mb-3 w-full">
          <option value="">(none)</option>
          <option v-for="s in schemas" :key="s" :value="s">{{ s }}</option>
        </select>

        <label class="label">Table</label>
        <input
          v-if="!tables.length"
          v-model="form.table"
          class="field mb-4 w-full"
          :placeholder="loadingTables ? 'Loading tables…' : 'e.g. events'"
        />
        <select v-else v-model="form.table" class="field mb-4 w-full">
          <option value="">Select a table…</option>
          <option v-for="t in tables" :key="t" :value="t">{{ t }}</option>
        </select>

        <p v-if="addError" class="mb-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ addError }}</p>

        <div class="flex justify-end gap-2">
          <button class="btn-outline" :disabled="saving" @click="showAdd = false">Cancel</button>
          <button class="btn" :disabled="saving" @click="submitAdd">
            {{ saving ? 'Adding…' : 'Add dataset' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
