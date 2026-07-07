{% if enum_imports %}import type { {% for name in enum_imports %}{{ name }}{% if not loop.last %}, {% endif %}{% endfor %} } from "./literals";
{% endif %}
{% for model in models %}
/**
 * {{ model.description or model.name }}
 */
export interface {{ model.name }}{% if model.fields %} {
  {% for field in model.fields %}
  /**
   * {{ field.description or field.name }}
   */
  {{ field.name }}{{ "?" if not field.required }}: {{ field.type | ts_type }};
  {% endfor %}
}{% else %} extends Record<string, never> {}{% endif %}

{% endfor %}

{% for union in unions %}
/**
 * {{ union.description or union.name }}
 */
export type {{ union.name }} = {% if union.variants %}{% for variant in union.variants %}{{ variant | ts_type }}{% if not loop.last %} | {% endif %}{% endfor %}{% else %}unknown{% endif %};

{% endfor %}
