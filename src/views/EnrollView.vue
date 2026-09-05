<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { useOsctrlStore } from '@/stores/osctrl'
import { apiErr } from '@/api/venapce'
import { sampleEnroll, sampleEnvironments } from '@/lib/samples'
import OsIcon from '@/components/OsIcon.vue'
import type {
  OsctrlEnrollValues,
  OsctrlEnvironment,
  OsctrlLinkAction,
  OsctrlLinkState,
  OsctrlLinkTarget,
} from '@/api/types'

// Enroll page. osctrl exposes two independent, parallel links per environment:
// an *enroll* (install) link and a *remove* link, each with its own secret path
// in the script URL and its own expiration — so they're presented as one toggle
// and managed side by side below.
const conn = useConnectionStore()
const osctrl = useOsctrlStore()

const environments = ref<OsctrlEnvironment[]>([])
const env = ref('')
const values = ref<OsctrlEnrollValues | null>(null)
const loading = ref(true)
const error = ref('')
const sample = ref(false)
const copied = ref('')

// Install vs Remove — the two link targets.
const mode = ref<OsctrlLinkTarget>('enroll')
const modes: Array<{ key: OsctrlLinkTarget; label: string }> = [
  { key: 'enroll', label: 'Install' },
  { key: 'remove', label: 'Remove' },
]

// Linux and macOS share the same shell script; only Windows differs.
const platforms: Array<{ key: string; label: string; icons: string[]; shell: string; script: string }> = [
  { key: 'linux', label: 'Linux / macOS', icons: ['linux', 'darwin'], shell: 'BASH', script: '.sh' },
  { key: 'windows', label: 'Windows', icons: ['windows'], shell: 'POWERSHELL', script: '.ps1' },
]
const platform = ref('linux')
const activePlatform = computed(() => platforms.find((p) => p.key === platform.value) ?? platforms[0])

const oneLiner = computed(() => {
  const src = mode.value === 'enroll' ? values.value?.oneLiner : values.value?.removeOneLiner
  return src?.[platform.value] || ''
})
// The shell scripts need root; Windows runs from an elevated PowerShell.
const needsSudo = computed(() => platform.value !== 'windows')

// ---- osquery flags: collapsed, copy is the primary action ----
const flagsOpen = ref(false)
const flagCount = computed(() => String(values.value?.flags ?? '').split('\n').filter(Boolean).length)
const packagesOpen = ref(false)

// ---- enroll / remove link management ----
// Real values on the environment, configurable through the API — so these are
// actions, not documentation.
const links: Array<{ key: OsctrlLinkTarget; label: string; hint: string }> = [
  { key: 'enroll', label: 'Enroll link', hint: 'Lets new systems install and join this environment.' },
  { key: 'remove', label: 'Remove link', hint: 'Lets an enrolled system de-register and uninstall itself.' },
]
const actions: Array<{ key: OsctrlLinkAction; label: string; danger?: boolean }> = [
  { key: 'rotate', label: 'Rotate secret' },
  { key: 'extend', label: 'Extend' },
  { key: 'notexpire', label: 'Never expire' },
  { key: 'expire', label: 'Expire now', danger: true },
]
// osctrl extends links by a fixed period (its DefaultLinkExpire, 24h) — there is
// no per-request duration, so extend just adds one day.
const EXTEND_MS = 86_400_000
const busy = ref('')
const actionError = ref('')
const actionNote = ref('')

function linkState(target: OsctrlLinkTarget): OsctrlLinkState {
  return (values.value?.[target] as OsctrlLinkState) ?? { enabled: false }
}

/** "Never expires" / "Expires 26/09/2026 · in 21 days" / "Expired". */
function expiryLabel(s: OsctrlLinkState): string {
  if (!s.enabled) return 'Disabled — the link is rejected'
  if (!s.expires) return 'Never expires'
  const ms = new Date(s.expires).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const days = Math.ceil(ms / 86_400_000)
  return `Expires ${new Date(s.expires).toLocaleDateString()} · in ${days} day${days === 1 ? '' : 's'}`
}

