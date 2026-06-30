import { PolarClientError } from "./base";
{% if error_imports %}
import type { {% for name in error_imports %}{{ name }} as {{ name }}Model{% if not loop.last %}, {% endif %}{% endfor %} } from "./models/outputs";
{% endif %}
{% for error in errors %}
{% if error.response_type == 'json' %}
/**
 * {{ error.description or 'Error with status code ' + error.status_code }}
 */
export class {{ error.name }} extends PolarClientError<{{ error.type | ts_type(ref_suffix="Model") }}> {
  constructor(public readonly statusCode: {{ error.status_code }}, public readonly error: {{ error.type | ts_type(ref_suffix="Model") }}) {
    super(statusCode, error);
    this.name = "{{ error.name }}";
  }
}
{% elif error.response_type == 'text' %}
/**
 * {{ error.description or 'Error with status code ' + error.status_code }}
 */
export class {{ error.name }} extends PolarClientError<string> {
  constructor(public readonly statusCode: {{ error.status_code }}, public readonly error: string) {
    super(statusCode, error);
    this.name = "{{ error.name }}";
  }
}
{% elif error.response_type == 'none' %}
/**
 * {{ error.description or 'Error with status code ' + error.status_code }}
 */
export class {{ error.name }} extends PolarClientError<null> {
  constructor(public readonly statusCode: {{ error.status_code }}, public readonly error: null) {
    super(statusCode, error);
    this.name = "{{ error.name }}";
  }
}
{% endif %}
{% endfor %}
