// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
{% for method in methods %}
import { command as {{ method.name | sdk_name(service.name) }} } from './{{ method.name }}'
{% endfor %}
{% for child in children %}
import { command as {{ child.name | service_name }} } from './{{ child.name | snake }}'
{% endfor %}

export const command = Command.make({{ service.name | snake | quote }}).pipe(
  Command.withSubcommands([
{% for method in methods %}
    {{ method.name | sdk_name(service.name) }},
{% endfor %}
{% for child in children %}
    {{ child.name | service_name }},
{% endfor %}
  ]),
)
