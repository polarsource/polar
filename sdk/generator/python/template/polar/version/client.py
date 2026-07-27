import types
import typing

from polar.base import AsyncClientBase, SyncClientBase, resolve_base_url

{% for service in api.services %}
from polar.{{ version }}.services.{{ service.name | service_name }} import {{ service.name }}Async
from polar.{{ version }}.services.{{ service.name | service_name }} import {{ service.name }}Sync
{% endfor %}

Environment = typing.Literal[{% for server in api.servers %}"{{ server.environment }}"{% if not loop.last %}, {% endif %}{% endfor %}]
SERVERS: typing.Final[dict[Environment, str]] = {
{% for server in api.servers %}
    "{{ server.environment }}": "{{ server.url }}",
{% endfor %}
}


class Polar:
    version: str = "{{ api.version }}"

    def __init__(
        self,
        access_token: str,
        *,
        environment: Environment = "production",
        base_url: str | None = None,
    ) -> None:
        resolved_base_url = resolve_base_url(SERVERS, environment, base_url)
        self._client = SyncClientBase(resolved_base_url, self.version, access_token)
{% for service in api.services %}
        self.{{ service.name | service_name }} = {{ service.name }}Sync(self._client)
{% endfor %}

    def __enter__(self) -> typing.Self:
        self._client.__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        self._client.__exit__(exc_type, exc_val, exc_tb)


class PolarAsync:
    version: str = "{{ api.version }}"

    def __init__(
        self,
        access_token: str,
        *,
        environment: Environment = "production",
        base_url: str | None = None,
    ) -> None:
        resolved_base_url = resolve_base_url(SERVERS, environment, base_url)
        self._client = AsyncClientBase(resolved_base_url, self.version, access_token)
{% for service in api.services %}
        self.{{ service.name | service_name }} = {{ service.name }}Async(self._client)
{% endfor %}

    async def __aenter__(self) -> typing.Self:
        await self._client.__aenter__()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        await self._client.__aexit__(exc_type, exc_val, exc_tb)


__all__ = ["Environment", "Polar", "PolarAsync"]
