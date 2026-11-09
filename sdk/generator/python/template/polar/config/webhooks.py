import collections.abc
import dataclasses

from polar.config.definitions import Definition, DefinitionSet
from polar.{{ latest }}.inputs import ConfigWebhookEndpoint
from polar.{{ latest }}.literals import WebhookEventType, WebhookFormat

API_VERSION = "{{ latest_api_version }}"


@dataclasses.dataclass(frozen=True, kw_only=True)
class Webhook(Definition):
    """A webhook endpoint for `events`, as raw JSON or formatted for Slack or Discord."""

    url: str = dataclasses.field(kw_only=False)
    events: collections.abc.Sequence[WebhookEventType]
    format: WebhookFormat = "raw"

    def __post_init__(self) -> None:
        if not self.events:
            raise ValueError("A webhook endpoint needs at least one event.")

    def describe(self) -> str:
        return repr(self.url)


class WebhookSet(DefinitionSet[Webhook]):
    item = Webhook


def webhook_config(definition: Webhook) -> ConfigWebhookEndpoint:
    return ConfigWebhookEndpoint(
        external_id=definition.id,
        url=definition.url,
        format=definition.format,
        events=list(definition.events),
        api_version=API_VERSION,
    )
