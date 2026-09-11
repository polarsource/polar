// Generated from products:update_benefits (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Body = NonNullable<Parameters<Polar['products']['updateBenefits']>[1]>

export const command = Command.make(
  'update_benefits',
  {
    path: {
      id: Argument.string('id'),
    },
    data,
    input: {
      benefits: Flag.string('benefits')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'List of benefit IDs. Each one must be on the same organization as the product.',
          ),
        ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        benefits: config.input.benefits,
      })
      yield* api.execute({
        operationId: 'products:update_benefits',
        method: 'POST',
        confirm: false,
        invoke: (client) =>
          client.products.updateBenefits(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update benefits granted by a product.'))
