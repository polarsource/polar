import asyncio
import json
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID, uuid4

from temporalio.client import Client

from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import VoidEvent
from polar.postgres import AsyncSession
from polar.void.identity.service import identity as identity_service
from polar.void.reducer.service import reducer as reducer_service
from polar.void.tinybird import TinybirdApi

from .repository import EventRepository
from .schemas import Event, EventCreate, EventsList, EventSource, Pagination


class InvalidAttribution(PolarError):
    def __init__(self, external_id: str) -> None:
        super().__init__(
            f"Unknown billing identity {external_id!r}. Create it first with "
            "POST /v1/void/identities, or as a customer's root.",
            400,
        )


class ReservedEventName(PolarError):
    def __init__(self) -> None:
        super().__init__("This event name is reserved for system events.", 403)


class EventService:
    async def list(
        self,
        tinybird: TinybirdApi,
        organization_id: UUID,
        limit: int,
        external_identity_id: str | None = None,
        external_root_id: str | None = None,
        name: str | None = None,
    ) -> EventsList:
        params: dict[str, str | int] = {
            "organization_id": str(organization_id),
            "limit": limit,
        }
        for key, value in (
            ("external_identity_id", external_identity_id),
            ("external_root_id", external_root_id),
            ("name", name),
        ):
            if value is not None:
                params[key] = value
        result = await asyncio.to_thread(tinybird.query, "void_events_list", params)
        rows = result["data"]
        return EventsList(
            items=[
                Event.model_validate(
                    {
                        **row,
                        "timestamp": datetime.fromisoformat(row["timestamp"]).replace(
                            tzinfo=UTC
                        ),
                        "metadata": json.loads(row["metadata"]),
                    }
                )
                for row in rows
            ],
            pagination=Pagination(total_count=rows[0]["total_count"] if rows else 0),
        )

    async def attribute(
        self,
        session: AsyncSession,
        organization_id: UUID,
        events: Sequence[EventCreate],
    ) -> dict[str, str]:
        wanted = {e.external_identity_id for e in events if e.external_identity_id}
        roots = await identity_service.roots_of(
            session, organization_id, sorted(wanted)
        )
        missing = wanted - roots.keys()
        if missing:
            raise InvalidAttribution(min(missing))
        return roots

    async def ingest(
        self,
        session: AsyncSession,
        organization_id: UUID,
        events: Sequence[EventCreate],
        source: EventSource,
    ) -> tuple[int, int]:
        if source == EventSource.user and any(
            event.name == "identity.entitlements.updated" for event in events
        ):
            raise ReservedEventName()
        if not events:
            return 0, 0
        repository = EventRepository.from_session(session)
        keyed = {event.external_id: event for event in reversed(events)}
        existing = await repository.existing_external_ids(organization_id, list(keyed))
        fresh = [event for key, event in keyed.items() if key not in existing]
        roots = await self.attribute(session, organization_id, fresh)
        now = utc_now()
        records = []
        for event in fresh:
            event_id = uuid4()
            records.append(
                VoidEvent(
                    id=event_id,
                    organization_id=organization_id,
                    external_id=event.external_id,
                    timestamp=event.timestamp,
                    payload={
                        **event.model_dump(mode="json", exclude={"metadata"}),
                        "id": str(event_id),
                        "organization_id": str(organization_id),
                        "source": source.value,
                        "ingested_at": now.isoformat(),
                        "external_root_id": roots.get(event.external_identity_id)
                        if event.external_identity_id is not None
                        else None,
                        "metadata": json.dumps(event.metadata, allow_nan=False),
                    },
                )
            )
        saved = await repository.insert_events(records)
        return saved, len(events) - saved

    async def deliver_pending(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        temporal: Client,
        organization_ids: set[UUID],
        *,
        limit: int = 50,
    ) -> int:
        repository = EventRepository.from_session(session)
        pending = await repository.pending(organization_ids, limit=limit)
        if not pending:
            return 0
        await asyncio.to_thread(
            tinybird.ingest_batch, "void_events", [event.payload for event in pending]
        )
        timestamps: dict[UUID, list[datetime]] = defaultdict(list)
        for event in pending:
            timestamps[event.organization_id].append(event.timestamp)
        for organization_id, values in timestamps.items():
            await reducer_service.touch_buckets(temporal, organization_id, values)
        await repository.mark_delivered(pending, utc_now())
        return len(pending)


event = EventService()
