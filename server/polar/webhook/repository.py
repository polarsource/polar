from collections.abc import Sequence
from datetime import datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    CursorResult,
    Select,
    Uuid,
    column,
    func,
    select,
    true,
    tuple_,
    update,
    values,
)
from sqlalchemy.orm import aliased, contains_eager, joinedload

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
from polar.models.webhook_endpoint import WebhookEventType


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
    ) -> Select[WebhookEvent]:
        return (
            self.get_base_statement()
            .join(
                WebhookEndpoint, WebhookEvent.webhook_endpoint_id == WebhookEndpoint.id
            )
            .options(contains_eager(WebhookEvent.webhook_endpoint))
            .where(
                WebhookEndpoint.organization_id.in_(org_ids),
                ~WebhookEndpoint.is_deleted,
            )
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
                ~WebhookEvent.skipped,
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
        result = cast(
            CursorResult[*tuple[Any, ...]], await self.session.execute(statement)
        )
        return result.rowcount

    async def paginate_by_endpoints(
        self,
        endpoint_ids: Sequence[UUID],
        clauses: Sequence[ColumnElement[bool]],
        *,
        event_types: Sequence[WebhookEventType] | None,
        limit: int,
        page: int,
    ) -> tuple[list[WebhookDelivery], int]:
        """
        Paginate the deliveries of the given endpoints, newest first.

        A plain `ORDER BY created_at DESC LIMIT n` over the joined endpoints makes
        the planner walk the global `created_at` index backwards until it finds
        n matching rows, which scans most of the table for endpoints with few
        or old deliveries. Instead, take the top `offset + limit` rows of each
        endpoint from its `(webhook_endpoint_id, created_at)` index in a
        LATERAL subquery, then sort that bounded set.
        """
        offset = (page - 1) * limit
        order = (WebhookDelivery.created_at.desc(), WebhookDelivery.id.desc())

        filtered = self.get_base_statement().where(*clauses)
        if event_types is not None:
            filtered = filtered.join(
                WebhookEvent, WebhookDelivery.webhook_event_id == WebhookEvent.id
            ).where(WebhookEvent.type.in_(event_types))

        count_statement = select(func.count()).select_from(
            filtered.where(WebhookDelivery.webhook_endpoint_id.in_(endpoint_ids))
            .with_only_columns(WebhookDelivery.id)
            .subquery()
        )
        count = (await self.session.execute(count_statement)).scalar_one()

        endpoints = values(column("id", Uuid), name="endpoints").data(
            [(endpoint_id,) for endpoint_id in endpoint_ids]
        )
        latest_per_endpoint = (
            filtered.where(WebhookDelivery.webhook_endpoint_id == endpoints.c.id)
            .order_by(*order)
            .limit(offset + limit)
            .lateral("latest_deliveries")
        )
        delivery = aliased(WebhookDelivery, latest_per_endpoint)
        statement = (
            select(delivery)
            .select_from(endpoints)
            .join(latest_per_endpoint, true())
            .options(joinedload(delivery.webhook_event))
            .order_by(delivery.created_at.desc(), delivery.id.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(statement)
        return list(result.unique().scalars().all()), count

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[WebhookDelivery]:
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
    ) -> Select[WebhookEndpoint]:
        return self.get_base_statement().where(
            WebhookEndpoint.organization_id.in_(org_ids)
        )

    async def get_all_by_external_ids(
        self,
        organization_id: UUID,
        external_ids: Sequence[str],
        *,
        for_update: bool = False,
    ) -> Sequence[WebhookEndpoint]:
        statement = self.get_base_statement().where(
            WebhookEndpoint.organization_id == organization_id,
            WebhookEndpoint.external_id.in_(external_ids),
        )
        if for_update:
            statement = statement.with_for_update(of=WebhookEndpoint, key_share=True)
        return await self.get_all(statement)

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

    async def get_ids_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Sequence[UUID]:
        statement = (
            self.get_base_statement(include_deleted=True)
            .with_only_columns(WebhookEndpoint.id)
            .where(WebhookEndpoint.organization_id.in_(org_ids))
        )
        result = await self.session.execute(statement)
        return result.scalars().all()

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
