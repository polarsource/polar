import typing

{% for enum in ir.enums %}
{{ enum.name }}: typing.TypeAlias = typing.Literal[
{%- for value in enum.values %}
{{ "%r" | format(value.value) }}{% if not loop.last %}, {% endif %}
{% endfor -%}
]
{% if enum.description %}
"""{{ enum.description }}"""
{% endif %}
{% endfor %}
