{% for enum in enums %}/**
 * {{ enum.description or enum.name }}
 */
export type {{ enum.name }} = {% for value in enum.values %}{% if value.value is string %}"{{ value.value }}"{% elif value.value is boolean %}{{ value.value | lower }}{% else %}{{ value.value }}{% endif %}{% if not loop.last %} | {% endif %}{% endfor %};
{% endfor %}

{% for model in models %}/**
 * {{ model.description or model.name }}
 */
{% if model.fields %}export interface {{ model.name }} {
  {% for field in model.fields %}  /**
   * {{ field.description or field.name }}
   */
  {{ field.name }}{% if not field.required %}?{% endif %}: {{ field.type | ts_type }};
  {% endfor %}{% if model.additional_properties %}  [key: string]: {{ model | ts_additional_properties_type }};
  {% endif %}}
{% elif model.additional_properties %}export type {{ model.name }} = Record<string, {{ model.additional_properties | ts_type }}>;
{% else %}export interface {{ model.name }} extends Record<string, never> {}
{% endif %}

{% endfor %}

{% for union in unions %}/**
 * {{ union.description or union.name }}
 */
export type {{ union.name }} = {% if union.variants %}{% for variant in union.variants %}{{ variant | ts_type }}{% if not loop.last %} | {% endif %}{% endfor %}{% else %}unknown{% endif %};
{% endfor %}
