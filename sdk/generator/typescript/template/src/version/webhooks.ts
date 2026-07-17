import { Buffer } from "node:buffer";

import { validateWebhook } from "../webhooks";
{% if imports %}import type {
{% for name in imports %}  {{ name }},
{% endfor %}} from "./models";

{% endif %}export {
  PolarWebhookError,
  PolarWebhookUnknownTypeError,
  PolarWebhookVerificationError,
} from "../webhooks";

{% for model in api.webhooks %}/**
{{ (model.description or model.name) | format_description }}
 */
export interface {{ model.name }}{% if model.fields %} {
  {% for field in model.fields %}  /**
{{ (field.description or field.name) | format_description | indent(2, true) }}
   */
  {{ field.name }}{% if not field.required %}?{% endif %}: {{ field.type | ts_type }};
  {% endfor %}}{% else %} extends Record<string, never> {}{% endif %}

{% endfor %}export type WebhookPayload = {% if api.webhooks %}{% for model in api.webhooks %}{{ model.name }}{% if not loop.last %} | {% endif %}{% endfor %}{% else %}never{% endif %};

const knownEventTypes = new Set<string>([
{% for event_type in webhook_event_types %}  {{ event_type | format_default }},
{% endfor %}]);

/**
 * Verify a raw Polar webhook request and return its typed payload.
 */
export const validateEvent = (
  body: string | Buffer,
  headers: Record<string, string>,
  secret: string,
): WebhookPayload => {
  return validateWebhook<WebhookPayload>(body, headers, secret, knownEventTypes);
};
