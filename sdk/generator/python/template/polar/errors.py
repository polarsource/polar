from __future__ import annotations

import typing

from polar.base import PolarErrorResponse
{% if imports %}
from polar.outputs import (
{% for type in imports %}
    {{ type }} as {{ type }}Model,
{% endfor %}
)
{% endif %}


{% for error in errors %}
class {{ error.name }}(PolarErrorResponse):
    error_type = {{ error.type | type_annotation(ref_suffix="Model") }}
    error: {{ error.type | type_annotation(ref_suffix="Model") }}

    def __init__(self, status_code: int, error: {{ error.type | type_annotation(ref_suffix="Model") }}) -> None:
        self.error = error
        super().__init__(status_code, error)
{% endfor %}
