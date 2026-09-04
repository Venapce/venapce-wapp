// Sample data for the Nodes / Issues / Stage views.
//
// These features are built front-first: the venapce-api endpoints they call
// (/api/osctrl/*, /api/issues, /api/stage) don't exist yet. Until the backend
// proxy is wired, the views fall back to this sample set and show a "sample data"
// banner, so the UI is fully reviewable now. Delete the fallbacks once the
// backend is live — nothing else depends on this module.

import type { Issue, OsctrlEnvironment, OsctrlNode, StageItem } from '@/api/types'

export const sampleEnvironments: OsctrlEnvironment[] = [
  { uuid: '0007038e-e791-4ae3-afd4-2e047d6639ed', name: 'saga-dev', hostname: 'localhost', type: 'osquery', icon: 'server' },
  { uuid: 'a19c2f40-1b2c-4c8e-9f2a-77c1d0f4b210', name: 'prod-edge', hostname: 'osctrl.venapce.io', type: 'osquery', icon: 'cloud' },
]

export const sampleNodes: OsctrlNode[] = [
  {
    id: 1, uuid: 'e2b1c9a4-01', hostname: 'web-01.prod', localname: 'web-01', ip_address: '10.0.4.21',
    platform: 'linux', platform_version: 'Ubuntu 22.04', osquery_version: '5.12.1',
    environment: 'prod-edge', last_seen: new Date(Date.now() - 42_000).toISOString(), cpu: '4 vCPU', memory: '8 GB',
  },
  {
    id: 2, uuid: 'e2b1c9a4-02', hostname: 'web-02.prod', localname: 'web-02', ip_address: '10.0.4.22',
    platform: 'linux', platform_version: 'Ubuntu 22.04', osquery_version: '5.12.1',
    environment: 'prod-edge', last_seen: new Date(Date.now() - 6 * 60_000).toISOString(), cpu: '4 vCPU', memory: '8 GB',
  },
  {
    id: 3, uuid: 'e2b1c9a4-03', hostname: 'db-01.prod', localname: 'db-01', ip_address: '10.0.5.10',
    platform: 'linux', platform_version: 'Debian 12', osquery_version: '5.11.0',
    environment: 'prod-edge', last_seen: new Date(Date.now() - 3 * 3600_000).toISOString(), cpu: '8 vCPU', memory: '32 GB',
  },
  {
    id: 4, uuid: 'e2b1c9a4-04', hostname: 'ANALYST-WIN', localname: 'analyst', ip_address: '192.168.1.44',
    platform: 'windows', platform_version: 'Windows 11 Pro', osquery_version: '5.12.1',
    environment: 'saga-dev', last_seen: new Date(Date.now() - 20 * 3600_000).toISOString(), cpu: '8 vCPU', memory: '16 GB',
  },
  {
    id: 5, uuid: 'e2b1c9a4-05', hostname: 'macbook-sec', localname: 'sec-laptop', ip_address: '192.168.1.51',
    platform: 'darwin', platform_version: 'macOS 14.5', osquery_version: '5.12.1',
    environment: 'saga-dev', last_seen: new Date(Date.now() - 55_000).toISOString(), cpu: 'M3 Pro', memory: '18 GB',
  },
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

export const sampleEnroll = {
  secret: 'S3cr3t-ENROLL-key-do-not-share',
  flags: [
    '--enroll_secret_path=/etc/osquery/osquery.secret',
    '--tls_hostname=osctrl.venapce.io',
    '--host_identifier=uuid',
    '--enroll_tls_endpoint=/prod-edge/enroll',
    '--config_tls_endpoint=/prod-edge/config',
    '--logger_tls_endpoint=/prod-edge/log',
  ].join('\n'),
  oneLiner: {
    linux: 'curl -sk https://osctrl.venapce.io/prod-edge/enroll.sh | sudo bash',
    darwin: 'curl -sk https://osctrl.venapce.io/prod-edge/enroll.sh | sudo bash',
    windows: 'iwr -useb https://osctrl.venapce.io/prod-edge/enroll.ps1 | iex',
  },
}
