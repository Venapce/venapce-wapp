<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { sampleFindings, sampleIssues, sampleStage } from '@/lib/samples'
import RecordPage from '@/components/pipeline/RecordPage.vue'
import Badge from '@/components/pipeline/Badge.vue'
import FactChip from '@/components/pipeline/FactChip.vue'
import Icon from '@/components/Icon.vue'
import {
  CATEGORIES,
  CONFIDENCES,
  FINDING_STATUSES,
  SEVERITIES,
  rowRoute,
  type FieldSpec,
} from '@/lib/pipeline'
import type { Finding, FindingDetail, FindingInput } from '@/api/types'

// One finding: what a process concluded, with its evidence (data), enrichment
// (meta) and provenance (ref), plus the staged row it came from and the issue
// it became. Edit any field in place, or promote it to an issue.
const props = defineProps<{ id: string }>()
const conn = useConnectionStore()
const router = useRouter()

const detail = ref<FindingDetail | null>(null)
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
  { key: 'status', label: 'Status', kind: 'select', options: FINDING_STATUSES },
  { key: 'severity', label: 'Severity', kind: 'select', options: SEVERITIES },
  { key: 'confidence', label: 'Confidence', kind: 'suggest', options: CONFIDENCES, hint: 'How sure the producer is.' },
  { key: 'category', label: 'Category', kind: 'suggest', options: CATEGORIES },
  { key: 'target', label: 'Target', kind: 'text', mono: true, hint: 'The affected asset — node, identity, service.' },
  { key: 'source', label: 'Source', kind: 'text', mono: true, hint: 'Where the underlying data came from.' },
  { key: 'origin', label: 'Origin', kind: 'text', mono: true, hint: 'Which process produced this finding.' },
  { key: 'fingerprint', label: 'Fingerprint', kind: 'text', mono: true, hint: 'Producer-chosen dedup key.' },
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
    detail.value = await conn.client.getFinding(props.id)
    sample.value = false
  } catch (e) {
    const s = sampleFindings.find((f) => String(f.id) === props.id)
    if (s) {
      detail.value = {
        item: s,
        stage: sampleStage.find((x) => String(x.id) === String(s.stageId)) ?? null,
        issue: sampleIssues.find((x) => String(x.id) === String(s.issueId)) ?? null,
      }
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
    const updated: Finding = await conn.client.updateFinding(row.value.id, patch as FindingInput)
    detail.value = { ...detail.value!, item: updated }
    editing.value = false
  } catch (e) {
    saveError.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!row.value || !window.confirm(`Delete finding #${row.value.id} "${row.value.title}"?`)) return
  try {
    await conn.client.deleteFinding(row.value.id)
    router.push({ name: 'findings' })
  } catch (e) {
    error.value = apiErr(e)
  }
}

const promoting = ref(false)
async function promote() {
  if (!row.value || !window.confirm('Open an issue from this finding? It inherits the title, severity, tags and documents.')) return
  promoting.value = true
  try {
    const res = await conn.client.promoteFinding(row.value.id)
    notice.value = { text: `Issue #${res.issue.id} opened.`, to: rowRoute('issue', res.issue.id), linkText: 'Open issue' }
    await load()
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    promoting.value = false
  }
}

watch(() => props.id, load)
onMounted(load)
</script>

<template>
  <RecordPage
    kind="finding"
    :back-to="{ name: 'findings' }"
    back-label="Findings"
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
      <Badge kind="severity" :value="row?.severity" size="md" />
      <Badge kind="finding-status" :value="row?.status" size="md" />
      <FactChip icon="gauge" label="Confidence" :value="row?.confidence" />
      <FactChip icon="folder" label="Category" :value="row?.category" />
      <FactChip icon="target" label="Target" :value="row?.target" mono />
      <FactChip icon="database" label="Source" :value="row?.source" mono />
      <FactChip icon="workflow" label="Origin" :value="row?.origin" mono />
      <FactChip icon="fingerprint" label="Fingerprint" :value="row?.fingerprint" mono />
    </template>

    <template #actions>
      <button
        v-if="row && !row.issueId"
        class="btn-primary btn-sm"
        :disabled="sample || promoting || editing"
        title="Validated — open an issue from this finding"
        @click="promote"
      >
        <Icon name="flag" :size="13" /> {{ promoting ? 'Opening…' : 'Open issue' }}
      </button>
    </template>

    <template #related>
      <section v-if="detail?.stage">
        <h3 class="label">From stage</h3>
        <RouterLink :to="rowRoute('stage', detail.stage.id)" class="card block p-3 text-xs hover:border-accent-border">
          <div class="font-medium text-fg">{{ detail.stage.title || `stage #${detail.stage.id}` }}</div>
          <div class="mt-0.5 truncate text-fg-subtle">{{ detail.stage.summary || detail.stage.source }}</div>
        </RouterLink>
      </section>
      <section v-if="detail?.issue">
        <h3 class="label">Became issue</h3>
        <RouterLink :to="rowRoute('issue', detail.issue.id)" class="card block p-3 text-xs hover:border-accent-border">
          <div class="font-medium text-fg">{{ detail.issue.title }}</div>
          <div class="mt-1 flex items-center gap-1.5">
            <Badge kind="severity" :value="detail.issue.severity" />
            <Badge kind="issue-status" :value="detail.issue.status" />
          </div>
        </RouterLink>
      </section>
    </template>
  </RecordPage>
</template>
