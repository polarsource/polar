from __future__ import annotations

import dataclasses
import typing

{% if output_enum_imports %}
from polar.{{ version }}.literals import (
{% for enum_name in output_enum_imports %}
    {{ enum_name }},
{% endfor %}
)
{% endif %}

{% for model in api.output_models %}
@dataclasses.dataclass(kw_only=True, slots=True)
class {{ model.name }}:
{% if model.description %}
    """{{ model.description }}"""
{% endif %}
{% for field in model.fields %}
    {% if field.default is not none %}
    {{ field.name }}: {{ field.type | type_annotation }} = {{ field.default | format_default_dataclass }}
    {% elif not field.required %}
    {{ field.name }}: {{ field.type | wrap_nullable | type_annotation }} = None
    {% else %}
    {{ field.name }}: {{ field.type | type_annotation }}
    {% endif %}
{% if field.description %}
    """{{ field.description }}"""
{% endif %}

{% else %}
    ...
{% endfor %}
{% endfor %}

{% for union in api.output_unions %}
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
