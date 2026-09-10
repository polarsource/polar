// Generated from customers:list_payment_methods_external (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { production, data, mergeInput } from '../inputs'

type Query = NonNullable<
  Parameters<Polar['customers']['listPaymentMethodsExternal']>[1]
>

export const command = Command.make(
  'list_payment_methods_external',
  {
    production,
    external_id: Argument.string('external_id'),
    data,
    page: Flag.integer('page').pipe(
      Flag.optional,
      Flag.withDescription('Page number, defaults to 1.'),
    ),
    limit: Flag.integer('limit').pipe(
      Flag.optional,
      Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
    ),
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        page: config.page,
        limit: config.limit,
      })
      yield* api.execute({
        operationId: 'customers:list_payment_methods_external',
        method: 'GET',
        environment: config.production ? 'production' : 'sandbox',
        confirm: false,
        invoke: (client) =>
          client.customers.listPaymentMethodsExternal(
            config.external_id,
            query,
          ),
      })
    }),
).pipe(
  Command.withDescription(
    'Get saved payment methods of a customer by external ID.',
  ),
)
