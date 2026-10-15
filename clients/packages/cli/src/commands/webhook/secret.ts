import { Effect, Option, Schema } from 'effect'
import { Argument, Command } from 'effect/cli'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { output } from '@/utils/command'
import { org } from '@/utils/flags'

const key = Argument.String('key').pipe(
  Argument.withDescription(
    'Key of the webhook endpoint in the webhooks section of your config',
  ),
)

const Secret = Schema.Struct({ key: Schema.String, secret: Schema.String })

export const secret = Command.make('secret', { key, org }).pipe(
  Command.withDescription(
    'Print the signing secret of a webhook endpoint from your config',
  ),
  Command.withExamples([
    {
      command: 'polar webhook secret app',
      description: 'Print the signing secret of the app endpoint',
    },
    {
      command:
        'polar webhook secret app | vercel env add APP_WEBHOOK_SECRET production',
      description: 'Store it as an environment variable without displaying it',
    },
  ]),
  output({
    result: Secret,
    run: ({ key, org }) =>
      Effect.gen(function* () {
        const organization = yield* (yield* Organizations).resolve(
          Option.getOrUndefined(org),
        )
        const signingSecret = yield* (yield* BillingConfig).webhookSecret(
          organization,
          key,
        )
        return { key, secret: signingSecret }
      }),
    render: ({ secret }: typeof Secret.Type) => [secret],
  }),
)
