import typing

{% if open_enum_names %}
from polar.base import _OPEN_ENUM

{% endif %}
{% for enum in api.enums %}
{% set open_enum = enum.name in open_enum_names %}
{{ enum.name }}: typing.TypeAlias = {% if open_enum %}typing.Annotated[{% endif %}typing.Literal[
{%- for value in enum.values %}
{{ "%r" | format(value.value) }}{% if not loop.last %}, {% endif %}
{% endfor -%}
]{% if open_enum %}, _OPEN_ENUM]{% endif +%}
{% if enum.description %}
"""{{ enum.description }}"""
{% endif %}
{% endfor %}
