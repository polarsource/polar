from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, cast, or_, select, update
from sqlalchemy.dialects.postgresql import JSONB

from polar.kit.repository import RepositoryBase
from polar.models import VoidActivitySpan, VoidEvent


class ActivitySpanRepository(RepositoryBase[VoidActivitySpan]):
    model = VoidActivitySpan

    def scoped_statement(
        self, organization_id: UUID
    ) -> Select[tuple[VoidActivitySpan]]:
        return self.get_base_statement().where(
            VoidActivitySpan.organization_id == organization_id,
            VoidActivitySpan.deleted_at.is_(None),
        )

    async def get_span(
        self, organization_id: UUID, version_id: str, span_key: str
    ) -> VoidActivitySpan | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(
                VoidActivitySpan.version_id == version_id,
                VoidActivitySpan.span_key == span_key,
            )
        )

    async def get_spans(
        self, organization_id: UUID, version_id: str, span_keys: Sequence[str]
    ) -> Sequence[VoidActivitySpan]:
        return await self.get_all(
            self.scoped_statement(organization_id).where(
                VoidActivitySpan.version_id == version_id,
                VoidActivitySpan.span_key.in_(span_keys),
            )
        )

    async def list_spans(
        self,
        organization_id: UUID,
        version_id: str,
        *,
        identity: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> Sequence[VoidActivitySpan]:
        statement = self.scoped_statement(organization_id).where(
            VoidActivitySpan.version_id == version_id
        )
        if identity is not None:
            statement = statement.where(
                or_(
                    VoidActivitySpan.external_identity_id == identity,
                    VoidActivitySpan.external_root_id == identity,
                )
            )
        if start is not None:
            statement = statement.where(VoidActivitySpan.last_event_at >= start)
        if end is not None:
            statement = statement.where(VoidActivitySpan.last_event_at < end)
        return await self.get_all(
            statement.order_by(
                VoidActivitySpan.last_event_at.desc(), VoidActivitySpan.id.desc()
            )
        )

    async def list_due(
        self, now: datetime, *, limit: int
    ) -> Sequence[VoidActivitySpan]:
        return await self.get_all(
            self.get_base_statement()
            .where(
                VoidActivitySpan.deleted_at.is_(None),
                VoidActivitySpan.due_at.is_not(None),
                VoidActivitySpan.due_at <= now,
            )
            .order_by(VoidActivitySpan.due_at, VoidActivitySpan.id)
            .limit(limit)
        )

    async def clear_due(self, span: VoidActivitySpan, seen: datetime) -> None:
        """Clear the debounce unless a touch moved it while we were labeling."""
        await self.session.execute(
            update(VoidActivitySpan)
            .where(VoidActivitySpan.id == span.id, VoidActivitySpan.due_at == seen)
            .values(due_at=None)
        )
        await self.session.refresh(span, attribute_names=["due_at"])


class ActivityEventRepository(RepositoryBase[VoidEvent]):
    model = VoidEvent

    async def list_for_span(
        self,
        organization_id: UUID,
        event_name: str,
        group_by: str,
        span_key: str,
    ) -> Sequence[VoidEvent]:
        """The events of one span. The containment test and the external id
        are both indexed, so this stays a lookup as events accumulate."""
        metadata = cast(VoidEvent.payload["metadata"].as_string(), JSONB)
        return await self.get_all(
            select(VoidEvent)
            .where(
                VoidEvent.organization_id == organization_id,
                VoidEvent.payload["name"].as_string() == event_name,
                or_(
                    metadata.contains({group_by: span_key}),
                    VoidEvent.external_id == span_key,
                ),
            )
            .order_by(VoidEvent.timestamp, VoidEvent.id)
        )
