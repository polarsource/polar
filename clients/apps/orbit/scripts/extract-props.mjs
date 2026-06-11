// Extracts prop tables for Orbit components straight from the TypeScript
// source, so the docs never drift from the real types. For each component we
// resolve the props parameter of its call signature and enumerate the apparent
// properties, keeping only those authored in the Orbit package (plus, for thin
// wrappers, an opt-in set of third-party prop modules). Output is written to
// src/generated/props.json and consumed by <AutoProps />.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Project, TypeFormatFlags } from 'ts-morph'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ORBIT = resolve(__dirname, '../../../packages/orbit')
const OUT = resolve(__dirname, '../src/generated/props.json')

// slug -> which exported component to read, and any third-party prop modules to
// keep (matched against the declaration's file path) for thin wrappers.
const COMPONENTS = [
  { slug: 'box', file: 'components/Box.tsx', export: 'Box' },
  { slug: 'grid', file: 'components/Grid.tsx', export: 'Grid' },
  { slug: 'grid-item', file: 'components/GridItem.tsx', export: 'GridItem' },
  { slug: 'text', file: 'components/Text.tsx', export: 'Text' },
  { slug: 'button', file: 'components/Button.tsx', export: 'Button' },
  { slug: 'avatar', file: 'components/Avatar.tsx', export: 'Avatar' },
  { slug: 'pill', file: 'components/Pill.tsx', export: 'Pill' },
  { slug: 'status', file: 'components/Status.tsx', export: 'Status' },
  {
    slug: 'checkbox',
    file: 'components/Checkbox.tsx',
    export: 'Checkbox',
    includeFrom: ['react-checkbox'],
  },
  {
    slug: 'switch',
    file: 'components/Switch.tsx',
    export: 'Switch',
    includeFrom: ['react-switch'],
  },
  { slug: 'input', file: 'components/Input.tsx', export: 'Input' },
  { slug: 'textarea', file: 'components/TextArea.tsx', export: 'TextArea' },
  {
    slug: 'segmented-control',
    file: 'components/SegmentedControl.tsx',
    export: 'SegmentedControl',
  },
  { slug: 'spinner', file: 'components/Spinner.tsx', export: 'Spinner' },
  { slug: 'truncated', file: 'components/Truncated.tsx', export: 'Truncated' },
  { slug: 'list', file: 'components/List.tsx', export: 'List' },
  {
    slug: 'datatable',
    file: 'components/datatable/DataTable.tsx',
    export: 'DataTable',
  },
]

const IGNORED = new Set(['ref', 'key'])
const TYPE_FLAGS =
  TypeFormatFlags.NoTruncation |
  TypeFormatFlags.UseAliasDefinedOutsideCurrentScope

const project = new Project({
  tsConfigFilePath: resolve(ORBIT, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: false,
})

function repoSource(decl) {
  const path = decl.getSourceFile().getFilePath()
  if (path.includes('node_modules')) return null
  const idx = path.indexOf('clients/')
  if (idx === -1) return null
  return { path: path.slice(idx), line: decl.getStartLineNumber() }
}

function isFromOrbit(decl) {
  return decl.getSourceFile().getFilePath().includes('/packages/orbit/src/')
}

function jsdocOf(decl) {
  if (!decl.getJsDocs) return { description: undefined, default: undefined }
  const docs = decl.getJsDocs()
  let description = docs
    .map((d) => d.getDescription())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  let def
  for (const d of docs) {
    for (const tag of d.getTags()) {
      if (
        tag.getTagName() === 'default' ||
        tag.getTagName() === 'defaultValue'
      ) {
        def = (tag.getCommentText() ?? '').trim() || undefined
      }
    }
  }
  return { description: description || undefined, default: def }
}

function extract(cfg) {
  const sf = project.getSourceFileOrThrow(resolve(ORBIT, 'src', cfg.file))
  const decls = sf.getExportedDeclarations().get(cfg.export)
  if (!decls || decls.length === 0) {
    console.warn(`! ${cfg.slug}: export ${cfg.export} not found`)
    return []
  }
  const decl = decls[0]
  const signatures = decl.getType().getCallSignatures()
  if (signatures.length === 0) {
    console.warn(`! ${cfg.slug}: no call signature on ${cfg.export}`)
    return []
  }
  const params = signatures[0].getParameters()
  if (params.length === 0) return []
  const propsType = params[0].getTypeAtLocation(decl)

  const rows = []
  for (const sym of propsType.getApparentProperties()) {
    const name = sym.getName()
    if (IGNORED.has(name) || name.startsWith('__')) continue

    const valueDecl = sym.getDeclarations()[0]
    if (!valueDecl) continue

    const keep =
      isFromOrbit(valueDecl) ||
      (cfg.includeFrom ?? []).some((needle) =>
        valueDecl.getSourceFile().getFilePath().includes(needle),
      )
    if (!keep) continue

    const optional = (sym.getFlags() & 16777216) !== 0 // SymbolFlags.Optional
    let type = sym
      .getTypeAtLocation(decl)
      .getText(decl, TYPE_FLAGS)
      .replace(/\s+/g, ' ')
      .trim()
    if (optional) type = type.replace(/\s*\|\s*undefined$/, '')

    const { description, default: def } = jsdocOf(valueDecl)

    rows.push({
      name,
      type,
      required: !optional || undefined,
      default: def,
      description,
      source: repoSource(valueDecl),
    })
  }

  rows.sort((a, b) => {
    if (!!a.required !== !!b.required) return a.required ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return rows
}

const result = {}
for (const cfg of COMPONENTS) {
  const rows = extract(cfg)
  result[cfg.slug] = rows
  console.log(`${cfg.slug}: ${rows.length} props`)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
console.log(`\nWrote ${OUT}`)
