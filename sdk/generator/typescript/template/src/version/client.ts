import { ClientBase, ClientOptions } from "../base";
{% for service in api.services %}
import { create{{ service.name }}Service } from "./services/{{ service.name | snake }}";
{% endfor %}

export interface PolarOptions extends Omit<ClientOptions, "version"> {
  version?: string;
}

export function createPolar(options: PolarOptions) {
  const client = new ClientBase({
    ...options,
    version: options.version ?? "{{ api.version }}",
  });

  return {
    {% for service in api.services %}
    {{ service.name | camel }}: create{{ service.name }}Service(client),{% if not loop.last %}
    {% endif %}
    {% endfor %}
  };
}

export type Polar = ReturnType<typeof createPolar>;
