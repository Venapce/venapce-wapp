<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { apiErr } from '@/api/venapce'
import { useConnectionStore } from '@/stores/connection'
import { useSavedViewsStore } from '@/stores/savedViews'
import Icon from '@/components/Icon.vue'
import {
  PREFERENCES_SECTIONS,
  type PreferencesBundle,
  type PreferencesReport,
  type PreferencesSection,
} from '@/api/types'

// One Settings card: this install's PREFERENCES out as a file, and somebody
// else's back in.
//
// What a firm assembles by hand — the charts it built, the dashboards it
// arranged them on and the saved views in its sidebar — is the expensive part
// of setting Venapce up, and the only way to move it used to be to redo it. A
// demo install's work becomes the starting point of the real one; a staging
// install can be made to match production without a database dump.
//
// The pipeline rows are NOT in the file, nor are the Superset / osctrl /
// FloMorphic credentials (see venapce-api preferences.go). That is what lets
// this be one button rather than a data-protection exercise: the file is safe
// to mail, commit and diff.
//
// The import is shown before it is done. "Check the file" runs it on the server
// inside a transaction and rolls it back, so what the operator reads is the
// real outcome — the same conflicts, the same skips — against nothing kept.

const conn = useConnectionStore()
const views = useSavedViewsStore()

const SECTIONS: { key: PreferencesSection; label: string; hint: string }[] = [
  { key: 'charts', label: 'Charts', hint: 'Saved charts, with the builder state that reopens them for editing' },
  { key: 'dashboards', label: 'Dashboards', hint: 'The grid arrangements those charts sit on' },
  { key: 'views', label: 'Saved views', hint: 'The named tag filters in the sidebar' },
]

// ---- export ----
const pick = reactive<Record<PreferencesSection, boolean>>(
  Object.fromEntries(PREFERENCES_SECTIONS.map((s) => [s, true])) as Record<PreferencesSection, boolean>,
)
const exporting = ref(false)
const exportError = ref('')
const exported = ref('')

const chosen = computed(() => PREFERENCES_SECTIONS.filter((s) => pick[s]))

async function exportFile() {
  exporting.value = true
  exportError.value = ''
  exported.value = ''
  try {
    const bundle = await conn.client.exportPreferences(chosen.value)
    const stamp = new Date().toISOString().slice(0, 10)
    download(`venapce-preferences-${stamp}.json`, JSON.stringify(bundle, null, 2))
    exported.value = summarise(bundle)
  } catch (e) {
    exportError.value = apiErr(e)
  } finally {
    exporting.value = false
  }
}

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// ---- import ----
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<{ name: string; bundle: PreferencesBundle } | null>(null)
const take = reactive<Record<string, boolean>>({})
/** Update what is already here, or leave it and count it skipped. */
const overwrite = ref(true)
const busy = ref<'' | 'check' | 'import'>('')
const importError = ref('')
const report = ref<PreferencesReport | null>(null)
const applied = ref(false)

/** The sections this file actually carries — an absent one is not offered. */
const carried = computed(() =>
  file.value ? SECTIONS.filter((s) => count(file.value!.bundle, s.key) !== null) : [],
)
const taking = computed(() => carried.value.filter((s) => take[s.key]).map((s) => s.key))
/** A dashboard cell points at a chart by id, so a dashboard imported without
 *  the charts it names loses those cells rather than showing the wrong chart. */
const boardsWithoutCharts = computed(
  () => taking.value.includes('dashboards') && !taking.value.includes('charts') && !!count(file.value?.bundle, 'charts'),
)

function count(bundle: PreferencesBundle | undefined, key: PreferencesSection): number | null {
  if (!bundle) return null
  const value = (bundle as Record<string, unknown>)[key]
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return Object.keys(value).length
  return null
}

function summarise(bundle: PreferencesBundle): string {
  const parts = SECTIONS.map((s) => {
    const n = count(bundle, s.key)
    return n === null ? '' : `${n} ${s.label.toLowerCase()}`
  }).filter(Boolean)
  return parts.length ? parts.join(' · ') : 'nothing — this install has no preferences set yet'
}

