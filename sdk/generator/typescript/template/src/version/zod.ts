import * as z from "zod/v4-mini";
import type * as models from "./models";
import type * as webhooks from "./webhooks";

type Schema<T> = z.ZodMiniType<T>;
type ObjectSchema<T> = Schema<T> & z.core.$ZodTypeDiscriminable;

{% for enum in enums %}export const {{ enum.name }}: Schema<models.{{ enum.name }}> = {{ converter.convert_enum(enum) }};
{% endfor %}
{% for model in models %}export const {{ model.name }}: {% if converter.is_discriminable_model(model) %}ObjectSchema{% else %}Schema{% endif %}<models.{{ model.name }}> = {{ converter.convert_model(model) }};
{% endfor %}
{% for union in unions %}export const {{ union.name }}: {% if converter.is_discriminable_union(union) %}ObjectSchema{% else %}Schema{% endif %}<models.{{ union.name }}> = {{ converter.convert_named_union(union) }};
{% endfor %}
{% for model in api.webhooks %}export const {{ model.name }}: ObjectSchema<webhooks.{{ model.name }}> = {{ converter.convert_model(model) }};
{% endfor %}
export const WebhookPayload: Schema<webhooks.WebhookPayload> = {% if api.webhooks %}/* @__PURE__ */ z.discriminatedUnion("type", [{% for model in api.webhooks %}{{ model.name }}{% if not loop.last %}, {% endif %}{% endfor %}]){% else %}/* @__PURE__ */ z.never(){% endif %};
