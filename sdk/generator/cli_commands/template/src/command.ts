// Generated from {{ method.operation_id }} ({{ api.version }}). Do not edit.
{% if input_type %}
import type { Polar } from '@polar-sh/sdk/{{ api.version }}'
{% endif %}
import { Effect{% if confirmation_fields %}, Schema{% endif %} } from 'effect'
import { {% if method.path_params %}Argument, {% endif %}Command{% if fields or not method.requires_authentication %}, Flag{% endif %} } from 'effect/unstable/cli'
import { ApiRuntime{% if confirmation_fields or required %}, ApiCommandError{% endif %}{% if not method.requires_authentication or method.pending_response %}, executeRequest{% endif %} } from '{{ runtime_path }}runtime'
{% if helpers %}
import { {{ helpers | join(', ') }} } from '{{ runtime_path }}inputs'
{% endif %}
{% if input_type %}

type {{ input_type }} = NonNullable<Parameters<{{ sdk_type }}['{{ sdk_method }}']>[{{ input_index }}]>
{% endif %}

export const command = Command.make(
  {{ method.name | quote }},
  {
{% if not method.requires_authentication %}
    environment: Flag.Literals('environment', ['production', 'sandbox']).pipe(
      Flag.withDefault('production'),
      Flag.withDescription('Environment for this unauthenticated request'),
    ),
{% endif %}
{% if needs_confirmation %}
    confirm,
{% endif %}
{% if method.path_params %}
    path: {
{% for param in method.path_params %}
      {{ param.name }}: Argument.String({{ param.name | quote }}),
{% endfor %}
    },
{% endif %}
{% if input_type %}
    data,
{% endif %}
{% if fields %}
    input: {
{% for field in fields %}
    {{ field.name }}: {{ field.expression }}.pipe(
{% if field.name == 'organization_id' %}
      Flag.withAlias('org'),
{% endif %}
      Flag.optional,
      Flag.withDescription({{ field.description | quote }}),
    ),
{% endfor %}
    },
{% endif %}
  },
  ({% if method.path_params or input_type or needs_confirmation or not method.requires_authentication %}config{% endif %}) => Effect.gen(function* () {
    const api = yield* ApiRuntime
{% if input_type %}
    const {% if has_organization and input_type == 'Body' %}{ organization_id: organizationId, ...{{ input_type | lower }} }{% else %}{{ input_type | lower }}{% endif %} = mergeInput<{{ input_type }}>(config.data, {
{% for field in fields %}
      {{ field.name }}: config.input.{{ field.name }},
{% endfor %}
    })
{% endif %}
{% if required %}
    const missing = missingFlags({{ input_type | lower }}, {{ required | quote }})
    if (missing.length > 0) {
      return yield* new ApiCommandError({
        message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
        hint: {{ ('Example: ' + example) | quote }},
      })
    }
{% endif %}
{% if confirmation_fields %}
    const confirmationInput = yield* Schema.decodeUnknownEffect(
      Schema.Struct({
{% for field in confirmation_fields %}
        {{ field.key | quote }}: Schema.optionalKey({{ field.schema }}),
{% endfor %}
      }),
    )({{ input_type | lower }}).pipe(
      Effect.mapError((error) => new ApiCommandError({ message: error.message })),
    )
{% endif %}
    yield* api.execute({
      operationId: {{ method.operation_id | quote }},
      method: {{ method.http_method | quote }},
      requiresConfirmation: {{ confirmation_expression }},
      confirm: {% if needs_confirmation %}config.confirm{% else %}false{% endif %},
{% if not method.requires_authentication %}
      requiresAuthentication: false,
      environment: config.environment,
{% endif %}
{% if has_organization %}
{% if input_type == 'Body' %}
      organizationId,
{% else %}
      organizationId: {{ input_type | lower }}.organization_id,
{% endif %}
{% endif %}
{% if preview %}
      preview: {
        fields: [
{% for field in preview.fields %}
          { key: {{ field.key | quote }}, label: {{ field.label | quote }} },
{% endfor %}
        ],
        invoke: (client) => {{ preview.invoke }},
      },
{% endif %}
{% if not method.requires_authentication or method.pending_response %}
      invoke: (_client, core) => executeRequest(
        core,
        core.buildRequest(
          {{ method.http_method | quote }},
          {{ method.path | quote }},
{% if method.path_params %}
          { {% for param in method.path_params %}{{ param.name }}: config.path.{{ param.name }}{% if not loop.last %}, {% endif %}{% endfor %} },
{% else %}
          undefined,
{% endif %}
          {% if input_type == 'Query' %}{{ arguments[-1] }}{% else %}undefined{% endif %},
          {% if input_type == 'Body' %}{{ arguments[-1] }}{% else %}undefined{% endif %},
        ),
        {{ method.response_type | quote }},
        {
{% if not method.requires_authentication %}
          anonymous: true,
{% endif %}
{% if method.pending_response %}
          pendingResponse: {{ method.pending_response | quote }},
{% endif %}
        },
      ),
{% else %}
      invoke: (client) => client.{{ sdk_service }}.{{ sdk_method }}({{ arguments | join(', ') }}),
{% endif %}
    })
  }),
).pipe(Command.withDescription({{ description | quote }}))
