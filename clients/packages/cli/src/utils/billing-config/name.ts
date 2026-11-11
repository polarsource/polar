import { Data, Effect } from 'effect'
import {
  BillingConfigError,
  type ConfigExport,
  type ExternalIdAssignment,
} from '@/schemas/BillingConfig'
import {
  catalogPreview,
  changes,
  renamed,
} from '@/utils/billing-config/catalog'
import {
  displayName,
  takenKeys,
  typedKey,
  type Unkeyed,
} from '@/utils/billing-config/keys'
import { plural } from '@/utils/billing-config/problems'
import { counts } from '@/utils/billing-config/review'
import type { Progress } from '@/utils/progress'
import { select } from '@/utils/prompt'
import { editTable } from '@/utils/table-prompt'
import * as ui from '@/utils/ui'

export class ExternalIdsRequired extends Data.TaggedError(
  'ExternalIdsRequired',
)<{ proposed: ReadonlyArray<ExternalIdAssignment> }> {}

export interface NameOptions {
  readonly prompt: boolean
  readonly confirm: boolean
  readonly given: ReadonlyMap<string, string>
}

export const parseExternalIds = (values: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const given = new Map<string, string>()
    for (const value of values) {
      const separator = value.indexOf('=')
      const id = value.slice(0, separator).trim()
      const key = value.slice(separator + 1).trim()
      if (separator === -1 || id === '' || key === '') {
        return yield* new BillingConfigError({
          message: `--external-id ${value} is not <id>=<external ID>`,
          hint: 'Run polar config init --json to list the IDs that need one.',
        })
      }
      given.set(id, key)
    }
    return given
  })

const assignment = (resource: Unkeyed, external_id: string) =>
  ({
    resource: resource.resource,
    id: resource.id,
    name: resource.name,
    external_id,
  }) satisfies ExternalIdAssignment

const clash = (
  assignments: ReadonlyArray<
    Pick<ExternalIdAssignment, 'resource' | 'external_id'>
  >,
  resource: Unkeyed['resource'],
  key: string,
) =>
  assignments.some(
    (other) => other.resource === resource && other.external_id === key,
  )

const problems =
  (
    editable: ReadonlyArray<Unkeyed>,
    fixed: ReadonlyArray<ExternalIdAssignment>,
    catalog: ConfigExport,
  ) =>
  (values: ReadonlyArray<string>) =>
    values.map((value, index) => {
      const key = value.trim()
      if (key === '') return 'enter an external ID'
      const { resource } = editable[index]!
      const others = [
        ...fixed,
        ...editable.flatMap((other, position) =>
          position === index
            ? []
            : [assignment(other, values[position]!.trim())],
        ),
      ]
      return clash(others, resource, key) ||
        takenKeys(catalog.config, resource).has(key)
        ? `another ${resource} uses ${key}`
        : undefined
    })

const edit = (
  editable: ReadonlyArray<Unkeyed>,
  chosen: ReadonlyArray<ExternalIdAssignment>,
  catalog: ConfigExport,
) =>
  Effect.gen(function* () {
    const ids = new Set(editable.map(({ id }) => id))
    const fixed = chosen.filter(({ id }) => !ids.has(id))
    const current = (resource: Unkeyed) =>
      chosen.find(({ id }) => id === resource.id)!.external_id
    const values = yield* editTable({
      message: 'Edit external IDs',
      headers: ['TYPE', 'NAME'],
      column: 'EXTERNAL ID',
      rows: editable.map((resource) => ({
        cells: [resource.resource, displayName(resource)],
        value: current(resource),
      })),
      validate: problems(editable, fixed, catalog),
      accept: typedKey,
    })
    return chosen.map((entry) => {
      const index = editable.findIndex(({ id }) => id === entry.id)
      return index === -1
        ? entry
        : { ...entry, external_id: values[index]!.trim() }
    })
  })

type Review = 'accept' | 'edit' | 'cancel'

const REVIEW_LABELS: Record<Review, string> = {
  accept: 'Use these external IDs',
  edit: 'Edit external IDs',
  cancel: 'Cancel',
}

