// Generated from customers:list_payment_methods (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<
  Parameters<Polar['customers']['listPaymentMethods']>[1]
>

export const command = Command.make(
  'list_payment_methods',
  {
    path: {
      id: Argument.String('id'),
    },
    data,
    input: {
      page: Flag.Int('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.Int('limit').pipe(
        Flag.optional,
        Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        page: config.input.page,
        limit: config.input.limit,
      })
      yield* api.execute({
        operationId: 'customers:list_payment_methods',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) =>
          client.customers.listPaymentMethods(config.path.id, query),
      })
    }),
).pipe(Command.withDescription('Get saved payment methods of a customer.'))
