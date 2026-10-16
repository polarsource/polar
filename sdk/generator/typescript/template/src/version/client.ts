import { ClientBase, ClientOptions, resolveBaseUrl } from "../base";
import { createIngestion, type IngestionOptions } from "../ingestion/client";
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

export function createPolar(options: PolarOptions) {
  const client = createPolarCore(options);

  const services = {
    {% for service in api.services %}
    {{ service.name | service_name }}: create{{ service.name }}Service(client),{% if not loop.last %}
    {% endif %}
    {% endfor %}
  };

  return {
    ...services,
    ingestion: (options?: IngestionOptions) => createIngestion(services, client, options),
  };
}

export type Polar = ReturnType<typeof createPolar>;
