from __future__ import annotations

import dataclasses
import typing

{% if enum_imports %}
from polar.{{ version }}.literals import (
{% for enum_name in enum_imports %}
    {{ enum_name }},
{% endfor %}
)
{% endif %}
{% if imports %}
from polar.{{ version }}.outputs import (
{% for name in imports %}
    {{ name }},
{% endfor %}
)
{% endif %}

{% for model in api.webhooks %}
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

{% if api.webhooks %}
WebhookPayload: typing.TypeAlias = (
{% for model in api.webhooks %}
    {{ model.name }}{% if not loop.last %} |{% endif %}
{% endfor %}
)
{% else %}
WebhookPayload: typing.TypeAlias = typing.Never
{% endif %}
