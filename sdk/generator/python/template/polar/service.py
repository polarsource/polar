from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase
{% if service.methods | selectattr("response_type", "equalto", "json") | list %}
from polar.base import parse_response_json
{% endif %}
{% if service.methods | selectattr("response_type", "equalto", "text") | list %}
from polar.base import parse_response_text
{% endif %}
{% if service.methods | selectattr("response_type", "equalto", "none") | list %}
from polar.base import parse_response_none
{% endif %}
{% if imports.enum %}
from polar.literals import (
{% for import_name in imports.enum | sort %}
    {{ import_name }},
{% endfor %}
)
{% endif %}
{% if imports.input %}
from polar.inputs import (
{% for import_name in imports.input | sort %}
    {{ import_name }},
{% endfor %}
)
{% endif %}
{% if imports.output %}
from polar.outputs import (
{% for import_name in imports.output | sort %}
    {{ import_name }},
{% endfor %}
)
{% endif %}
{% if imports.errors %}
from polar.errors import (
{% for import_name in imports.errors | sort %}
    {{ import_name }},
{% endfor %}
)
{% endif %}
{% for sub_service in service.services %}
from .{{ sub_service.name | snake }} import {{ sub_service.name }}Async
from .{{ sub_service.name | snake }} import {{ sub_service.name }}Sync
{% endfor %}


class {{ service.name }}Sync(SyncServiceBase):
{% for sub_service in service.services %}
    {{ sub_service.name | snake }}: {{ sub_service.name }}Sync
{% endfor %}
{% if service.services %}
    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
{% for sub_service in service.services %}
        self.{{ sub_service.name | snake }} = {{ sub_service.name}}Sync.from_service(self)
{% endfor %}
{% endif %}
{% for method in service.methods %}
{% if method.body and (method.body.kind == 'union' or method.body.kind == 'union_ref') %}
{% if method.body.kind == 'union' %}
{% for variant in method.body.variants %}
{% if variant.kind == 'model' %}
    @typing.overload
    def {{ method.name | snake }}(
        self,
        {% for param in method.path_params %}
        {{ param.name }}: {{ param.type | type_annotation }},
        {% endfor %}
        {% if method.query_params %}
        *,
        {% endif %}
        {% for param in method.query_params %}
        {% if param.default is not none %}
        {{ param.name }}: {{ param.type | type_annotation }} = {{ param.default | format_default }},
        {% elif param.required %}
        {{ param.name }}: {{ param.type | type_annotation }},
        {% else %}
        {{ param.name }}: {{ param.type | type_annotation }} = ...,
        {% endif %}
        {% endfor %}
        **kwargs: typing.Unpack[{{ variant.name }}],
    ) -> {{ method.response | type_annotation }}: ...

{% endif %}
{% endfor %}
{% else %}
{% for union_model in ir.input_unions if union_model.name == method.body.name %}
{% for variant in union_model.variants %}
{% if variant.kind == 'model' %}
    @typing.overload
    def {{ method.name | snake }}(
        self,
        {% for param in method.path_params %}
        {{ param.name }}: {{ param.type | type_annotation }},
        {% endfor %}
        {% if method.query_params %}
        *,
        {% endif %}
        {% for param in method.query_params %}
        {% if param.default is not none %}
        {{ param.name }}: {{ param.type | type_annotation }} = {{ param.default | format_default }},
        {% elif param.required %}
        {{ param.name }}: {{ param.type | type_annotation }},
        {% else %}
        {{ param.name }}: {{ param.type | type_annotation }} = ...,
        {% endif %}
        {% endfor %}
        **kwargs: typing.Unpack[{{ variant.name }}],
    ) -> {{ method.response | type_annotation }}: ...

