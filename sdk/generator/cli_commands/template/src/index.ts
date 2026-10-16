// Generated CLI command registry. Do not edit.
{% for service in services %}
import { command as {{ service.name | service_name }} } from './{{ service.name | snake }}'
{% endfor %}

export {
{% for service in services %}
  {{ service.name | service_name }},
{% endfor %}
}
export const commands = [
{% for service in services %}
  {{ service.name | service_name }},
{% endfor %}
]
export { ApiRuntime, ApiCommandError, CURRENT_API_VERSION } from './runtime'
export type {
  ApiClients,
  ApiOperation,
  ApiPreview,
  ApiVersion,
  PreviewField,
  Environment,
} from './runtime'
