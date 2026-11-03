// Records which Orbit icons the clients workspace imports, and from where, so
// the icons page can show what is in use. Reads the icon exports from
// packages/orbit/src/icons and scans every tracked TypeScript file under
// clients/ for imports of them. Output is written to
// src/generated/icon-usage.json and consumed by the icons page.

import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLIENTS = resolve(__dirname, '../../..')
const ICONS = resolve(CLIENTS, 'packages/orbit/src/icons')
const OUT = resolve(__dirname, '../src/generated/icon-usage.json')

const icons = {}

const lucide = readFileSync(resolve(ICONS, 'lucide.ts'), 'utf8')
for (const [, name] of lucide.matchAll(/^\s+(\w+),$/gm)) {
  icons[name] = { source: 'lucide', original: name, files: [] }
}

const material = readFileSync(resolve(ICONS, 'material.ts'), 'utf8')
for (const [, name, original] of material.matchAll(
  /export \{ default as (\w+) \} from '@mui\/icons-material\/(\w+)'/g,
)) {
  icons[name] = { source: 'material', original, files: [] }
}

const files = execSync("git ls-files '*.ts' '*.tsx'", {
  cwd: CLIENTS,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter((file) => !file.startsWith('packages/orbit/src/icons/'))

const IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g

for (const file of files) {
  const source = readFileSync(resolve(CLIENTS, file), 'utf8')
  for (const [, specifiers, from] of source.matchAll(IMPORT)) {
    const isIcons =
      from === '@polar-sh/orbit/icons' ||
      (file.startsWith('packages/orbit/src/') &&
        resolve(CLIENTS, dirname(file), from) === ICONS)
    if (!isIcons) continue
    for (const specifier of specifiers.split(',')) {
      const name = specifier
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
      icons[name]?.files.push(file)
    }
  }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(icons, null, 2) + '\n')

const unused = Object.keys(icons).filter((name) => !icons[name].files.length)
console.log(
  `Wrote ${Object.keys(icons).length} icons to ${relative(CLIENTS, OUT)}` +
    (unused.length ? `, unused: ${unused.join(', ')}` : ''),
)