async function copy(text: string, id: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = id
    setTimeout(() => (copied.value === id ? (copied.value = '') : null), 1500)
  } catch {
    /* clipboard blocked — no-op */
  }
}

/** Apply an action to the local sample state so the UI stays reviewable while
 *  the backend endpoint is still to be built. Mirrors the server semantics:
 *  rotating a link replaces its path secret, which rewrites its one-liners. */
function applyToSample(target: OsctrlLinkTarget, action: OsctrlLinkAction) {
  const v = values.value
  if (!v) return
  const s = { ...linkState(target) }
  const base = s.expires ? new Date(s.expires).getTime() : Date.now()
  if (action === 'rotate') {
    s.path = Array.from({ length: 26 }, () =>
      'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789'[Math.floor(Math.random() * 57)],
    ).join('')
    s.enabled = true
    const script = target === 'enroll' ? 'enroll' : 'remove'
    const key = target === 'enroll' ? 'oneLiner' : 'removeOneLiner'
    const host = v.hostname ?? ''
    const uuid = v.envUUID ?? ''
    v[key] = {
      linux: `curl -s https://${host}/${uuid}/${s.path}/${script}.sh | sh`,
      darwin: `curl -s https://${host}/${uuid}/${s.path}/${script}.sh | sh`,
      windows: `iwr -useb https://${host}/${uuid}/${s.path}/${script}.ps1 | iex`,
    }
  } else if (action === 'extend') {
    s.expires = new Date(Math.max(base, Date.now()) + EXTEND_MS).toISOString()
    s.enabled = true
  } else if (action === 'notexpire') {
    delete s.expires
    s.enabled = true
  } else if (action === 'expire') {
    s.expires = new Date().toISOString()
    s.enabled = false
  }
  values.value = { ...v, [target]: s }
}

async function runAction(target: OsctrlLinkTarget, action: OsctrlLinkAction) {
  if (
    action === 'expire' &&
    !confirm(`Expire the ${target} link for "${env.value}" now? Its one-liner stops working immediately.`)
  )
    return
  busy.value = `${target}-${action}`
  actionError.value = ''
  actionNote.value = ''
  try {
    values.value = await conn.client.osctrlEnrollAction(env.value, target, action)
    sample.value = false
  } catch (e) {
    if (sample.value) {
      // Backend not wired yet — preview the change against the sample values.
      applyToSample(target, action)
      actionNote.value = 'Previewed on sample data — not sent to osctrl.'
    } else {
      actionError.value = apiErr(e)
    }
  } finally {
    busy.value = ''
  }
}

async function loadEnvironments() {
  try {
    environments.value = await conn.client.osctrlEnvironments()
  } catch {
    environments.value = sampleEnvironments
  }
  if (!env.value) env.value = osctrl.environment || environments.value[0]?.name || ''
}

async function loadEnroll() {
  if (!env.value) return
  loading.value = true
  error.value = ''
  try {
    values.value = await conn.client.osctrlEnroll(env.value)
    sample.value = false
  } catch {
    values.value = sampleEnroll
    sample.value = true
  } finally {
    loading.value = false
  }
}

watch(env, loadEnroll)

onMounted(async () => {
  if (!osctrl.loaded) await osctrl.loadSettings()
  await loadEnvironments()
  await loadEnroll()
})
</script>

