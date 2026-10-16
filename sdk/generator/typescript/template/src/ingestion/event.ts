{% for api in ir.versions %}
import type {
  EventCreateCustomer as EventCreateCustomer{{ api.version | replace('-', '_') }},
  EventCreateExternalCustomer as EventCreateExternalCustomer{{ api.version | replace('-', '_') }},
} from "../{{ api.version }}/models";
{% endfor %}

export type EventInput =
{% for api in ir.versions %}
  | EventCreateCustomer{{ api.version | replace('-', '_') }}
  | EventCreateExternalCustomer{{ api.version | replace('-', '_') }}{% if loop.last %};{% endif %}
{% endfor %}