const review = (
  resources: ReadonlyArray<Unkeyed>,
  proposed: ReadonlyArray<ExternalIdAssignment>,
  given: ReadonlyMap<string, string>,
  catalog: ConfigExport,
  say: (lines: ReadonlyArray<string>) => Effect.Effect<void>,
) =>
  Effect.gen(function* () {
    const editable = resources.filter(({ id }) => !given.has(id))
    const flagged = editable.filter((resource) =>
      renamed(resource, resource.suggestion),
    ).length
    yield* say([
      ...catalogPreview(catalog, proposed, resources),
      ui.step(
        'Config matches meters, benefits and products by external ID. Use the suggestions, or edit them in a table.',
      ),
      ...(flagged > 0
        ? [
            ui.warning(
              `${plural(flagged, 'suggestion')} ${flagged === 1 ? 'has' : 'have'} a numbered suffix because of a duplicate name. Double-check ${flagged === 1 ? 'it' : 'them'} before continuing.`,
            ),
          ]
        : []),
      ui.blank,
    ])
    let chosen = proposed
    while (true) {
      const choice = yield* select<Review>(
        {
          message: `${plural(editable.length, 'resource')} ${editable.length === 1 ? 'needs' : 'need'} an external ID`,
          choices: (['accept', 'edit', 'cancel'] as const).map((value) => ({
            value,
            title: REVIEW_LABELS[value],
          })),
        },
        (value) => REVIEW_LABELS[value],
      )
      if (choice === 'accept') return chosen
      if (choice === 'cancel') {
        return yield* new BillingConfigError({
          message: 'Cancelled: nothing was written',
          hint: 'Run polar config init again when you are ready.',
        })
      }
      chosen = yield* edit(editable, chosen, catalog)
      const changed = changes(proposed, chosen)
      yield* say(
        changed.length === 0
          ? [ui.step('Keeping the suggestions'), ui.blank]
          : [ui.blank, ui.heading('Your edits'), ...changed, ui.blank],
      )
    }
  })

const checkGiven = (
  resources: ReadonlyArray<Unkeyed>,
  given: ReadonlyMap<string, string>,
) => {
  const unknown = [...given.keys()].filter(
    (id) => !resources.some((resource) => resource.id === id),
  )
  return unknown.length === 0
    ? Effect.void
    : Effect.fail(
        new BillingConfigError({
          message: `No meter, benefit or product without an external ID has the ID ${unknown.join(', ')}`,
          hint: 'Run polar config init --json to list the IDs that need one.',
        }),
      )
}

const checkUnique = (assignments: ReadonlyArray<ExternalIdAssignment>) => {
  const duplicate = assignments.find((current, index) =>
    clash(assignments.slice(0, index), current.resource, current.external_id),
  )
  return duplicate === undefined
    ? Effect.void
    : Effect.fail(
        new BillingConfigError({
          message: `Two ${duplicate.resource}s would get the external ID ${duplicate.external_id}`,
          hint: 'Pass a different --external-id for one of them.',
        }),
      )
}

export const nameResources =
  (
    { prompt, confirm, given }: NameOptions,
    progress: Progress,
    say: (lines: ReadonlyArray<string>) => Effect.Effect<void>,
  ) =>
  (resources: ReadonlyArray<Unkeyed>, catalog: ConfigExport) =>
    Effect.gen(function* () {
      yield* checkGiven(resources, given)
      if (resources.length === 0) {
        yield* progress.finish(
          counts(catalog.config).join(', ') || 'nothing in it yet',
        )
        yield* progress.start('Writing config')
        return [] as ExternalIdAssignment[]
      }
      yield* progress.finish(
        `${plural(resources.length, 'resource')} without an external ID`,
      )
      const proposed = resources.map((resource) =>
        assignment(resource, given.get(resource.id) ?? resource.suggestion),
      )
      const settled = confirm || resources.every(({ id }) => given.has(id))
      if (!settled && !prompt) {
        return yield* new ExternalIdsRequired({ proposed })
      }
      const chosen = settled
        ? proposed
        : yield* review(resources, proposed, given, catalog, say)
      yield* checkUnique(chosen)
      yield* progress.start('Saving external IDs')
      return chosen
    })