<template>
  <div class="p-6">
    <div class="mb-1 flex items-center gap-3">
      <h1 class="text-lg font-semibold text-fg">Enroll</h1>
      <div class="ml-auto flex items-center gap-2">
        <label class="text-xs font-medium text-fg-muted">Environment</label>
        <select v-model="env" class="field max-w-[12rem]">
          <option v-for="e in environments" :key="e.uuid" :value="e.name">{{ e.name }}</option>
        </select>
      </div>
    </div>
    <p class="mb-4 text-sm text-fg-muted">
      Install osquery on a system and join it to <span class="font-medium text-fg">{{ env || 'osctrl' }}</span>, or remove one that already reports.
    </p>

    <div v-if="sample" class="mb-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
      Showing sample values — connect osctrl in
      <RouterLink :to="{ name: 'settings' }" class="underline">Settings</RouterLink>
      to fetch real enrollment values.
    </div>
    <p v-if="error" class="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
    <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>

    <div v-else-if="values" class="space-y-5">
      <!-- One-liner: Install / Remove, per platform -->
      <section class="card p-5">
        <!-- Install | Remove -->
        <div class="mb-4 grid grid-cols-2 gap-2">
          <button
            v-for="m in modes"
            :key="m.key"
            class="rounded-md border px-3 py-2 text-sm font-medium transition-colors"
            :class="mode === m.key
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'"
            @click="mode = m.key"
          >
            {{ m.label }}
          </button>
        </div>

        <!-- Platform tabs -->
        <div class="mb-4 flex gap-4 border-b border-line">
          <button
            v-for="p in platforms"
            :key="p.key"
            class="-mb-px flex items-center gap-1.5 border-b-2 px-1 pb-2 text-sm font-medium transition-colors"
            :class="platform === p.key
              ? 'border-accent text-fg'
              : 'border-transparent text-fg-subtle hover:text-fg-muted'"
            @click="platform = p.key"
          >
            <OsIcon v-for="i in p.icons" :key="i" :platform="i" :size="14" />
            {{ p.label }}
          </button>
        </div>

        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
            One-liner {{ mode === 'enroll' ? 'install' : 'remove' }} · {{ activePlatform.shell }}
          </span>
          <button v-if="oneLiner" class="btn-outline px-2.5 py-1 text-xs" @click="copy(oneLiner, 'ol')">
            {{ copied === 'ol' ? 'Copied ✓' : 'Copy' }}
          </button>
        </div>
        <pre class="overflow-x-auto rounded-md border border-line bg-surface-2 px-3 py-3 font-mono text-xs text-fg">{{ oneLiner || '— not available —' }}</pre>
        <p class="mt-2 text-xs text-fg-subtle">The script embeds this environment's enroll secret — handle accordingly.</p>

        <p
          v-if="!linkState(mode).enabled"
          class="mt-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          This {{ mode }} link is expired or disabled — the command above will be rejected. Rotate or extend it below.
        </p>
        <p v-else-if="needsSudo" class="mt-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          Runs as root. If the command returns nothing or “permission denied”, re-run it with
          <code class="rounded bg-surface px-1 font-mono">sudo</code> —
          <code class="rounded bg-surface px-1 font-mono">… | sudo sh</code>.
        </p>

        <!-- What the script does -->
        <ol class="mt-4 space-y-3 border-t border-line pt-4">
          <li v-for="(step, i) in (mode === 'enroll'
            ? ['Open a terminal on the target host with administrative rights.',
               'Paste and run the one-liner. It downloads osquery, writes the enroll secret and TLS flags, then starts osqueryd.',
               'Within a minute the host sends its first heartbeat and appears on the Nodes page as online.']
            : ['Open a terminal on the host that is currently enrolled.',
               'Paste and run the remove one-liner. It stops osqueryd, de-registers the node, and deletes the config and secret.',
               'The node stops reporting and drops off the Nodes page.'])"
            :key="i"
            class="flex gap-3"
          >
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{{ i + 1 }}</span>
            <p class="text-xs leading-relaxed text-fg-muted">{{ step }}</p>
          </li>
        </ol>
      </section>

      <!-- Enroll secret -->
      <section v-if="values.secret" class="card p-5">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="label mb-0">Enroll secret</h2>
          <button class="text-xs font-medium text-accent hover:underline" @click="copy(String(values.secret), 'secret')">
            {{ copied === 'secret' ? 'Copied ✓' : 'Copy' }}
          </button>
        </div>
        <pre class="overflow-x-auto rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg">{{ values.secret }}</pre>
        <p class="mt-2 text-xs text-fg-muted">Only needed for a manual install; the one-liner injects it for you. Treat it like a credential.</p>
      </section>

      <!-- osquery flags — collapsed by default, copy is the primary action -->
      <section v-if="values.flags" class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <h2 class="label mb-0">osquery flags</h2>
            <p class="text-xs text-fg-muted">
              {{ flagCount }} flags for <span class="font-medium text-fg">{{ env }}</span> — written to
              <code class="rounded bg-surface-2 px-1 font-mono">osquery.flags</code> by the installer.
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <button class="text-xs font-medium text-fg-muted hover:text-fg" @click="flagsOpen = !flagsOpen">
              {{ flagsOpen ? 'Hide' : 'Show' }}
            </button>
            <button class="btn-outline px-2.5 py-1 text-xs" @click="copy(String(values.flags), 'flags')">
              {{ copied === 'flags' ? 'Copied ✓' : 'Copy' }}
            </button>
          </div>
        </div>
        <pre
          v-if="flagsOpen"
          class="mt-3 overflow-x-auto rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg"
        >{{ values.flags }}</pre>
      </section>

      <!-- Enroll / remove link management: real values, edited through the API -->
      <section class="card p-5">
        <div class="mb-3">
          <h2 class="label mb-0">Lifecycle</h2>
          <p class="text-xs text-fg-muted">
            Each link has its own secret and expiry. Rotating one rewrites only that link's one-liner.
          </p>
        </div>

        <p v-if="actionError" class="mb-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{{ actionError }}</p>
        <p v-if="actionNote" class="mb-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">{{ actionNote }}</p>

        <div class="space-y-3">
          <div v-for="l in links" :key="l.key" class="rounded-md border border-line bg-surface-2 p-3">
            <div class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="h-2 w-2 shrink-0 rounded-full" :class="linkState(l.key).enabled ? 'bg-success' : 'bg-danger'" />
              <span class="text-sm font-medium text-fg">{{ l.label }}</span>
              <span class="text-xs text-fg-muted">· {{ expiryLabel(linkState(l.key)) }}</span>
            </div>
            <p class="mb-2 text-xs text-fg-muted">{{ l.hint }}</p>
            <p v-if="linkState(l.key).path" class="mb-2 truncate font-mono text-[11px] text-fg-subtle">
              /{{ values.envUUID }}/<span class="text-fg-muted">{{ linkState(l.key).path }}</span>/
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="a in actions"
                :key="a.key"
                class="btn-outline px-2.5 py-1 text-xs"
                :class="a.danger ? 'hover:border-danger hover:text-danger' : ''"
                :disabled="busy !== ''"
                @click="runAction(l.key, a.key)"
              >
                {{ busy === `${l.key}-${a.key}` ? 'Working…' : a.label }}
              </button>
            </div>
          </div>
        </div>

        <p class="mt-3 text-xs text-fg-subtle">
          Rotating the enroll link only affects <em>new</em> installs — nodes already reporting hold a node key and keep working.
        </p>
      </section>

      <!-- Pre-built packages -->
      <section v-if="values.packages?.length" class="card">
        <button class="flex w-full items-center gap-2 p-4 text-left" @click="packagesOpen = !packagesOpen">
          <span class="text-fg-subtle transition-transform" :class="packagesOpen ? 'rotate-90' : ''">›</span>
          <span class="text-sm font-medium text-fg">Pre-built package URLs</span>
          <span class="font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
            · optional · DEB · RPM · PKG · MSI · per-architecture
          </span>
        </button>
        <div v-if="packagesOpen" class="border-t border-line px-4 py-3">
          <div
            v-for="pkg in values.packages"
            :key="pkg.url"
            class="flex items-center gap-3 border-b border-line py-2 last:border-0"
          >
            <span class="chip w-14 justify-center uppercase">{{ pkg.format }}</span>
            <span class="w-20 shrink-0 font-mono text-xs text-fg-muted">{{ pkg.arch || '—' }}</span>
            <span class="min-w-0 flex-1 truncate font-mono text-xs text-fg-subtle">{{ pkg.url }}</span>
            <button class="text-xs font-medium text-accent hover:underline" @click="copy(pkg.url, 'pkg-' + pkg.url)">
              {{ copied === 'pkg-' + pkg.url ? 'Copied ✓' : 'Copy' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
