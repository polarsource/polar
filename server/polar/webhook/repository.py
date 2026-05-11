from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, select
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

    async def get_all_undelivered(
        self, older_than: datetime | None = None, newer_than: datetime | None = None
    ) -> Sequence[WebhookEvent]:
        statement = (
            self.get_base_statement()
            .join(
                WebhookDelivery,
                WebhookDelivery.webhook_event_id == WebhookEvent.id,
                isouter=True,
            )
            .where(
                WebhookDelivery.id.is_(None),
                WebhookEvent.payload.is_not(None),
                WebhookEvent.skipped.is_(False),
            )
        )
        if older_than is not None:
            statement = statement.where(WebhookEvent.created_at < older_than)
        if newer_than is not None:
            statement = statement.where(WebhookEvent.created_at > newer_than)
        return await self.get_all(statement)

    async def get_recent_by_endpoint(
        self, endpoint_id: UUID, *, limit: int
    ) -> Sequence[WebhookEvent]:
        """
        Get recent completed events for an endpoint.

        Returns a list of WebhookEvent objects ordered by
        created_at descending (most recent first).

        Only includes events where succeeded is not NULL (completed events),
        excluding pending events that are still being retried.
        """
        statement = (
            self.get_base_statement()
            .where(
                WebhookEvent.webhook_endpoint_id == endpoint_id,
                WebhookEvent.succeeded.is_not(None),
            )
            .order_by(WebhookEvent.created_at.desc())
            .limit(limit)
        )
        return await self.get_all(statement)

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
            WebhookEvent.skipped.is_(False),
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
                WebhookEvent.is_deleted.is_(False),
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
            WebhookDelivery.is_deleted.is_(False),
        )
        res = await self.session.execute(statement)
        return res.scalar_one()

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
