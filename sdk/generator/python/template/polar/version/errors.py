from __future__ import annotations

import typing

from polar.base import PolarClientError
{% if imports %}
from polar.{{ version }}.outputs import (
{% for type in imports %}
    {{ type }} as {{ type }}Model,
{% endfor %}
)
{% endif %}


{% for error in errors %}
class {{ error.name }}(PolarClientError):
{% if error.response_type == "json" %}
    error_type = {{ error.type | type_annotation(ref_suffix="Model") }}
    error: {{ error.type | type_annotation(ref_suffix="Model") }}
{% elif error.response_type == "text" %}
    error_type = str
    error: str
{% elif error.response_type == "none" %}
    error_type = None
    error: None
{% endif %}

    def __init__(self, status_code: int, error: {{ error.type | type_annotation(ref_suffix="Model") }}) -> None:
        self.error = error
        super().__init__(status_code, error)
{% endfor %}
