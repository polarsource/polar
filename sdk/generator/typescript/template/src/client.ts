import { ClientBase, ClientOptions } from "./base";
{% for service in ir.services %}
import { create{{ service.name }}Service } from "./services/{{ service.name | snake }}";
{% endfor %}

export interface PolarOptions extends ClientOptions {}

export function createPolar(options: PolarOptions) {
  const client = new ClientBase(options);

  return {
    {% for service in ir.services %}
    {{ service.name | camel }}: create{{ service.name }}Service(client),{% if not loop.last %}
    {% endif %}
    {% endfor %}
  };
}

export type Polar = ReturnType<typeof createPolar>;
