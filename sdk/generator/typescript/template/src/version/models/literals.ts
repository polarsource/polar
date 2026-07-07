{% for enum in enums %}
/**
 * {{ enum.description or enum.name }}
 */
export type {{ enum.name }} = {% for value in enum.values %}{% if value.value is string %}"{{ value.value }}"{% elif value.value is boolean %}{{ value.value | lower }}{% else %}{{ value.value }}{% endif %}{% if not loop.last %} | {% endif %}{% endfor %};
{% endfor %}
