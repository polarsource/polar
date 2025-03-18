import contextlib
import uuid
from collections.abc import AsyncIterator
from typing import Any, cast

from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import ExternalEvent
from polar.models.external_event import ExternalEventSource, StripeEvent
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import ExternalEventRepository


class ExternalEventError(PolarError): ...


class ExternalEventDoesNotExist(ExternalEventError):
    def __init__(self, event_id: uuid.UUID) -> None:
        self.event_id = event_id
        message = f"External event {event_id} does not exist."
        super().__init__(message)


class ExternalEventAlreadyHandled(ExternalEventError):
    def __init__(self, event_id: uuid.UUID) -> None:
        self.event_id = event_id
        message = f"External event {event_id} has already been handled."
        super().__init__(message)


class ExternalEventService:
    async def enqueue(
        self,
        session: AsyncSession,
        source: ExternalEventSource,
        task_name: str,
        external_id: str,
        data: dict[str, Any],
    ) -> ExternalEvent:
        repository = ExternalEventRepository.from_session(session)
        event = await repository.create(
            ExternalEvent(
                source=source, task_name=task_name, external_id=external_id, data=data
            ),
            flush=True,
        )
        enqueue_job(task_name, event.id)
        return event

    async def resend(self, event: ExternalEvent) -> None:
        if event.is_handled:
            raise ExternalEventAlreadyHandled(event.id)
        enqueue_job(event.task_name, event.id)

    @contextlib.asynccontextmanager
    async def handle(
        self, session: AsyncSession, source: ExternalEventSource, event_id: uuid.UUID
    ) -> AsyncIterator[ExternalEvent]:
        repository = ExternalEventRepository.from_session(session)
        event = await repository.get_by_source_and_id(source, event_id)
        if event is None:
            raise ExternalEventDoesNotExist(event_id)
        if event.is_handled:
            raise ExternalEventAlreadyHandled(event_id)

        try:
            yield event
        except Exception:
            raise
        else:
            await repository.update(event, update_dict={"handled_at": utc_now()})

    @contextlib.asynccontextmanager
    async def handle_stripe(
        self, session: AsyncSession, event_id: uuid.UUID
    ) -> AsyncIterator[StripeEvent]:
        async with self.handle(session, ExternalEventSource.stripe, event_id) as event:
            yield cast(StripeEvent, event)


external_event = ExternalEventService()
