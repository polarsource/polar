from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, cast, or_, select
from sqlalchemy.dialects.postgresql import JSONB

from polar.kit.repository import RepositoryBase
from polar.models import VoidActivity, VoidActivitySpan, VoidEvent


class ActivityRepository(RepositoryBase[VoidActivity]):
    model = VoidActivity

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidActivity]]:
        return self.get_base_statement().where(
            VoidActivity.organization_id == organization_id,
            VoidActivity.deleted_at.is_(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidActivity]:
        return await self.get_all(
            self.scoped_statement(organization_id).order_by(
                VoidActivity.slug, VoidActivity.id
            )
        )

    async def list_for_version(
        self, organization_id: UUID, version_id: str
    ) -> Sequence[VoidActivity]:
        return await self.get_all(
            self.scoped_statement(organization_id)
            .where(VoidActivity.version_id == version_id)
            .order_by(VoidActivity.slug, VoidActivity.id)
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidActivity | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidActivity.id == id)
        )


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


class ActivityEventRepository(RepositoryBase[VoidEvent]):
    model = VoidEvent

    async def list_for_span(
        self,
        organization_id: UUID,
        event_name: str,
        group_by: str,
        span_key: str,
    ) -> Sequence[VoidEvent]:
        metadata = cast(VoidEvent.payload["metadata"].as_string(), JSONB)
        return await self.get_all(
            select(VoidEvent)
            .where(
                VoidEvent.organization_id == organization_id,
                VoidEvent.payload["name"].as_string() == event_name,
                or_(
                    metadata[group_by].as_string() == span_key,
                    VoidEvent.external_id == span_key,
                ),
            )
            .order_by(VoidEvent.timestamp, VoidEvent.id)
        )
