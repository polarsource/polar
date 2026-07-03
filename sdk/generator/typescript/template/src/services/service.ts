import { ClientBase } from "{{ base_import }}";
{% if imports.inputs %}
import type { {% for name in imports.inputs %}{{ name }}{% if not loop.last %}, {% endif %}{% endfor %}} from "{{ models_import }}/inputs";
{% endif %}
{% if imports.outputs %}
import type { {% for name in imports.outputs %}{{ name }}{% if not loop.last %}, {% endif %}{% endfor %}} from "{{ models_import }}/outputs";
{% endif %}
{% if imports.literals %}
import type { {% for name in imports.literals %}{{ name }}{% if not loop.last %}, {% endif %}{% endfor %}} from "{{ models_import }}/literals";
{% endif %}
{% if imports.errors %}
import { {% for name in imports.errors %}{{ name }}{% if not loop.last %}, {% endif %}{% endfor %}} from "{{ errors_import }}";
{% endif %}
{% for sub_service in service.services %}
import { create{{ sub_service.name }}Service } from "./{{ sub_service.name | snake }}";
{% endfor %}

{% for method in service.methods %}
export const {{ method.name | camel }}{{ service.name }} = (
  client: ClientBase,
) => {
/**
{% if method.description %}
{{ method.description | format_description }}
{% endif %}
*
{% for param in method.path_params %}
* @param {{ param.parameter_name }}{% if param.description %} - {{ param.description }}{% endif +%}
{% endfor %}
{% if method.query_params %}
* @param query - Query parameters
{% endif %}
{% if method.body %}
* @param body - Request body{% if method.body.description %}: {{ method.body.description }}{% endif +%}
{% endif %}
{% if method.response_type == 'json' %}
* @returns {{'{'}}{{ method.response | ts_type }}{{'}'}}
{% elif method.response_type == 'text' %}
* @returns {string}
{% else %}
* @returns {void}
{% endif %}
* @throws {{'{'}}PolarNetworkError{{'}'}} When a network error occurs
* @throws {{'{'}}PolarServerError{{'}'}} When the server returns a 5xx error
{% for error in method.errors %}
* @throws {{'{'}}{{ error.name }}{{'}'}} {{ error.description or 'Error with status code ' + error.status_code }}
{% endfor %}
*/
  return async (
    {% for param in method.path_params %}
    {{ param.parameter_name }}: {{ param.type | ts_type }},
    {% endfor %}
    {% if method.query_params %}
    query{{ "?" if not method.query_params | selectattr("required", "eq", true) | list else "" }}: {
      {% for param in method.query_params %}
      {{ param.name }}{% if not param.required %}?{% endif %}: {{ param.type | ts_type }};{% endfor %}
    }{% if method.body %},{% endif %}
    {% endif %}
    {% if method.body %}
    body: {{ method.body | ts_type }}
    {% endif %}
  ): Promise<{{ method.response | ts_type if method.response_type == 'json' else 'string' if method.response_type == 'text' else 'void' }}> => {
    const pathParams = {
      {% for param in method.path_params %}"{{ param.name }}": {{ param.parameter_name }},{% endfor %}
    };
    const queryParams = {% if method.query_params %}{
      {% for param in method.query_params %}"{{ param.name }}": query{{ "" if param.required else "?" }}.{{ param.name }}{% if param.default %} ?? {{ param.default | format_default }}{% endif %}{% if not loop.last %}, {% endif %}{% endfor %}
      }{% else %}{}{% endif %};
    const request = client.buildRequest(
      "{{ method.http_method | upper }}",
      "{{ method.path }}",
      pathParams,
      queryParams,
      {% if method.body %}body{% else %}undefined{% endif %}
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<{{ method.response | ts_type if method.response_type == 'json' else 'string' if method.response_type == 'text' else 'void' }}>(
      response,
      "{{ method.response_type }}",
      {
        {% for error in method.errors %}
        {{ error.status_code }}: {{ error.name }},
        {% endfor %}
      }
    );
  };
};
{% if method.pagination %}
/**
{% if method.description %}
{{ method.description | format_description }}
{% endif %}
*
{% for param in method.path_params %}
* @param {{ param.parameter_name }}{% if param.description %} - {{ param.description }}{% endif %}
{% endfor %}
{% if method.query_params %}
* @param query - Query parameters
{% endif %}
{% if method.body %}
* @param body - Request body{% if method.body.description %}: {{ method.body.description }}{% endif %}
{% endif %}
* @returns {AsyncGenerator<{{ method.pagination.item_schema | ts_type }}>} A generator that yields items of type {{ method.pagination.item_schema | ts_type }}.
* @throws {{'{'}}PolarNetworkError{{'}'}} When a network error occurs
* @throws {{'{'}}PolarServerError{{'}'}} When the server returns a 5xx error
{% for error in method.errors %}
* @throws {{'{'}}{{ error.name }}{{'}'}} {{ error.description or 'Error with status code ' + error.status_code }}
{% endfor %}
*/
export const iter{{ method.name | camel }}{{ service.name }} = (
  client: ClientBase,
) => {
  return async function* (
    {% for param in method.path_params %}
    {{ param.parameter_name }}: {{ param.type | ts_type }},
    {% endfor %}
    {% if method.query_params %}
    query?: {
      {% for param in method.query_params %}
      {{ param.name }}?: {{ param.type | ts_type }};
      {% endfor %}
    },
    {% endif %}
    {% if method.body %}
    body: {{ method.body | ts_type }},
    {% endif %}
  ): AsyncGenerator<{{ method.pagination.item_schema | ts_type }}> {
    let page: number;
    {% if method.query_params %}
    {% for param in method.query_params %}
    {% if param.name == 'page' %}
    page = query?.page ?? 1;
    {% endif %}
    {% endfor %}
    {% else %}
    page = 1;
    {% endif %}
    let limit: number | undefined;
    {% if method.query_params %}
    {% for param in method.query_params %}
    {% if param.name == 'limit' %}
    limit = query?.limit;
    {% endif %}
    {% endfor %}
    {% endif %}

    while (true) {
      const response = await {{ method.name | camel }}{{ service.name }}(client)(
        {% for param in method.path_params %}
        {{ param.parameter_name }},
        {% endfor %}
        {% if method.query_params %}
        { ...query, page, limit },
        {% else %}
        { page, limit },
        {% endif %}
        {% if method.body %}
        body
        {% endif %}
      );
      for (const item of response.items) {
        yield item;
      }
      if (page >= response.pagination.max_page) {
        break;
      }
      page++;
    }
  };
};
{% endif %}
{% endfor %}

export function create{{ service.name }}Service(client: ClientBase) {
  return {
    {% for method in service.methods %}
    {{ method.name | camel }}: {{ method.name | camel }}{{ service.name }}(client),{% endfor %}
    {% for method in service.methods %}
    {% if method.pagination %}
    iter{{ method.name | camel }}: iter{{ method.name | camel }}{{ service.name }}(client),{% endif %}
    {% endfor %}
    {% for sub_service in service.services %}
    {{ sub_service.name | camel }}: create{{ sub_service.name }}Service(client),{% endfor %}
  };
}

export type {{ service.name }} = ReturnType<typeof create{{ service.name }}Service >;
