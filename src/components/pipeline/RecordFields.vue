<script setup lang="ts">
import type { FieldSpec } from '@/lib/pipeline'

// Read-only field grid for a row, driven by the same FieldSpec list the editor
// uses. JSON fields are not shown here (they get their own JsonPanel); tags
// render as chips; empty values print as a dash.
defineProps<{ fields: FieldSpec[]; row: Record<string, unknown> }>()

function text(v: unknown): string {
  if (v == null || v === '') return ''
  return String(v)
}
</script>

<template>
  <dl class="divide-y divide-line rounded-md border border-line">
    <template v-for="f in fields" :key="f.key">
      <div v-if="f.kind !== 'json'" class="flex gap-3 px-3 py-1.5 text-xs">
        <dt class="w-28 shrink-0 pt-px text-fg-muted">{{ f.label }}</dt>
        <dd class="min-w-0 flex-1 break-words text-fg" :class="f.mono ? 'font-mono' : ''">
          <template v-if="f.kind === 'tags'">
            <span v-if="!(row[f.key] as string[] | undefined)?.length" class="text-fg-subtle">—</span>
            <span v-else class="flex flex-wrap gap-1">
              <span v-for="t in row[f.key] as string[]" :key="t" class="chip-muted">{{ t }}</span>
            </span>
          </template>
          <template v-else-if="text(row[f.key])">
            <span :class="f.kind === 'textarea' ? 'whitespace-pre-wrap' : ''">{{ text(row[f.key]) }}</span>
          </template>
          <span v-else class="text-fg-subtle">—</span>
        </dd>
      </div>
    </template>
  </dl>
</template>
