import typing

from polar.base import PolarAsyncBase, PolarSyncBase, RequestTimeout, resolve_base_url
from polar.metering import Metering, MeteringOutpostOptions, EventQueue
from polar.metering.queue import OnAck, OnRejected

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


class Polar(PolarSyncBase):
    version: str = "{{ api.version }}"

    def __init__(
        self,
        access_token: str,
        *,
        environment: Environment = "production",
        base_url: str | None = None,
        timeout: RequestTimeout | None = 5.0,
        organization_id: str | None = None,
    ) -> None:
        resolved_base_url = resolve_base_url(SERVERS, environment, base_url)
        super().__init__(resolved_base_url, access_token, timeout, organization_id)
{% for service in api.services %}
        self.{{ service.name | service_name }} = {{ service.name }}Sync(self._client)
{% endfor %}


class PolarAsync(PolarAsyncBase):
    version: str = "{{ api.version }}"

    def __init__(
        self,
        access_token: str,
        *,
        environment: Environment = "production",
        base_url: str | None = None,
        timeout: RequestTimeout | None = 5.0,
        organization_id: str | None = None,
    ) -> None:
        resolved_base_url = resolve_base_url(SERVERS, environment, base_url)
        super().__init__(resolved_base_url, access_token, timeout, organization_id)
{% for service in api.services %}
        self.{{ service.name | service_name }} = {{ service.name }}Async(self._client)
{% endfor %}

    def metering(
        self,
        *,
        queue: EventQueue | None = None,
        outpost: MeteringOutpostOptions | bool | None = None,
        on_ack: OnAck | None = None,
        on_rejected: OnRejected | None = None,
    ) -> Metering:
        """Create a metering helper for event delivery and customer meter reads.

        Args:
            queue: EventQueue used to queue and deliver events to Polar.
                Defaults to an in-memory MemoryEventQueue.
            outpost: Set to True to enable local reduction using REDIS_URL, or
                pass options to configure Outpost. Disabled by default.
            on_ack: Async callback for batches Polar accepts.
            on_rejected: Async callback for permanently rejected events and their reason.

        Returns:
            A Metering instance to use as an async context manager.
        """
        return Metering.create(
            self, queue=queue, outpost=outpost, on_ack=on_ack, on_rejected=on_rejected
        )

__all__ = ["Environment", "Polar", "PolarAsync"]
