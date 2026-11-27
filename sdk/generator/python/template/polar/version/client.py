import typing

from polar.base import OutpostOptions, PolarAsyncBase, PolarSyncBase, RequestTimeout, _DefaultEventQueue, resolve_base_url
from polar.metering.queue import EventQueue, OnAck, OnRejected

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
        event_queue: EventQueue | None | typing.Literal[_DefaultEventQueue.MEMORY] = _DefaultEventQueue.MEMORY,
        on_event_ack: OnAck | None = None,
        on_event_rejected: OnRejected | None = None,
        outpost: OutpostOptions | None = None,
    ) -> None:
        resolved_base_url = resolve_base_url(SERVERS, environment, base_url)
        super().__init__(
            resolved_base_url, access_token, timeout, organization_id,
            event_queue=event_queue, on_event_ack=on_event_ack,
            on_event_rejected=on_event_rejected, outpost=outpost,
        )
{% for service in api.services %}
        self.{{ service.name | service_name }} = {{ service.name }}Async(self._client)
{% endfor %}

__all__ = ["Environment", "Polar", "PolarAsync"]
