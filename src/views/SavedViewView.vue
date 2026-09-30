<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useSavedViewsStore } from '@/stores/savedViews'
import Icon from '@/components/Icon.vue'
import type { SavedViewTable } from '@/api/types'

// A saved view renders the table it filters. The view itself only says *which*
// table and *which* tags — the list view does the rest, seeded from the view
// (see `viewId` in StageView / FindingsView / IssuesView / ActivitiesView).
const props = defineProps<{ viewId: string }>()

const store = useSavedViewsStore()

// Views live in the backend, so "not found" is only true once they are loaded.
const ready = ref(false)
onMounted(async () => {
  await store.load()
  ready.value = true
})

const TABLE_VIEW: Record<SavedViewTable, ReturnType<typeof defineAsyncComponent>> = {
  stage: defineAsyncComponent(() => import('@/views/StageView.vue')),
  findings: defineAsyncComponent(() => import('@/views/FindingsView.vue')),
  issues: defineAsyncComponent(() => import('@/views/IssuesView.vue')),
  activities: defineAsyncComponent(() => import('@/views/ActivitiesView.vue')),
}

const view = computed(() => store.get(props.viewId))
</script>

<template>
  <component :is="TABLE_VIEW[view.table]" v-if="view" :key="view.id" :view-id="String(view.id)" />

  <p v-else-if="!ready" class="p-6 text-sm text-fg-subtle">Loading view…</p>

  <div v-else class="p-6">
    <div class="card mx-auto max-w-md p-8 text-center">
      <Icon name="eye" :size="28" class="mb-3 text-fg-subtle" />
      <h1 class="mb-1 text-base font-semibold text-fg">View not found</h1>
      <p class="mb-4 text-sm text-fg-muted">
        This saved view no longer exists — it may have been deleted from the sidebar.
      </p>
      <p v-if="store.error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{{ store.error }}</p>
      <RouterLink :to="{ name: 'issues' }" class="btn-outline">Back to Issues</RouterLink>
    </div>
  </div>
</template>
