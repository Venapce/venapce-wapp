<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { IssueView } from '@/api/types'

// Modal for defining a saved Issues sub-view: a name plus a tag filter. This is
// how a user "adds a submenu under Issues" — no new table, just tags.
const props = defineProps<{ open: boolean; editing?: IssueView | null }>()
const emit = defineEmits<{
  (e: 'save', payload: { name: string; tags: string[]; match: 'any' | 'all' }): void
  (e: 'close'): void
}>()

const name = ref('')
const tagsInput = ref('')
const match = ref<'any' | 'all'>('any')

const tags = computed(() =>
  tagsInput.value
    .split(',')
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean),
)

const canSave = computed(() => name.value.trim().length > 0 && tags.value.length > 0)

// Re-seed the form whenever the dialog opens (fresh, or from the edited view).
watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = props.editing?.name ?? ''
    tagsInput.value = props.editing?.tags.join(', ') ?? ''
    match.value = props.editing?.match ?? 'any'
  },
)

function save() {
  if (!canSave.value) return
  emit('save', { name: name.value.trim(), tags: tags.value, match: match.value })
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="card w-full max-w-md p-6" role="dialog" aria-modal="true">
      <h2 class="mb-1 text-sm font-semibold text-fg">{{ editing ? 'Edit view' : 'New issue view' }}</h2>
      <p class="mb-4 text-xs text-fg-muted">
        A view is a named tag filter. It appears as a sub-item under Issues and shows only matching rows.
      </p>

      <div class="space-y-4">
        <div>
          <label class="label">Name</label>
          <input v-model="name" class="field" placeholder="e.g. Untrusted" @keyup.enter="save" />
        </div>
        <div>
          <label class="label">Tags (comma-separated)</label>
          <input v-model="tagsInput" class="field" placeholder="untrusted, network" @keyup.enter="save" />
          <div v-if="tags.length" class="mt-2 flex flex-wrap gap-1">
            <span v-for="t in tags" :key="t" class="chip">#{{ t }}</span>
          </div>
        </div>
        <div v-if="tags.length > 1">
          <label class="label">Match</label>
          <select v-model="match" class="field">
            <option value="any">any of the tags</option>
            <option value="all">all of the tags</option>
          </select>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <button class="btn-outline" @click="emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="!canSave" @click="save">
          {{ editing ? 'Save' : 'Create view' }}
        </button>
      </div>
    </div>
  </div>
</template>
