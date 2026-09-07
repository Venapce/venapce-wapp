// Tree → ECharts. Superset's Tree plugin takes a flat id/parent/name frame and
// nests it; so does this, plus the cycle and multi-root handling a real dataset
// needs (an adjacency list from a warehouse is rarely a clean single tree).

import type { ChartDataResult } from '@/api/types'
import { metricLabel, type BuilderState } from '@/lib/builder'
import { formatNumber } from '@/lib/numberFormat'
import { PALETTE, str, tooltipHeader, tooltipRow, type RenderModel } from './common'

interface TreeNode {
  name: string
  id: string
  value: number | null
  children: TreeNode[]
  collapsed?: boolean
}

const SYNTHETIC_ROOT = '(all)'

export function treeModel(s: BuilderState, result: ChartDataResult): RenderModel {
  const rows = result.data ?? []
  if (!rows.length) return { kind: 'empty' }

  const o = s.tree
  if (!o.idColumn || !o.parentColumn) return { kind: 'empty' }
  const valueKey = o.metric ? metricLabel(o.metric) : ''
  const nameKey = o.nameColumn || o.idColumn

  // 1. One node per id (later rows win, mirroring a last-write dimension table).
  const nodes = new Map<string, TreeNode>()
  const parentOf = new Map<string, string>()
  for (const r of rows) {
    const id = r[o.idColumn]
    if (id == null || id === '') continue
    const key = String(id)
    const raw = valueKey ? r[valueKey] : null
    const value = raw == null ? null : Number(raw)
    nodes.set(key, {
      id: key,
      name: str(r[nameKey]),
      value: Number.isFinite(value as number) ? (value as number) : null,
      children: [],
    })
    const parent = r[o.parentColumn]
    if (parent != null && parent !== '' && String(parent) !== key) parentOf.set(key, String(parent))
  }
  if (!nodes.size) return { kind: 'empty' }

  // 2. Link children to parents, skipping edges that would close a cycle.
  const roots: TreeNode[] = []
  let cycles = 0
  for (const [id, node] of nodes) {
    const parentId = parentOf.get(id)
    const parent = parentId != null ? nodes.get(parentId) : undefined
    if (!parent) {
      roots.push(node)
      continue
    }
    if (createsCycle(id, parentId as string, parentOf)) {
      // Drop this edge before moving on, so the opposite edge of a two-node
      // loop stays usable — one break is enough to open a cycle into a tree.
      parentOf.delete(id)
      cycles += 1
      roots.push(node)
      continue
    }
    parent.children.push(node)
  }

  // 3. Pick what to draw: an explicit root node, the single natural root, or a
  //    synthetic parent holding a forest.
  let root: TreeNode | undefined
  let note: string | undefined
  if (o.rootNode) {
    root = nodes.get(o.rootNode) ?? roots.find((n) => n.name === o.rootNode)
    if (!root) return { kind: 'empty', note: `No node with id "${o.rootNode}".` }
  } else if (roots.length === 1) {
    root = roots[0]
  } else if (roots.length > 1) {
    root = { id: SYNTHETIC_ROOT, name: SYNTHETIC_ROOT, value: null, children: roots }
    note = `${roots.length} root nodes — grouped under "${SYNTHETIC_ROOT}".`
  }
  if (!root) return { kind: 'empty', note: 'Every row points at a parent — the hierarchy has no root.' }
  if (cycles) {
    note = [note, `${cycles} cyclic parent link${cycles > 1 ? 's' : ''} detached.`].filter(Boolean).join(' ')
  }

  if (o.initialDepth > 0) collapseBelow(root, o.initialDepth)

  const radial = o.layout === 'radial'
  const option: Record<string, unknown> = {
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      confine: true,
      formatter: (p: unknown) => {
        const q = p as { data: TreeNode; color: string }
        const head = tooltipHeader(q.data.name)
        const rows2 = [
          q.data.id !== q.data.name ? tooltipRow(q.color, o.idColumn, q.data.id) : '',
          q.data.value != null && valueKey ? tooltipRow(q.color, valueKey, formatNumber(q.data.value)) : '',
          q.data.children.length ? tooltipRow(q.color, 'children', String(q.data.children.length)) : '',
        ].join('')
        return head + rows2
      },
    },
    series: [
      {
        type: 'tree',
        data: [root],
        layout: o.layout,
        orient: o.orient,
        symbol: o.symbol,
        symbolSize: o.symbolSize,
        edgeShape: radial ? 'curve' : o.edgeShape,
        roam: o.roam,
        expandAndCollapse: true,
        animationDuration: 400,
        animationDurationUpdate: 500,
        top: radial ? '8%' : 24,
        bottom: radial ? '8%' : 24,
        left: radial ? '8%' : 80,
        right: radial ? '8%' : 100,
        label: {
          position: radial ? 'right' : o.nodeLabelPosition,
          verticalAlign: 'middle',
          align: alignFor(o.nodeLabelPosition),
          fontSize: 11,
          rotate: radial ? undefined : 0,
        },
        leaves: {
          label: {
            position: radial ? 'right' : o.childLabelPosition,
            verticalAlign: 'middle',
            align: alignFor(o.childLabelPosition),
          },
        },
        lineStyle: { width: 1, curveness: 0.5, opacity: 0.6 },
        itemStyle: { borderWidth: 1.5 },
        emphasis: { focus: 'descendant' },
      },
    ],
  }

  return { kind: 'echarts', option, note }
}

/** ECharts wants the text anchored away from the node, opposite the label side. */
function alignFor(position: 'top' | 'right' | 'bottom' | 'left'): string {
  if (position === 'left') return 'right'
  if (position === 'right') return 'left'
  return 'center'
}

/** Would linking `id` under `parentId` close a loop? Walks up the parent chain. */
function createsCycle(id: string, parentId: string, parentOf: Map<string, string>): boolean {
  let cursor: string | undefined = parentId
  const seen = new Set<string>([id])
  while (cursor != null) {
    if (seen.has(cursor)) return true
    seen.add(cursor)
    cursor = parentOf.get(cursor)
  }
  return false
}

/** Start with `depth` levels open, the rest collapsed (ECharts' initialTreeDepth
 *  only counts from the root, and ignores nodes we mark ourselves). */
function collapseBelow(node: TreeNode, depth: number, level = 0): void {
  node.collapsed = level >= depth && node.children.length > 0
  for (const child of node.children) collapseBelow(child, depth, level + 1)
}