{% endif %}
{% endfor %}
{% endfor %}
{% endif %}
{% endif %}
    def {{ method.name | snake }}(
        self,
        {% for param in method.path_params %}
        {{ param.parameter_name }}: {{ param.type | type_annotation }},
        {% endfor %}
        {% if method.query_params %}
        *,
        {% endif %}
        {% for param in method.query_params %}
        {% if param.default is not none %}
        {{ param.parameter_name }}: {{ param.type | type_annotation }} = {{ param.default | format_default }},
        {% elif param.required %}
        {{ param.parameter_name }}: {{ param.type | type_annotation }},
        {% else %}
        {{ param.parameter_name }}: {{ param.type | type_annotation }} = None,
        {% endif %}
        {% endfor %}
        {% if method.body and (method.body.kind == 'union' or method.body.kind == 'union_ref') %}
        **kwargs: typing.Any,
        {% elif method.body %}
        **kwargs: typing.Unpack[{{ method.body | type_annotation }}],
        {% endif %}
{% if method.response_type == 'json' %}
    ) -> {{ method.response | type_annotation }}:
{% elif method.response_type == 'text' %}
    ) -> str:
{% elif method.response_type == 'none' %}
    ) -> None:
{% endif %}
        """
{% if method.description %}
{{ method.description }}

{% endif %}
Args:
{% for param in method.path_params %}
    {{ param.parameter_name }}:{% if param.description %} {{ param.description }}{% endif %}

{% endfor %}
{% for param in method.query_params %}
    {{ param.parameter_name }}:{% if param.description %} {{ param.description }}{% endif %}

{% endfor %}
{% if method.body %}
    **kwargs: {% if method.body.description %}{{ method.body.description }}{% else %}Request body parameters{% endif %}

{% endif %}

Raises:
{% for error in method.errors %}
    {{ error.name }}: {{ error.description }}
{% endfor %}
    PolarNetworkError: Raised when a network error occurs while making the request.
    PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="{{ method.http_method | upper }}",
            url="{{ method.path }}",
            path_params={ {% for param in method.path_params %}"{{ param.name }}": {{ param.parameter_name }}, {% endfor %} },
            query_params={ {% for param in method.query_params %}"{{ param.name }}": {{ param.parameter_name }}, {% endfor %} },
            {% if method.body %}
            body=kwargs,
            {% endif %}
        )
        response = self.client.send_request(request)
        {% if method.errors %}
        method_errors = {
            {% for error in method.errors %}
            {{ error.status_code }}: {{ error.name }},
            {% endfor %}
        }
        {% endif %}
        {% if method.response_type == 'json' %}
        return parse_response_json(response, {{ method.response | type_annotation }}{% if method.errors %}, method_errors{% endif %})
        {% elif method.response_type == 'text' %}
        return parse_response_text(response{% if method.errors %}, method_errors{% endif %})
        {% elif method.response_type == 'none' %}
        return parse_response_none(response{% if method.errors %}, method_errors{% endif %})
        {% endif %}

{% endfor %}

class {{ service.name }}Async(AsyncServiceBase):
{% for sub_service in service.services %}
    {{ sub_service.name | snake }}: {{ sub_service.name }}Async
{% endfor %}
{% if service.services %}
    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
{% for sub_service in service.services %}
        self.{{ sub_service.name | snake }} = {{ sub_service.name}}Async.from_service(self)
{% endfor %}
{% endif %}
{% for method in service.methods %}
{% if method.body and (method.body.kind == 'union' or method.body.kind == 'union_ref') %}
{% if method.body.kind == 'union' %}
{% for variant in method.body.variants %}
{% if variant.kind == 'model' %}
    @typing.overload
    async def {{ method.name | snake }}(
        self,
        {% for param in method.path_params %}
        {{ param.name }}: {{ param.type | type_annotation }},
        {% endfor %}
        {% if method.query_params %}
        *,
        {% endif %}
        {% for param in method.query_params %}
        {% if param.default is not none %}
        {{ param.name }}: {{ param.type | type_annotation }} = {{ param.default | format_default }},
        {% elif param.required %}
        {{ param.name }}: {{ param.type | type_annotation }},
        {% else %}
        {{ param.name }}: {{ param.type | type_annotation }} = ...,
        {% endif %}
        {% endfor %}
        **kwargs: typing.Unpack[{{ variant.name }}],
    ) -> {{ method.response | type_annotation }}: ...

{% endif %}
{% endfor %}
{% else %}
{% for union_model in ir.input_unions if union_model.name == method.body.name %}
{% for variant in union_model.variants %}
{% if variant.kind == 'model' %}
    @typing.overload
    async def {{ method.name | snake }}(
        self,
        {% for param in method.path_params %}
        {{ param.name }}: {{ param.type | type_annotation }},
        {% endfor %}
        {% if method.query_params %}
        *,
        {% endif %}
        {% for param in method.query_params %}
        {% if param.default is not none %}
        {{ param.name }}: {{ param.type | type_annotation }} = {{ param.default | format_default }},
        {% elif param.required %}
        {{ param.name }}: {{ param.type | type_annotation }},
        {% else %}
        {{ param.name }}: {{ param.type | type_annotation }} = ...,
        {% endif %}
        {% endfor %}
        **kwargs: typing.Unpack[{{ variant.name }}],
    ) -> {{ method.response | type_annotation }}: ...

{% endif %}
{% endfor %}
{% endfor %}
{% endif %}
{% endif %}
    async def {{ method.name | snake }}(
        self,
        {% for param in method.path_params %}
        {{ param.parameter_name }}: {{ param.type | type_annotation }},
        {% endfor %}
        {% if method.query_params %}
        *,
        {% endif %}
        {% for param in method.query_params %}
        {% if param.default is not none %}
        {{ param.parameter_name }}: {{ param.type | type_annotation }} = {{ param.default | format_default }},
        {% elif param.required %}
        {{ param.parameter_name }}: {{ param.type | type_annotation }},
        {% else %}
        {{ param.parameter_name }}: {{ param.type | type_annotation }} = None,
        {% endif %}
        {% endfor %}
        {% if method.body and (method.body.kind == 'union' or method.body.kind == 'union_ref') %}
        **kwargs: typing.Any,
        {% elif method.body %}
        **kwargs: typing.Unpack[{{ method.body | type_annotation }}],
        {% endif %}
{% if method.response_type == 'json' %}
    ) -> {{ method.response | type_annotation }}:
{% elif method.response_type == 'text' %}
    ) -> str:
{% elif method.response_type == 'none' %}
    ) -> None:
{% endif %}
        """
{% if method.description %}
{{ method.description }}

