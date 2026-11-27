import type {
  AppliedEntry,
  Catalog,
  CatalogPlan,
  LoadedConfig,
} from '@/schemas/BillingConfig'
import { formatTree } from '@/utils/billing-config/tree'
import * as ui from '@/utils/ui'

const key = ({ section, id }: AppliedEntry) => `${section}\0${id}`

const IN_DRAFT = {
  created: 'removed',
  updated: 'updated',
  removed: 'created',
} as const

export const draftConflicts = (
  againstLive: ReadonlyArray<AppliedEntry>,
  againstDraft: ReadonlyArray<AppliedEntry>,
): ReadonlyArray<AppliedEntry> => {
  const changedInFile = new Set(
    againstLive.filter((entry) => entry.action !== 'unchanged').map(key),
  )
  return againstDraft.flatMap((entry) =>
    entry.action === 'unchanged' || changedInFile.has(key(entry))
      ? []
      : [
          {
            section: entry.section,
            id: entry.id,
            action: IN_DRAFT[entry.action],
            diff: entry.diff.map(({ field, before, after }) => ({
              field,
              before: after,
              after: before,
            })),
          },
        ],
  )
}

export const catalogNameConflict = (
  catalog: CatalogPlan | undefined,
  draft: Catalog,
): ReadonlyArray<AppliedEntry> =>
  catalog !== undefined &&
  draft.name !== null &&
  catalog.name === catalog.before?.name &&
  catalog.name !== draft.name
    ? [
        {
          section: 'catalog',
          id: 'name',
          action: 'updated',
          diff: [{ field: 'name', before: catalog.name, after: draft.name }],
        },
      ]
    : []

export const conflictWarning = (
  config: LoadedConfig,
  conflicts: ReadonlyArray<AppliedEntry>,
) =>
  [
    `${ui.INDENT}The draft on Polar has changes your local ${config.file} doesn't have:`,
    '',
    formatTree(config.input, conflicts),
  ].join('\n')

export const conflictActions = (file: string) => [
  `Run ${ui.command('polar config reset')} to replace ${file} with the draft.`,
  `Run ${ui.command('polar config draft --force')} to replace the draft with ${file}.`,
]