async function chooseFile(ev: Event) {
  const chosenFile = (ev.target as HTMLInputElement).files?.[0]
  if (!chosenFile) return
  reset()
  try {
    const bundle = JSON.parse(await chosenFile.text()) as PreferencesBundle
    if (bundle === null || typeof bundle !== 'object' || Array.isArray(bundle)) {
      importError.value = 'That file is JSON, but not a Venapce preferences file.'
      return
    }
    if (bundle.kind && bundle.kind !== 'venapce.preferences') {
      importError.value = `That is a ${bundle.kind} file, not a Venapce preferences file.`
      return
    }
    file.value = { name: chosenFile.name, bundle }
    // Everything the file carries, ticked — the ordinary intent of picking it.
    for (const s of SECTIONS) take[s.key] = count(bundle, s.key) !== null
  } catch {
    importError.value = 'That file is not readable JSON.'
  } finally {
    // So the same file can be chosen again after a reset.
    if (fileInput.value) fileInput.value.value = ''
  }
}

function reset() {
  file.value = null
  report.value = null
  importError.value = ''
  applied.value = false
}

async function run(dryRun: boolean) {
  if (!file.value || !taking.value.length) return
  busy.value = dryRun ? 'check' : 'import'
  importError.value = ''
  try {
    report.value = await conn.client.importPreferences(file.value.bundle, {
      include: taking.value,
      mode: overwrite.value ? 'merge' : 'add',
      dryRun,
    })
    applied.value = !dryRun
    if (!dryRun) await refreshStores()
  } catch (e) {
    importError.value = apiErr(e)
    report.value = null
  } finally {
    busy.value = ''
  }
}

/**
 * Reload what the panel caches for a session, so the import is visible without
 * a page reload. Best-effort: the import has already committed, and a failed
 * refetch is a stale screen, not a lost change. The charts and dashboards are
 * read per view rather than cached, so the saved views are the only cache here.
 */
async function refreshStores() {
  await Promise.allSettled([views.load(true)])
}
</script>

