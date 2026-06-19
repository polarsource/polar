import types
import typing

from polar.base import AsyncClientBase, SyncClientBase

{% for service in ir.services %}
from polar.{{ service.name | snake }} import {{ service.name }}Async
from polar.{{ service.name | snake }} import {{ service.name }}Sync
{% endfor %}

class Polar:
    def __init__(self, base_url: str, version: str, access_token: str) -> None:
        self._client = SyncClientBase(base_url, version, access_token)
{% for service in ir.services %}
        self.{{ service.name | snake }} = {{ service.name }}Sync(self._client)
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
    def __init__(self, base_url: str, version: str, access_token: str) -> None:
        self._client = AsyncClientBase(base_url, version, access_token)
{% for service in ir.services %}
        self.{{ service.name | snake }} = {{ service.name }}Async(self._client)
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


__all__ = ["Polar", "PolarAsync"]
