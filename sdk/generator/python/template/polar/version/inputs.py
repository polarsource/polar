from __future__ import annotations

import typing

{% if input_enum_imports %}
from polar.{{ version }}.literals import (
{% for enum_name in input_enum_imports %}
    {{ enum_name }},
{% endfor %}
)
{% endif %}

{% for model in api.input_models %}
{% if model.additional_properties %}
{{ model.name }}: typing.TypeAlias = dict[str, {{ model.additional_properties | type_annotation }}]
{% if model.description %}
"""{{ model.description }}"""
{% endif %}

{% else %}
class {{ model.name }}(typing.TypedDict):
{% if model.description %}
    """{{ model.description }}"""
{% endif %}
{% for field in model.fields %}
    {% if not field.required %}
    {{ field.name }}: typing.NotRequired[{{ field.type | type_annotation }}]
    {% else %}
    {{ field.name }}: {{ field.type | type_annotation }}
    {% endif %}
    {% if field.description %}
    """{{ field.description }}"""
    {% endif %}

{% else %}
    ...
{% endfor %}

{% endif %}
{% endfor %}

{% for union in api.input_unions %}
{% if union.variants %}
{{ union.name }}: typing.TypeAlias = (
{% for variant in union.variants %}
    {{ variant | type_annotation }}{% if not loop.last %} |{% endif %}
{% endfor %}
)
{% if union.description %}
"""{{ union.description }}"""
{% endif %}

{% endif %}
{% endfor %}
