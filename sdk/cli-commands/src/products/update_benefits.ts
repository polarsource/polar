// Generated from products:update_benefits (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import { data, mergeInput, missingFlags } from '../inputs'

type Body = NonNullable<Parameters<Polar['products']['updateBenefits']>[1]>

export const command = Command.make(
  'update_benefits',
  {
    path: {
      id: Argument.String('id'),
    },
    data,
    input: {
      benefits: Flag.String('benefits')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'Required. List of benefit IDs. Each one must be on the same organization as the product.',
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
      const missing = missingFlags(body, ['benefits'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar products update_benefits <id> --benefits <benefits>',
        })
      }
      yield* api.execute({
        operationId: 'products:update_benefits',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) =>
          client.products.updateBenefits(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update benefits granted by a product.'))
