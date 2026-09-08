<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useOsctrlStore } from '@/stores/osctrl'
import { useFlomorphicStore } from '@/stores/flomorphic'
import { useIssueViewsStore } from '@/stores/issueViews'
import ThemeToggle from '@/components/ThemeToggle.vue'
import VersionBadge from '@/components/VersionBadge.vue'
import Icon from '@/components/Icon.vue'
import IssueViewDialog from '@/components/IssueViewDialog.vue'
import type { IssueView } from '@/api/types'

const osctrl = useOsctrlStore()
const flo = useFlomorphicStore()
const views = useIssueViewsStore()
const router = useRouter()

// The dashboard workspace — everything here feeds building & viewing dashboards.
const dashboardNav = [
  { name: 'dashboards', label: 'Visualizations', icon: 'dashboard' },
  { name: 'builder', label: 'Chart Builder', icon: 'chartBar' },
  { name: 'datasets', label: 'Datasets', icon: 'database' },
]

// Nodes (osctrl): enrolled systems and how to enroll new ones.
const nodesNav = [
  { name: 'nodes', label: 'Enrolled Nodes', icon: 'monitor' },
  { name: 'nodes-enroll', label: 'Enroll', icon: 'plus' },
]

// The add/edit saved-view dialog.
const dialogOpen = ref(false)
const editing = ref<IssueView | null>(null)

function openNewView() {
  editing.value = null
  dialogOpen.value = true
}
function openEditView(v: IssueView) {
  editing.value = v
  dialogOpen.value = true
}
function saveView(payload: { name: string; tags: string[]; match: 'any' | 'all' }) {
  if (editing.value) {
    views.update(editing.value.id, payload)
  } else {
    const created = views.add(payload)
    router.push({ name: 'issues-view', params: { viewId: created.id } })
  }
  dialogOpen.value = false
}
function deleteView(v: IssueView) {
  views.remove(v.id)
  if (router.currentRoute.value.params.viewId === v.id) router.push({ name: 'issues' })
}

// hostOf trims a URL down to its host for the compact connection rows.
function hostOf(u: string) {
  try {
    return new URL(u).host
  } catch {
    return u || ''
  }
}

// The connection-status rows pinned under Settings — one per upstream Venapce
// depends on. Colour: subtle = not configured, danger = login failing, success
// = live. FloMorphic has no login probe, so "registered" reads as live.
const statuses = computed(() => [
  {
    key: 'osctrl',
    label: `osctrl · ${hostOf(osctrl.url) || 'not configured'}`,
    title: osctrl.url,
    sub: osctrl.configured
      ? `${osctrl.environment || osctrl.username}${osctrl.managed ? ' · managed' : ''}`
      : 'not configured',
    color: !osctrl.configured ? 'bg-fg-subtle' : osctrl.connected === false ? 'bg-danger' : 'bg-success',
  },
  {
    key: 'flomorphic',
    label: `FloMorphic · ${hostOf(flo.infraBase) || 'not connected'}`,
    title: flo.infraBase,
    sub: flo.configured ? flo.pluginId || 'plugin registered' : 'not connected',
    color: !flo.configured ? 'bg-fg-subtle' : 'bg-success',
  },
])

onMounted(() => {
  views.load()
  if (!osctrl.loaded) osctrl.loadSettings()
  if (!flo.loaded) flo.loadSettings()
})
</script>