{% endif %}
Args:
{% for param in method.path_params %}
    {{ param.parameter_name }}:{% if param.description %} {{ param.description }}{% endif %}

{% endfor %}
{% for param in method.query_params %}
    {{ param.parameter_name }}:{% if param.description %} {{ param.description }}{% endif %}

{% endfor %}
{% if method.body %}
    **kwargs: {% if method.body.description %}{{ method.body.description }}{% else %}Request body parameters{% endif %}

{% endif %}

Raises:
{% for error in method.errors %}
    {{ error.name }}: {{ error.description }}
{% endfor %}
    PolarNetworkError: Raised when a network error occurs while making the request.
    PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="{{ method.http_method | upper }}",
            url="{{ method.path }}",
            path_params={ {% for param in method.path_params %}"{{ param.name }}": {{ param.parameter_name }}, {% endfor %} },
            query_params={ {% for param in method.query_params %}"{{ param.name }}": {{ param.parameter_name }}, {% endfor %} },
            {% if method.body %}
            body=kwargs,
            {% endif %}
        )
        response = await self.client.send_request(request)
        {% if method.errors %}
        method_errors = {
            {% for error in method.errors %}
            {{ error.status_code }}: {{ error.name }},
            {% endfor %}
        }
        {% endif %}
        {% if method.response_type == 'json' %}
        return parse_response_json(response, {{ method.response | type_annotation }}{% if method.errors %}, method_errors{% endif %})
        {% elif method.response_type == 'text' %}
        return parse_response_text(response{% if method.errors %}, method_errors{% endif %})
        {% elif method.response_type == 'none' %}
        return parse_response_none(response{% if method.errors %}, method_errors{% endif %})
        {% endif %}

{% endfor %}
