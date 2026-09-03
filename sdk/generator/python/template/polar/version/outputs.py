from __future__ import annotations

import dataclasses
import typing

{% if output_uses_additional_properties %}
from polar.base import AdditionalPropertiesMixin
{% endif %}
{% if output_enum_imports %}
from polar.{{ version }}.literals import (
{% for enum_name in output_enum_imports %}
    {{ enum_name }},
{% endfor %}
)
{% endif %}

{% for model in api.output_models %}
{% if model.additional_properties and not model.fields %}
{{ model.name }}: typing.TypeAlias = dict[str, {{ model.additional_properties | type_annotation }}]
{% if model.description %}
"""{{ model.description }}"""
{% endif %}

{% else %}
@dataclasses.dataclass(kw_only=True, slots=True)
class {{ model.name }}{% if model.additional_properties %}(AdditionalPropertiesMixin){% endif %}:
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
{% if model.additional_properties %}
    additional_properties: dict[str, {{ model.additional_properties | type_annotation }}] = dataclasses.field(default_factory=dict)
{% endif %}
{% endif %}
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
