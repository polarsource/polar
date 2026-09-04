from __future__ import annotations

import dataclasses
import typing

{% if output_uses_extra_items %}
import typing_extensions

from polar.base import _register_extra_items_typed_dict
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

{% elif model.additional_properties %}
class {{ model.name }}(
    typing_extensions.TypedDict,
    extra_items={{ model.additional_properties | type_annotation }},
):
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

{% endfor %}

{% else %}
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

{% for model in api.output_models %}
{% if model.additional_properties and model.fields %}
_register_extra_items_typed_dict(
    {{ model.name }},
    {{ model.additional_properties | type_annotation }},
)
{% endif %}
{% endfor %}
