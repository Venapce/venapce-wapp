<script setup lang="ts">
import { ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import Icon from '@/components/Icon.vue'
import type { SupersetDatabase } from '@/api/types'

// Register a table from an *existing* database connection as a dataset, so the
// builder can chart it. New external connections (ClickHouse etc.) are still
// added in Settings — this only picks one of them and names a table on it.
// Lives next to the builder's dataset list, which is where datasets are now
// browsed (there is no separate Datasets page any more).
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'created', id: number): void
  (e: 'close'): void
}>()

const conn = useConnectionStore()

const databases = ref<SupersetDatabase[]>([])
const loadingDatabases = ref(false)
const saving = ref(false)
const error = ref('')

const form = ref<{ database: number | null; schema: string; table: string }>({
  database: null,
  schema: '',
  table: '',
})
const schemas = ref<string[]>([])
const tables = ref<string[]>([])
const loadingSchemas = ref(false)
const loadingTables = ref(false)

// Re-seed on every open: the database list may have grown in Settings since.
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    error.value = ''
    form.value = { database: null, schema: '', table: '' }
    schemas.value = []
    tables.value = []
    loadingDatabases.value = true
    try {
      databases.value = await conn.client.databases()
      form.value.database = databases.value[0]?.id ?? null
    } catch (e) {
      error.value = apiErr(e)
    } finally {
      loadingDatabases.value = false
    }
  },
)

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
      schemas.value = await conn.client.databaseSchemas(dbId)
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
      tables.value = await conn.client.databaseTables(form.value.database, schema)
    } catch {
      /* driver can't list tables — user types it manually */
    } finally {
      loadingTables.value = false
    }
  },
)

async function submit() {
  error.value = ''
  if (!form.value.database || !form.value.table.trim()) {
    error.value = 'Pick a database connection and a table name.'
    return
  }
  saving.value = true
  try {
    const created = await conn.client.createDataset({
      database: form.value.database,
      schema: form.value.schema.trim() || undefined,
      table_name: form.value.table.trim(),
    })
    emit('created', created.id)
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="card w-full max-w-md p-5" role="dialog" aria-modal="true">
      <h3 class="mb-1 text-base font-semibold text-fg">Add dataset</h3>
      <p class="mb-4 text-xs text-fg-muted">
        Register a table from an existing database connection so you can build charts on it. Connections themselves are added in
        <RouterLink :to="{ name: 'settings' }" class="text-accent hover:underline">Settings</RouterLink>.
      </p>

      <label class="label">Database connection</label>
      <select v-model.number="form.database" class="field mb-3 w-full" :disabled="loadingDatabases">
        <option v-if="loadingDatabases" :value="null">Loading connections…</option>
        <option v-else-if="!databases.length" :value="null">No connections yet</option>
        <option v-for="db in databases" :key="db.id" :value="db.id">
          {{ db.database_name }}<template v-if="db.backend"> · {{ db.backend }}</template>
        </option>
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
        @keyup.enter="submit"
      />
      <select v-else v-model="form.table" class="field mb-4 w-full">
        <option value="">Select a table…</option>
        <option v-for="t in tables" :key="t" :value="t">{{ t }}</option>
      </select>

      <p v-if="error" class="mb-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button class="btn-outline" :disabled="saving" @click="emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="saving || !databases.length" @click="submit">
          <Icon :name="saving ? 'refresh' : 'plus'" :size="14" :class="saving ? 'animate-spin' : ''" />
          {{ saving ? 'Adding…' : 'Add dataset' }}
        </button>
      </div>
    </div>
  </div>
</template>
