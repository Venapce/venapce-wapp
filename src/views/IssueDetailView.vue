<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import { sampleFindings, sampleIssues, sampleStage } from '@/lib/samples'
import RecordPage from '@/components/pipeline/RecordPage.vue'
import Badge from '@/components/pipeline/Badge.vue'
import FactChip from '@/components/pipeline/FactChip.vue'
import {
  ISSUE_STATUSES,
  SEVERITIES,
  rowRoute,
  type FieldSpec,
} from '@/lib/pipeline'
import type { Issue, IssueDetail, IssueInput } from '@/api/types'

// One issue: the row to validate / fix / act on, with its documents, what it
// was promoted from, and every finding that points at it.
const props = defineProps<{ id: string }>()
const conn = useConnectionStore()
const router = useRouter()

const detail = ref<IssueDetail | null>(null)
const loading = ref(true)
const error = ref('')
const sample = ref(false)
const editing = ref(false)
const saving = ref(false)
const saveError = ref('')

const row = computed(() => detail.value?.item ?? null)

const FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Title', kind: 'text' },
  { key: 'status', label: 'Status', kind: 'suggest', options: ISSUE_STATUSES, hint: 'Free text — FloMorphic drives the lifecycle.' },
  { key: 'severity', label: 'Severity', kind: 'select', options: SEVERITIES },
  { key: 'assignee', label: 'Assignee', kind: 'text' },
  { key: 'source', label: 'Source', kind: 'text', mono: true, hint: 'Where the underlying data came from.' },
  { key: 'origin', label: 'Origin', kind: 'text', mono: true, hint: 'Which process produced this issue.' },
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
    detail.value = await conn.client.getIssue(props.id)
    sample.value = false
  } catch (e) {
    const s = sampleIssues.find((i) => String(i.id) === props.id)
    if (s) {
      detail.value = {
        item: s,
        findings: sampleFindings.filter((f) => String(f.issueId) === String(s.id)),
        stage: sampleStage.find((x) => String(x.id) === String(s.stageId)) ?? null,
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
    const updated: Issue = await conn.client.updateIssue(row.value.id, patch as IssueInput)
    detail.value = { ...detail.value!, item: updated }
    editing.value = false
  } catch (e) {
    saveError.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!row.value || !window.confirm(`Delete issue #${row.value.id} "${row.value.title}"?`)) return
  try {
    await conn.client.deleteIssue(row.value.id)
    router.push({ name: 'issues' })
  } catch (e) {
    error.value = apiErr(e)
  }
}

watch(() => props.id, load)
onMounted(load)
</script>

<template>
  <RecordPage
    kind="issue"
    :back-to="{ name: 'issues' }"
    back-label="Issues"
    :row="row"
    :fields="FIELDS"
    :loading="loading"
    :error="error"
    :sample="sample"
    :editing="editing"
    :saving="saving"
    :save-error="saveError"
    @edit="editing = true"
    @cancel="editing = false"
    @save="save"
    @remove="remove"
    @refresh="load"
  >
    <template #badges>
      <Badge kind="severity" :value="row?.severity" size="md" />
      <Badge kind="issue-status" :value="row?.status" size="md" />
      <FactChip icon="user" label="Assignee" :value="row?.assignee" />
      <FactChip icon="database" label="Source" :value="row?.source" mono />
      <FactChip icon="workflow" label="Origin" :value="row?.origin" mono />
    </template>

    <template #related>
      <section v-if="detail?.findings.length">
        <h3 class="label">Findings behind this issue</h3>
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
      <section v-if="detail?.stage">
        <h3 class="label">Raw data (stage)</h3>
        <RouterLink :to="rowRoute('stage', detail.stage.id)" class="card block p-3 text-xs hover:border-accent-border">
          <div class="font-medium text-fg">{{ detail.stage.title || `stage #${detail.stage.id}` }}</div>
          <div class="mt-0.5 truncate font-mono text-fg-subtle">{{ detail.stage.source }}</div>
        </RouterLink>
      </section>
    </template>
  </RecordPage>
</template>
