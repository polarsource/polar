import uuid
from datetime import timedelta

from polar.external_event.repository import ExternalEventRepository
from polar.kit.utils import utc_now

from .base import Invariant, InvariantError


class ExternalEventsUnhandledInvariantError(InvariantError):
    def __init__(self, count: int, external_events: list[uuid.UUID]) -> None:
        super().__init__(
            ExternalEventsUnhandledInvariant,
            f"Found {count} external events unhandled for more than 10 minutes after creation.",
            {
                "count": count,
                "external_events": {
                    "ids": external_events,
                    "has_more": count > len(external_events),
                },
            },
        )


class ExternalEventsUnhandledInvariant(Invariant):
    LEEWAY = timedelta(minutes=10)
    LIMIT = 10

    async def check(self) -> None:
        repository = ExternalEventRepository.from_session(self.session)
        external_events, count = await repository.get_unhandled_ids(
            utc_now() - self.LEEWAY, limit=self.LIMIT
        )
        if count > 0:
            raise ExternalEventsUnhandledInvariantError(count, external_events)
