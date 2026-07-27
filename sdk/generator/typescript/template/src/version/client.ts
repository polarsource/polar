import { ClientBase, ClientOptions, resolveBaseUrl } from "../base";
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
  version?: string;
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
    version: options.version ?? "{{ api.version }}",
  });
}

export type PolarCore = ReturnType<typeof createPolarCore>;

export function createPolar(options: PolarOptions) {
  const client = createPolarCore(options);

  return {
    {% for service in api.services %}
    {{ service.name | service_name }}: create{{ service.name }}Service(client),{% if not loop.last %}
    {% endif %}
    {% endfor %}
  };
}

export type Polar = ReturnType<typeof createPolar>;
