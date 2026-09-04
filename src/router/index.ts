import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/components/AppShell.vue'),
    children: [
      { path: '', redirect: { name: 'dashboards' } },
      { path: 'dashboards', name: 'dashboards', component: () => import('@/views/DashboardsView.vue') },
      // The dashboard hub now lives on the `dashboards` page: dashboards show as
      // badges on top and the active one is opened inline with live move/resize.
      // The old per-dashboard view/edit URLs redirect into it (?d=id, ?edit=1).
      {
        path: 'dashboards/:id(\\d+)',
        name: 'dashboard',
        redirect: (to) => ({ name: 'dashboards', query: { d: String(to.params.id) } }),
      },
      {
        path: 'dashboards/:id(\\d+)/edit',
        name: 'dashboard-edit',
        redirect: (to) => ({ name: 'dashboards', query: { d: String(to.params.id), edit: '1' } }),
      },
      { path: 'builder', name: 'builder', component: () => import('@/views/ChartBuilderView.vue') },
      { path: 'datasets', name: 'datasets', component: () => import('@/views/DatasetsView.vue') },

      // Nodes (osctrl): enrolled systems + enroll commands.
      { path: 'nodes', name: 'nodes', component: () => import('@/views/NodesView.vue') },
      { path: 'nodes/enroll', name: 'nodes-enroll', component: () => import('@/views/EnrollView.vue') },

      // Stage → Issues pipeline.
      { path: 'stage', name: 'stage', component: () => import('@/views/StageView.vue') },
      { path: 'issues', name: 'issues', component: () => import('@/views/IssuesView.vue') },
      {
        path: 'issues/view/:viewId',
        name: 'issues-view',
        component: () => import('@/views/IssuesView.vue'),
        props: true,
      },

      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'dashboards' } },
]

// Routes that need a configured Superset connection — until it's set up, these
// funnel to Settings. Nodes/Stage/Issues have their own data sources and don't.
const SUPERSET_ROUTES = new Set(['dashboards', 'dashboard', 'dashboard-edit', 'builder', 'datasets'])

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Ensure settings are loaded once; until Superset is configured, funnel to Settings.
router.beforeEach(async (to) => {
  const conn = useConnectionStore()
  if (!conn.loaded) await conn.loadSettings()
  if (!conn.configured && SUPERSET_ROUTES.has(to.name as string)) {
    return { name: 'settings', query: { setup: '1' } }
  }
  return true
})
