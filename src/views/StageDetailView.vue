<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { sampleFindings, sampleStage } from '@/lib/samples'
import RecordPage from '@/components/pipeline/RecordPage.vue'
import Badge from '@/components/pipeline/Badge.vue'
import FactChip from '@/components/pipeline/FactChip.vue'
import Icon from '@/components/Icon.vue'
import {
  DISPOSITIONS,
  hasLink,
  rowRoute,
  type FieldSpec,
} from '@/lib/pipeline'
import type { StageDetail, StageInput, StageItem } from '@/api/types'

// One staged row: the raw payload as it arrived, explorable as a tree, plus
// the flow's routing decision and what the row became. From here an operator
// can also do by hand what a flow would: promote it to a finding or an issue.
const props = defineProps<{ id: string }>()
const conn = useConnectionStore()
const router = useRouter()

const detail = ref<StageDetail | null>(null)
const loading = ref(true)
const error = ref('')
const sample = ref(false)
const editing = ref(false)
const saving = ref(false)
const saveError = ref('')
const notice = ref<InstanceType<typeof RecordPage>['$props']['notice']>(null)

const row = computed(() => detail.value?.item ?? null)

const FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Title', kind: 'text' },
  { key: 'disposition', label: 'Disposition', kind: 'select', options: DISPOSITIONS, hint: "The flow's routing decision." },
  { key: 'source', label: 'Source', kind: 'text', mono: true, hint: 'Where the data came from.' },
  { key: 'origin', label: 'Origin', kind: 'text', mono: true, hint: 'Which pipeline / process delivered it.' },
  { key: 'summary', label: 'Summary', kind: 'textarea' },
  { key: 'tags', label: 'Tags', kind: 'tags' },
  { key: 'data', label: 'Data', kind: 'json' },
  { key: 'meta', label: 'Meta', kind: 'json' },
  { key: 'ref', label: 'Reference', kind: 'json' },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await conn.client.getStage(props.id)
    sample.value = false
  } catch (e) {
    const s = sampleStage.find((x) => String(x.id) === props.id)
    if (s) {
      detail.value = { item: s, findings: sampleFindings.filter((f) => String(f.stageId) === String(s.id)) }
      sample.value = true
    } else {
      detail.value = null
      error.value = apiErr(e)
    }
  } finally {
    loading.value = false
  }
}

async function save(patch: Record<string, unknown>) {
  if (!row.value) return
  if (Object.keys(patch).length === 0) {
    editing.value = false
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    const updated: StageItem = await conn.client.updateStage(row.value.id, patch as StageInput)
    detail.value = { ...detail.value!, item: updated }
    editing.value = false
  } catch (e) {
    saveError.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!row.value || !window.confirm(`Delete staged row #${row.value.id}?`)) return
  try {
    await conn.client.deleteStage(row.value.id)
    router.push({ name: 'stage' })
  } catch (e) {
    error.value = apiErr(e)
  }
}

const promoting = ref<'' | 'finding' | 'issue'>('')
async function promote(to: 'finding' | 'issue') {
  if (!row.value) return
  const what = to === 'finding' ? 'a finding' : 'an issue'
  if (!window.confirm(`Promote this staged row to ${what}? It inherits the title, tags and documents; the row is marked promoted.`)) return
  promoting.value = to
  try {
    const res = await conn.client.promoteStage(row.value.id, to)
    const made = to === 'finding' ? res.finding! : res.issue!
    notice.value = {
      text: `${to === 'finding' ? 'Finding' : 'Issue'} #${made.id} created.`,
      to: rowRoute(to, made.id),
      linkText: `Open ${to}`,
    }
    await load()
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    promoting.value = ''
  }
}

watch(() => props.id, load)
onMounted(load)
</script>

<template>
  <RecordPage
    kind="stage"
    :back-to="{ name: 'stage' }"
    back-label="Stage"
    :row="row"
    :fields="FIELDS"
    :loading="loading"
    :error="error"
    :sample="sample"
    :editing="editing"
    :saving="saving"
    :save-error="saveError"
    :notice="notice"
    @edit="editing = true"
    @cancel="editing = false"
    @save="save"
    @remove="remove"
    @refresh="load"
  >
    <template #badges>
      <Badge kind="disposition" :value="row?.disposition" size="md" />
      <FactChip icon="database" label="Source" :value="row?.source" mono />
      <FactChip icon="workflow" label="Origin" :value="row?.origin" mono />
    </template>

    <template #actions>
      <template v-if="row && !hasLink(row.findingId) && !hasLink(row.issueId)">
        <button
          class="btn-outline btn-sm"
          :disabled="sample || !!promoting || editing"
          title="Make a finding from this row (the usual next level)"
          @click="promote('finding')"
        >
          <Icon name="target" :size="13" /> {{ promoting === 'finding' ? 'Creating…' : 'To finding' }}
        </button>
        <button
          class="btn-outline btn-sm"
          :disabled="sample || !!promoting || editing"
          title="Skip findings and open an issue directly"
          @click="promote('issue')"
        >
          <Icon name="flag" :size="13" /> {{ promoting === 'issue' ? 'Creating…' : 'To issue' }}
        </button>
      </template>
    </template>

    <template #related>
      <section v-if="detail?.findings.length">
        <h3 class="label">Findings made from this row</h3>
        <div class="card divide-y divide-line">
          <RouterLink
            v-for="f in detail.findings"
            :key="f.id"
            :to="rowRoute('finding', f.id)"
            class="flex items-center gap-3 px-3 py-2 text-xs hover:bg-bg"
          >
            <Badge kind="severity" :value="f.severity" />
            <Badge kind="finding-status" :value="f.status" />
            <span class="min-w-0 flex-1 truncate font-medium text-fg">{{ f.title }}</span>
            <span class="font-mono text-fg-subtle">#{{ f.id }}</span>
          </RouterLink>
        </div>
      </section>
    </template>
  </RecordPage>
</template>