<template>
  <section class="rounded-lg border border-line bg-surface p-5">
    <div class="mb-4 flex items-start gap-3">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
        <Icon name="archive" :size="16" />
      </span>
      <div>
        <h2 class="text-sm font-semibold text-fg">Preferences</h2>
        <p class="text-xs text-fg-muted">
          Take this install's configuration out as one file, or bring another install's in — the charts, their
          dashboards and the saved views.
          <span class="text-fg-subtle">
            No pipeline rows, no connection credentials: a preferences file is safe to mail and to commit.
          </span>
        </p>
      </div>
    </div>

    <!-- What the two buttons below act on. One list for both: an operator who
         exported the charts alone expects to import the same way. -->
    <div class="mb-4 grid gap-2 sm:grid-cols-2">
      <label
        v-for="s in SECTIONS"
        :key="s.key"
        class="flex cursor-pointer items-start gap-2 rounded-md border border-line bg-surface-2 px-3 py-2"
      >
        <input v-model="pick[s.key]" type="checkbox" class="mt-0.5 h-4 w-4 accent-accent" />
        <span class="min-w-0">
          <span class="block text-sm text-fg">{{ s.label }}</span>
          <span class="block text-[11px] leading-snug text-fg-subtle">{{ s.hint }}</span>
        </span>
      </label>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="btn-primary" :disabled="exporting || !chosen.length" @click="exportFile">
        <Icon :name="exporting ? 'loader' : 'download'" :size="14" :class="exporting && 'animate-spin'" />
        {{ exporting ? 'Exporting…' : 'Export a file' }}
      </button>
      <button type="button" class="btn-outline" title="Read a preferences file" @click="fileInput?.click()">
        <Icon name="upload" :size="14" /> Import a file…
      </button>
      <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="chooseFile" />
      <p v-if="!chosen.length" class="text-xs text-fg-subtle">Tick at least one section to export.</p>
    </div>

    <p v-if="exportError" class="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ exportError }}</p>
    <p v-else-if="exported" class="mt-3 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
      Exported {{ exported }}.
    </p>

    <!-- ===== the import, once a file has been read ===== -->
    <div v-if="importError && !file" class="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {{ importError }}
    </div>

    <div v-if="file" class="mt-5 border-t border-line pt-5">
      <div class="mb-3 flex items-start gap-2">
        <Icon name="upload" :size="14" class="mt-0.5 shrink-0 text-accent" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-fg">{{ file.name }}</p>
          <p class="text-[11px] text-fg-subtle">
            <template v-if="file.bundle.label">{{ file.bundle.label }} · </template>
            <template v-if="file.bundle.exportedAt">
              exported {{ new Date(file.bundle.exportedAt).toLocaleString() }}
            </template>
            <template v-if="file.bundle.appVersion"> · Venapce {{ file.bundle.appVersion }}</template>
          </p>
        </div>
        <button class="icon-btn-sm" title="Forget this file" @click="reset"><Icon name="close" :size="14" /></button>
      </div>

      <p v-if="!carried.length" class="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
        This file carries none of the sections an import can apply.
      </p>

      <template v-else>
        <p class="label">What to take from it</p>
        <div class="mb-3 grid gap-1.5 sm:grid-cols-2">
          <label v-for="s in carried" :key="s.key" class="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input v-model="take[s.key]" type="checkbox" class="h-4 w-4 accent-accent" />
            {{ s.label }}
            <span class="chip-muted tabular">{{ count(file.bundle, s.key) }}</span>
          </label>
        </div>

        <label class="mb-1 flex cursor-pointer items-start gap-2 text-sm text-fg-muted">
          <input v-model="overwrite" type="checkbox" class="mt-0.5 h-4 w-4 accent-accent" />
          <span>
            Update what is already here
            <span class="block text-[11px] leading-snug text-fg-subtle">
              Off, anything this install already has is left exactly as it is and only what is missing is added.
              Nothing is ever deleted by an import.
            </span>
          </span>
        </label>

        <p v-if="boardsWithoutCharts" class="mb-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          A dashboard points at its charts by id, so importing the dashboards without the charts drops the cells whose
          chart is not already here under the same title.
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" class="btn-outline" :disabled="!!busy || !taking.length" @click="run(true)">
            <Icon :name="busy === 'check' ? 'loader' : 'eye'" :size="14" :class="busy === 'check' && 'animate-spin'" />
            {{ busy === 'check' ? 'Checking…' : 'Check the file' }}
          </button>
          <button type="button" class="btn-primary" :disabled="!!busy || !taking.length" @click="run(false)">
            <Icon :name="busy === 'import' ? 'loader' : 'check'" :size="14" :class="busy === 'import' && 'animate-spin'" />
            {{ busy === 'import' ? 'Importing…' : 'Import' }}
          </button>
          <p class="text-[11px] text-fg-subtle">
            A check applies the file on the server and rolls it back, so these counts are the real ones.
          </p>
        </div>
      </template>

      <p v-if="importError" class="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ importError }}</p>

      <!-- ===== the report ===== -->
      <div v-if="report" class="mt-4 rounded-md border border-line bg-surface-2 p-3">
        <p class="mb-2 text-sm font-medium" :class="applied ? 'text-success' : 'text-fg'">
          <Icon :name="applied ? 'checkCircle' : 'info'" :size="14" class="mr-1 inline align-[-2px]" />
          <template v-if="applied">
            Imported: {{ report.created }} added, {{ report.updated }} updated, {{ report.skipped }} left alone.
          </template>
          <template v-else>
            This file would add {{ report.created }}, update {{ report.updated }} and leave {{ report.skipped }} alone.
            Nothing has been written yet.
          </template>
        </p>

        <table class="w-full text-xs">
          <thead class="text-fg-subtle">
            <tr class="text-left">
              <th class="py-1 font-medium">Section</th>
              <th class="py-1 text-right font-medium">Added</th>
              <th class="py-1 text-right font-medium">Updated</th>
              <th class="py-1 text-right font-medium">Left alone</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="row in report.sections" :key="row.name">
              <td class="py-1 text-fg-muted">{{ SECTIONS.find((s) => s.key === row.name)?.label ?? row.name }}</td>
              <td class="py-1 text-right tabular text-fg">{{ row.created }}</td>
              <td class="py-1 text-right tabular text-fg">{{ row.updated }}</td>
              <td class="py-1 text-right tabular text-fg-muted">{{ row.skipped }}</td>
            </tr>
          </tbody>
        </table>

        <!-- The per-item problems that did not stop the import. Worth reading:
             this is where a dashboard that lost a cell says so. -->
        <ul v-if="report.notes.length" class="mt-3 space-y-1 border-t border-line pt-2">
          <li v-for="(n, i) in report.notes" :key="i" class="flex gap-1.5 text-[11px] text-warning">
            <Icon name="alertCircle" :size="12" class="mt-0.5 shrink-0" />
            <span>{{ n }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
