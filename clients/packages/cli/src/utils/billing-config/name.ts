import { Data, Effect } from 'effect'
import {
  BillingConfigError,
  type ExternalIdAssignment,
} from '@/schemas/BillingConfig'
import type { Unkeyed } from '@/utils/billing-config/keys'
import { plural } from '@/utils/billing-config/problems'
import type { Progress } from '@/utils/progress'
import { text } from '@/utils/prompt'
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

const ask = (
  resources: ReadonlyArray<Unkeyed>,
  given: ReadonlyMap<string, string>,
) =>
  Effect.gen(function* () {
    const chosen: ExternalIdAssignment[] = []
    for (const [index, resource] of resources.entries()) {
      const fixed = given.get(resource.id)
      if (fixed !== undefined) {
        chosen.push(assignment(resource, fixed))
        continue
      }
      const others = [
        ...chosen,
        ...resources
          .slice(index + 1)
          .map((other) =>
            assignment(other, given.get(other.id) ?? other.suggestion),
          ),
      ]
      const external_id = yield* text({
        message: `External ID for ${resource.resource} ${ui.bold(ui.printable(resource.name))}`,
        default: resource.suggestion,
        validate: (value) => {
          const key = value.trim()
          if (key === '') return Effect.fail('Enter an external ID')
          return clash(others, resource.resource, key)
            ? Effect.fail(`Another ${resource.resource} uses ${key}`)
            : Effect.succeed(key)
        },
      })
      chosen.push(assignment(resource, external_id))
    }
    return chosen
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
  (resources: ReadonlyArray<Unkeyed>) =>
    Effect.gen(function* () {
      yield* checkGiven(resources, given)
      if (resources.length === 0) {
        yield* progress.finish()
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
      let chosen = proposed
      if (!settled) {
        yield* say([
          ui.blank,
          ui.step(
            'Config matches meters, benefits and products by external ID. Confirm one for each, or type your own.',
          ),
          ui.blank,
        ])
        chosen = yield* ask(resources, given)
        yield* say([ui.blank])
      }
      yield* checkUnique(chosen)
      yield* progress.start('Saving external IDs')
      return chosen
    })
