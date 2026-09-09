// Sample data for the Nodes / Issues / Stage views.
//
// These features are built front-first: the venapce-api endpoints they call
// (/api/osctrl/*, /api/issues, /api/stage) don't exist yet. Until the backend
// proxy is wired, the views fall back to this sample set and show a "sample data"
// banner, so the UI is fully reviewable now. Delete the fallbacks once the
// backend is live — nothing else depends on this module.

import type {
  Issue,
  OsctrlEnvironment,
  StageItem,
} from '@/api/types'

export const sampleEnvironments: OsctrlEnvironment[] = [
  { uuid: '0007038e-e791-4ae3-afd4-2e047d6639ed', name: 'saga-dev', hostname: 'localhost', type: 'osquery', icon: 'server' },
  { uuid: 'a19c2f40-1b2c-4c8e-9f2a-77c1d0f4b210', name: 'prod-edge', hostname: 'osctrl.venapce.io', type: 'osquery', icon: 'cloud' },
]

export const sampleIssues: Issue[] = [
  {
    id: 1001, title: 'Unexpected outbound connection to known-bad host', status: 'open', severity: 'critical',
    tags: ['untrusted', 'network', 'prod-edge'], source: 'web-01.prod',
    summary: 'osquery detected a process contacting an IP on the threat feed.',
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
  {
    id: 1002, title: 'New kernel module loaded outside baseline', status: 'proceed', severity: 'high',
    tags: ['untrusted', 'integrity'], source: 'db-01.prod',
    summary: 'A kernel module not present in the golden image was loaded.',
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
  },
  {
    id: 1003, title: 'Scheduled task created by admin', status: 'resolved', severity: 'low',
    tags: ['trusted', 'change'], source: 'ANALYST-WIN',
    summary: 'Change reviewed and matched an approved maintenance window.',
    createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
  },
  {
    id: 1004, title: 'Login from new geography', status: 'open', severity: 'medium',
    tags: ['untrusted', 'identity'], source: 'macbook-sec',
    summary: 'First successful login from a country not seen for this identity.',
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
  {
    id: 1005, title: 'Package manager invoked package install', status: 'proceed', severity: 'info',
    tags: ['trusted', 'change', 'prod-edge'], source: 'web-02.prod',
    summary: 'apt install traced to the deployment pipeline.',
    createdAt: new Date(Date.now() - 9 * 3600_000).toISOString(),
  },
]

export const sampleStage: StageItem[] = [
  {
    id: 'stg-9001', title: 'process_events burst on web-01', source: 'osctrl:web-01.prod', disposition: 'pending',
    tags: ['network'], summary: '312 process_events in 10s — awaiting flow evaluation.',
    receivedAt: new Date(Date.now() - 90_000).toISOString(),
  },
  {
    id: 'stg-9002', title: 'file_events under /etc on db-01', source: 'osctrl:db-01.prod', disposition: 'promoted',
    issueId: 1002, tags: ['integrity'], summary: 'Met the "baseline drift" criteria → promoted to issue #1002.',
    receivedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
  },
  {
    id: 'stg-9003', title: 'Heartbeat gap', source: 'osctrl:web-02.prod', disposition: 'dropped',
    tags: [], summary: 'Transient; recovered within threshold — dropped by flow.',
    receivedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
  },
  {
    id: 'stg-9004', title: 'Auth log spike', source: 'siem:auth', disposition: 'held',
    tags: ['identity'], summary: 'Held for correlation window before routing.',
    receivedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
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

