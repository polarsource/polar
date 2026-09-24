from collections.abc import Sequence
from datetime import datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import CursorResult, Select, func, select, tuple_, update
from sqlalchemy.orm import contains_eager, joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import (
    WebhookDelivery,
    WebhookEndpoint,
    WebhookEvent,
)


class WebhookEventRepository(
    RepositorySoftDeletionIDMixin[WebhookEvent, UUID],
    RepositorySoftDeletionMixin[WebhookEvent],
    RepositoryBase[WebhookEvent],
):
    model = WebhookEvent

    async def count_undelivered(
        self, older_than: datetime | None = None, newer_than: datetime | None = None
    ) -> int:
        statement = (
            self.get_base_statement()
            .with_only_columns(func.count(WebhookEvent.id))
            .where(
                WebhookEvent.succeeded.is_(None),
                WebhookEvent.payload.is_not(None),
                ~WebhookEvent.skipped,
                ~select(WebhookDelivery.id)
                .where(WebhookDelivery.webhook_event_id == WebhookEvent.id)
                .exists(),
            )
        )
        if older_than is not None:
            statement = statement.where(WebhookEvent.created_at < older_than)
        if newer_than is not None:
            statement = statement.where(WebhookEvent.created_at > newer_than)
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def get_recent_outcomes_by_endpoint(
        self, endpoint_id: UUID, *, limit: int
    ) -> Sequence[bool | None]:
        statement = (
            self.get_base_statement()
            .with_only_columns(WebhookEvent.succeeded)
            .where(
                WebhookEvent.webhook_endpoint_id == endpoint_id,
                WebhookEvent.succeeded.is_not(None),
            )
            .order_by(WebhookEvent.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(statement)
        return result.scalars().all()

    async def get_pending_by_endpoint(
        self, endpoint_id: UUID
    ) -> Sequence[WebhookEvent]:
        """
        Get all pending events for an endpoint.

        Returns events where succeeded is NULL (still being retried).
        """
        statement = self.get_base_statement().where(
            WebhookEvent.webhook_endpoint_id == endpoint_id,
            WebhookEvent.succeeded.is_(None),
            ~WebhookEvent.skipped,
        )
        return await self.get_all(statement)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[WebhookEvent]]:
        return (
            self.get_base_statement()
            .join(
                WebhookEndpoint, WebhookEvent.webhook_endpoint_id == WebhookEndpoint.id
            )
            .options(contains_eager(WebhookEvent.webhook_endpoint))
            .where(WebhookEndpoint.organization_id.in_(org_ids))
        )

    async def count_earlier_pending(
        self, event: WebhookEvent, *, age_limit: datetime
    ) -> int:
        statement = (
            select(func.count(WebhookEvent.id))
            .join(
                WebhookDelivery,
                WebhookDelivery.webhook_event_id == WebhookEvent.id,
                isouter=True,
            )
            .where(
                ~WebhookEvent.is_deleted,
                WebhookEvent.webhook_endpoint_id == event.webhook_endpoint_id,
                WebhookEvent.id != event.id,
                WebhookDelivery.id.is_(None),
                WebhookEvent.created_at < event.created_at,
                WebhookEvent.created_at >= age_limit,
            )
        )
        res = await self.session.execute(statement)
        return res.scalar_one()

    def get_eager_options(self) -> Options:
        return (joinedload(WebhookEvent.webhook_endpoint),)


class WebhookDeliveryRepository(
    RepositorySoftDeletionIDMixin[WebhookDelivery, UUID],
    RepositorySoftDeletionMixin[WebhookDelivery],
    RepositoryBase[WebhookDelivery],
):
    model = WebhookDelivery

    async def get_all_by_event(self, event: UUID) -> Sequence[WebhookDelivery]:
        statement = (
            self.get_base_statement()
            .where(WebhookDelivery.webhook_event_id == event)
            .order_by(WebhookDelivery.created_at.asc())
        )
        return await self.get_all(statement)

    async def count_by_event(self, event_id: UUID) -> int:
        statement = select(func.count(WebhookDelivery.id)).where(
            WebhookDelivery.webhook_event_id == event_id,
            ~WebhookDelivery.is_deleted,
        )
        res = await self.session.execute(statement)
        return res.scalar_one()

    async def get_scrubbable_response_page(
        self,
        *,
        older_than: datetime,
        limit: int,
        after: tuple[datetime, UUID] | None = None,
    ) -> Sequence[tuple[UUID, datetime]]:
        statement = (
            select(WebhookDelivery.id, WebhookDelivery.created_at)
            .where(
                WebhookDelivery.created_at < older_than,
                WebhookDelivery.response.is_not(None),
            )
            .order_by(WebhookDelivery.created_at.asc(), WebhookDelivery.id.asc())
            .limit(limit)
        )
        if after is not None:
            statement = statement.where(
                tuple_(WebhookDelivery.created_at, WebhookDelivery.id) > after
            )
        result = await self.session.execute(statement)
        return [(id, created_at) for id, created_at in result.all()]

    async def count_scrubbable_responses(self, *, older_than: datetime) -> int:
        statement = select(func.count(WebhookDelivery.id)).where(
            WebhookDelivery.created_at < older_than,
            WebhookDelivery.response.is_not(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def scrub_responses(self, ids: Sequence[UUID]) -> int:
        statement = (
            update(WebhookDelivery)
            .where(WebhookDelivery.id.in_(ids))
            .values(response=None)
        )
        result = cast(CursorResult[Any], await self.session.execute(statement))
        return result.rowcount

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[WebhookDelivery]]:
        return (
            self.get_base_statement()
            .join(
                WebhookEndpoint,
                WebhookDelivery.webhook_endpoint_id == WebhookEndpoint.id,
            )
            .options(contains_eager(WebhookDelivery.webhook_endpoint))
            .where(WebhookEndpoint.organization_id.in_(org_ids))
        )


class WebhookEndpointRepository(
    RepositorySoftDeletionIDMixin[WebhookEndpoint, UUID],
    RepositorySoftDeletionMixin[WebhookEndpoint],
    RepositoryBase[WebhookEndpoint],
):
    model = WebhookEndpoint

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[WebhookEndpoint]]:
        return self.get_base_statement().where(
            WebhookEndpoint.organization_id.in_(org_ids)
        )

    async def has_by_organization_id(self, organization_id: UUID) -> bool:
        """Whether the organization has any active webhook endpoint."""
        statement = (
            self.get_base_statement()
            .with_only_columns(WebhookEndpoint.id)
            .where(WebhookEndpoint.organization_id == organization_id)
            .limit(1)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def get_accessible_ids(
        self,
        org_ids: set[AccessibleOrganizationID],
        endpoint_ids: Sequence[UUID],
    ) -> Sequence[UUID]:
        statement = (
            self.get_statement_by_org_ids(org_ids)
            .with_only_columns(WebhookEndpoint.id)
            .where(WebhookEndpoint.id.in_(endpoint_ids))
        )
        result = await self.session.execute(statement)
        return result.scalars().all()
