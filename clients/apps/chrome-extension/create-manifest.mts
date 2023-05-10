import { readFileSync } from 'fs'

let forProduction = false
let forDevelopment = false

for (const arg of process.argv) {
  if (arg === '--production') {
    forProduction = true
  }
  if (arg === '--dev') {
    forDevelopment = true
  }
}

if (forProduction && forDevelopment) {
  console.error('--production and --dev can not be set at the same time')
  process.exit(1)
}

if (!forProduction && !forDevelopment) {
  console.error('either --production or --dev needs to be set')
  process.exit(1)
}

export interface Manifest {
  name: string
  version: string
  manifest_version: number
  icons: Icons
  permissions: string[]
  host_permissions: string[]
  content_scripts: ContentScript[]
  background: Background
}

export interface Icons {
  '16': string
  '32': string
  '48': string
  '128': string
}

export interface ContentScript {
  run_at?: string
  js: string[]
  matches: string[]
}

export interface Background {
  service_worker: string
}

const file: Manifest = JSON.parse(
  readFileSync('./src/manifest.json', 'utf-8'),
) as Manifest

if (forDevelopment) {
  file['host_permissions'].push('http://127.0.0.1:8000/*')

  file['content_scripts'].map((cs) => {
    if (cs['js'] && cs['js'].includes('auth.js')) {
      cs['matches'].push('http://127.0.0.1:3000/dashboard/settings/extension')
    }
    return cs
  })
}

console.log(JSON.stringify(file, null, 2))
