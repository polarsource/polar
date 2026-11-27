import { ClientBase, ClientOptions, resolveBaseUrl } from "../base";
import { PolarEventClient, type PolarEventOptions } from "../metering/client";
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
  extends Omit<ClientOptions, "baseUrl" | "version">, PolarEventOptions {
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
  const events = new PolarEventClient(client, options);

  const services = {
    {% for service in api.services %}
    {{ service.name | service_name }}: create{{ service.name }}Service(client),{% if not loop.last %}
    {% endif %}
    {% endfor %}
  };

  return {
    ...services,
    actor: events.actor.bind(events),
    track: events.track.bind(events),
    meter: events.meter.bind(events),
    flush: events.flush.bind(events),
    close: events.close.bind(events),
  };
}

export type Polar = ReturnType<typeof createPolar>;
