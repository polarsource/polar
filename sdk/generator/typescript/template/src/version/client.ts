import { ClientBase, ClientOptions, resolveBaseUrl } from "../base";
import { createMetering, type MeteringOptions } from "../metering/client";
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
    /**
     * Create a helper for buffered event delivery and customer meter reads.
     *
     * @param options.buffered Batch and retry options; defaults to 100 events, a 1000-ms
     * collection interval, a 5000-ms shutdown timeout, and 3 attempts.
     * @param options.outpost true or Outpost options to enable Outpost. Disabled by default.
     * Pass false to disable; explicit options require a Redis URL.
     * @param options.strategies Replace all defaults with custom strategies. Cannot be
     * combined with buffered or outpost.
     * @returns An metering helper to start before use.
     */
    metering: (options?: MeteringOptions) => createMetering(services, client, options),
  };
}

export type Polar = ReturnType<typeof createPolar>;
