import { ClientBase, ClientOptions, ClientScope, resolveBaseUrl } from "../base";
{% for service in api.services %}
import { create{{ service.name }}Service } from "./services/{{ service.name | snake }}";
{% endfor %}

export type Environment = {% for server in api.servers %}"{{ server.environment }}"{% if not loop.last %} | {% endif %}{% endfor %};

const SERVERS: Record<Environment, string> = {
  {% for server in api.servers %}
  "{{ server.environment }}": "{{ server.url }}",{% if not loop.last %}
  {% endif %}
  {% endfor %}
};

export interface PolarOptions
  extends Omit<ClientOptions, "baseUrl" | "version"> {
  environment?: Environment;
  baseUrl?: string;
}

export function createPolarCore(options: PolarOptions) {
  return new ClientBase({
    ...options,
    baseUrl: resolveBaseUrl(
      SERVERS,
      options.environment ?? "production",
      options.baseUrl,
    ),
    version: "{{ api.version }}",
  });
}

export type PolarCore = ReturnType<typeof createPolarCore>;

function createServices(client: PolarCore) {
  return {
    {% for service in api.services %}
    {{ service.name | service_name }}: create{{ service.name }}Service(client),{% if not loop.last %}
    {% endif %}
    {% endfor %}
  };
}

export type Polar = ReturnType<typeof createServices> & {
  scoped(scope: ClientScope): Polar;
};

function createPolarFromCore(client: PolarCore): Polar {
  return {
    ...createServices(client),
    scoped: (scope) => createPolarFromCore(client.scoped(scope)),
  };
}

export function createPolar(options: PolarOptions): Polar {
  return createPolarFromCore(createPolarCore(options));
}
