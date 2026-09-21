// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createWebhookEndpointWebhooks } from './create_webhook_endpoint'
import { command as deleteWebhookEndpointWebhooks } from './delete_webhook_endpoint'
import { command as getWebhookEndpointWebhooks } from './get_webhook_endpoint'
import { command as listWebhookDeliveriesWebhooks } from './list_webhook_deliveries'
import { command as listWebhookEndpointsWebhooks } from './list_webhook_endpoints'
import { command as redeliverWebhookEventWebhooks } from './redeliver_webhook_event'
import { command as resetWebhookEndpointSecretWebhooks } from './reset_webhook_endpoint_secret'
import { command as updateWebhookEndpointWebhooks } from './update_webhook_endpoint'

export const command = Command.make('webhooks').pipe(
  Command.withSubcommands([
    createWebhookEndpointWebhooks,
    deleteWebhookEndpointWebhooks,
    getWebhookEndpointWebhooks,
    listWebhookDeliveriesWebhooks,
    listWebhookEndpointsWebhooks,
    redeliverWebhookEventWebhooks,
    resetWebhookEndpointSecretWebhooks,
    updateWebhookEndpointWebhooks,
  ]),
)