<template>
  <div class="flex h-full flex-col bg-bg">
    <!-- Global top bar — brand left, theme selector top-right -->
    <header class="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
      <RouterLink :to="{ name: 'dashboards' }" class="flex items-center gap-2.5">
        <span class="grid h-8 w-8 place-items-center rounded-md bg-accent font-bold text-accent-fg">V</span>
        <div class="leading-none">
          <span class="text-[15px] font-bold tracking-tight text-fg">Venapce Posture Presentation</span>
        </div>
      </RouterLink>

      <div class="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <!-- Sidebar — the main menu -->
      <aside class="flex w-56 shrink-0 flex-col border-r border-line bg-surface">
        <nav class="flex-1 overflow-y-auto px-2.5 py-3">
          <!-- Dashboards -->
          <p class="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Dashboards
          </p>
          <RouterLink
            v-for="item in dashboardNav"
            :key="item.name"
            :to="{ name: item.name }"
            class="nav-item"
            active-class="is-active"
          >
            <Icon :name="item.icon" :size="16" />
            {{ item.label }}
          </RouterLink>

          <!-- Nodes -->
          <p class="mt-4 px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Nodes
          </p>
          <RouterLink
            v-for="item in nodesNav"
            :key="item.name"
            :to="{ name: item.name }"
            class="nav-item"
            active-class="is-active"
          >
            <Icon :name="item.icon" :size="16" />
            {{ item.label }}
          </RouterLink>

          <!-- Pipeline: Stage → Issues -->
          <p class="mt-4 px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Issues
          </p>
          <RouterLink :to="{ name: 'stage' }" class="nav-item" active-class="is-active">
            <Icon name="inbox" :size="16" />
            Stage
          </RouterLink>
          <RouterLink :to="{ name: 'issues' }" class="nav-item" active-class="is-active">
            <Icon name="flag" :size="16" />
            Issues
          </RouterLink>

          <!-- Saved issue sub-views (tag filters) -->
          <div class="mt-0.5 space-y-0.5 pl-4">
            <div
              v-for="v in views.views"
              :key="v.id"
              class="group flex items-center rounded-lg pr-1 hover:bg-accent-soft"
            >
              <RouterLink
                :to="{ name: 'issues-view', params: { viewId: v.id } }"
                class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-fg-muted"
                active-class="text-accent"
              >
                <Icon name="hash" :size="13" class="text-fg-subtle" />
                <span class="truncate">{{ v.name }}</span>
              </RouterLink>
              <button
                class="icon-btn-plain hidden group-hover:inline-flex"
                title="Edit view"
                @click.prevent="openEditView(v)"
              >
                <Icon name="pencil" :size="13" />
              </button>
              <button
                class="icon-btn-plain icon-btn--danger hidden group-hover:inline-flex"
                title="Delete view"
                @click.prevent="deleteView(v)"
              >
                <Icon name="trash" :size="13" />
              </button>
            </div>
            <button
              class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-fg-subtle hover:bg-accent-soft hover:text-accent"
              @click="openNewView"
            >
              <Icon name="plus" :size="14" />
              Add view
            </button>
          </div>
        </nav>

        <!-- Settings, pinned to the bottom -->
        <div class="border-t border-line p-2.5">
          <RouterLink :to="{ name: 'settings' }" class="nav-item" active-class="is-active">
            <Icon name="settings" :size="16" />
            Settings
          </RouterLink>
          <RouterLink
            v-for="s in statuses"
            :key="s.key"
            :to="{ name: 'settings' }"
            class="mt-0.5 block rounded-md px-2.5 py-1 text-[11px] hover:bg-accent-soft"
            :title="`${s.title}\n${s.sub}`"
          >
            <div class="flex items-center gap-2">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="s.color"></span>
              <span class="truncate text-fg-muted">{{ s.label }}</span>
            </div>
          </RouterLink>
          <VersionBadge />
        </div>
      </aside>

      <!-- Content -->
      <main class="min-w-0 flex-1 overflow-auto">
        <RouterView />
      </main>
    </div>

    <IssueViewDialog :open="dialogOpen" :editing="editing" @save="saveView" @close="dialogOpen = false" />
  </div>
</template>

<style scoped>
.nav-item {
  @apply mb-0.5 flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-accent-soft hover:text-fg;
}
.is-active {
  background: var(--accent-soft);
  color: var(--accent);
}
</style>
