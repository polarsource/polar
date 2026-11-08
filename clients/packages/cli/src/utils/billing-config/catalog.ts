import type {
  ConfigExport,
  ExternalIdAssignment,
  KeyedResource,
} from '@/schemas/BillingConfig'
import { displayName, slugify, type Unkeyed } from '@/utils/billing-config/keys'
import { plural } from '@/utils/billing-config/problems'
import * as ui from '@/utils/ui'

export const SKIP_REASONS: Record<string, string> = {
  missing_external_id: 'has no external ID',
  invalid: 'cannot be expressed as config yet',
  over_limit: 'is over the config limit',
}

const SECTIONS = [
  ['meter', 'meters', 'Meters'],
  ['benefit', 'benefits', 'Benefits'],
  ['product', 'products', 'Products'],
] as const satisfies ReadonlyArray<readonly [KeyedResource, string, string]>

const ID_WIDTH = 32

interface Row {
  readonly external_id: string
  readonly name: string
  readonly added: boolean
  readonly renamed: boolean
}

const label = (entry: Record<string, unknown>) =>
  typeof entry['name'] === 'string'
    ? entry['name']
    : typeof entry['description'] === 'string'
      ? entry['description']
      : ''

const existing = (catalog: ConfigExport, section: string): Row[] => {
  const entries = catalog.config[section]
  return (Array.isArray(entries) ? entries : []).flatMap((entry) =>
    typeof entry === 'object' &&
    entry !== null &&
    'external_id' in entry &&
    typeof entry.external_id === 'string'
      ? [
          {
            external_id: entry.external_id,
            name: label(entry as Record<string, unknown>),
            added: false,
            renamed: false,
          },
        ]
      : [],
  )
}

export const renamed = (resource: Unkeyed, external_id: string) =>
  external_id === resource.suggestion &&
  resource.suggestion !== (slugify(resource.name) || resource.resource)

const added = (
  assignments: ReadonlyArray<ExternalIdAssignment>,
  resources: ReadonlyArray<Unkeyed>,
  resource: KeyedResource,
): Row[] =>
  assignments
    .filter((assignment) => assignment.resource === resource)
    .map((assignment) => {
      const source = resources.find(({ id }) => id === assignment.id)
      return {
        external_id: assignment.external_id,
        name:
          source === undefined
            ? ui.printable(assignment.name)
            : displayName(source),
        added: true,
        renamed:
          source !== undefined && renamed(source, assignment.external_id),
      }
    })

const rowLine = (row: Row, width: number) => {
  const id = ui.pad(ui.truncate(ui.printable(row.external_id), width), width)
  const marker = row.added ? ui.green('+') : ' '
  const name = ui.dim(row.added ? row.name : ui.printable(row.name))
  return row.renamed
    ? `${ui.INDENT}${marker} ${ui.yellow(id)}  ${name} ${ui.yellow('duplicate name, suffix added')}`
    : `${ui.INDENT}${marker} ${row.added ? id : ui.dim(id)}  ${name}`
}

const notInConfig = (catalog: ConfigExport) => {
  const skipped = catalog.skipped.filter(
    ({ reason }) => reason !== 'archived' && reason !== 'missing_external_id',
  )
  return skipped.length === 0
    ? []
    : [
        ui.blank,
        ui.heading('Not in the config'),
        ...skipped.map(
          ({ resource, name, id, reason }) =>
            `${ui.INDENT}  ${ui.printable(name)} ${ui.dim(`(${resource} ${id}) ${SKIP_REASONS[reason] ?? reason}`)}`,
        ),
      ]
}

export const catalogPreview = (
  catalog: ConfigExport,
  assignments: ReadonlyArray<ExternalIdAssignment>,
  resources: ReadonlyArray<Unkeyed>,
) => {
  const sections = SECTIONS.map(
    ([resource, section, title]) =>
      [
        resource,
        title,
        [
          ...existing(catalog, section),
          ...added(assignments, resources, resource),
        ],
      ] as const,
  )
  const width = Math.min(
    Math.max(
      ...sections.flatMap(([, , rows]) =>
        rows.map(({ external_id }) => Bun.stringWidth(external_id)),
      ),
      0,
    ),
    ID_WIDTH,
  )
  const counts = sections
    .map(([resource, , rows]) => plural(rows.length, resource))
    .join(', ')
  return [
    ui.blank,
    ui.heading('Your catalog'),
    ui.step(`${counts} · ${plural(assignments.length, 'new external ID')}`),
    ...sections.flatMap(([, title, rows]) =>
      rows.length === 0
        ? []
        : [
            ui.blank,
            ui.heading(title),
            ...rows.map((row) => rowLine(row, width)),
          ],
    ),
    ...notInConfig(catalog),
    ui.blank,
  ]
}

export const changes = (
  before: ReadonlyArray<ExternalIdAssignment>,
  after: ReadonlyArray<ExternalIdAssignment>,
) =>
  after.flatMap((assignment, index) => {
    const previous = before[index]!.external_id
    return previous === assignment.external_id
      ? []
      : [
          `${ui.INDENT}  ${ui.dim(ui.printable(previous))} ${ui.dim('→')} ${ui.printable(assignment.external_id)} ${ui.dim(`${assignment.resource} ${ui.printable(assignment.name)}`)}`,
        ]
  })
