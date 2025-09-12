import datetime
from collections.abc import Sequence
from typing import Literal, overload
from uuid import UUID

import structlog
from sqlalchemy import Select, desc, func, select, text, update
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.customer.schemas.state import CustomerState
from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.crypto import generate_token
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    Benefit,
    BenefitGrant,
    Checkout,
    Customer,
    Order,
    Organization,
    Product,
    Refund,
    Subscription,
    User,
    UserOrganization,
    WebhookDelivery,
    WebhookEvent,
)
from polar.models.webhook_endpoint import (
    WebhookEndpoint,
    WebhookEventType,
    WebhookFormat,
)
from polar.oauth2.constants import WEBHOOK_SECRET_PREFIX
from polar.organization.resolver import get_payload_organization
from polar.webhook.schemas import (
    WebhookEndpointCreate,
    WebhookEndpointUpdate,
)
from polar.worker import enqueue_job

from .webhooks import SkipEvent, UnsupportedTarget, WebhookPayloadTypeAdapter

log: Logger = structlog.get_logger()


class WebhookError(PolarError): ...


class EventDoesNotExist(WebhookError):
    def __init__(self, event_id: UUID) -> None:
        self.event_id = event_id
        message = f"Event with ID {event_id} does not exist."
        super().__init__(message)


class EventNotSuccessul(WebhookError):
    def __init__(self, event_id: UUID) -> None:
        self.event_id = event_id
        message = f"Event with ID {event_id} is not successful."
        super().__init__(message)


class WebhookService:
    async def list_endpoints(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[UUID] | None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[WebhookEndpoint], int]:
        statement = self._get_readable_endpoints_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(
                WebhookEndpoint.organization_id.in_(organization_id)
            )

        statement = statement.order_by(WebhookEndpoint.created_at.desc())

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_endpoint(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> WebhookEndpoint | None:
        statement = self._get_readable_endpoints_statement(auth_subject).where(
            WebhookEndpoint.id == id
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def create_endpoint(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: WebhookEndpointCreate,
    ) -> WebhookEndpoint:
        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )
        if create_schema.secret is not None:
            secret = create_schema.secret
        else:
            secret = generate_token(prefix=WEBHOOK_SECRET_PREFIX)
        endpoint = WebhookEndpoint(
            **create_schema.model_dump(exclude={"secret"}, by_alias=True),
            secret=secret,
            organization=organization,
        )
        session.add(endpoint)
        return endpoint

    async def update_endpoint(
        self,
        session: AsyncSession,
        *,
        endpoint: WebhookEndpoint,
        update_schema: WebhookEndpointUpdate,
    ) -> WebhookEndpoint:
        for attr, value in update_schema.model_dump(
            exclude_unset=True, exclude_none=True
        ).items():
            setattr(endpoint, attr, value)
        session.add(endpoint)
        return endpoint

    async def reset_endpoint_secret(
        self, session: AsyncSession, *, endpoint: WebhookEndpoint
    ) -> WebhookEndpoint:
        endpoint.secret = generate_token(prefix=WEBHOOK_SECRET_PREFIX)
        session.add(endpoint)
        return endpoint

    async def delete_endpoint(
        self,
        session: AsyncSession,
        endpoint: WebhookEndpoint,
    ) -> WebhookEndpoint:
        endpoint.deleted_at = utc_now()
        session.add(endpoint)
        return endpoint

    async def list_deliveries(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        endpoint_id: Sequence[UUID] | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[WebhookDelivery], int]:
        readable_endpoints_statement = self._get_readable_endpoints_statement(
            auth_subject
        )
        statement = (
            select(WebhookDelivery)
            .join(WebhookEndpoint)
            .where(
                WebhookDelivery.deleted_at.is_(None),
                WebhookEndpoint.id.in_(
                    readable_endpoints_statement.with_only_columns(WebhookEndpoint.id)
                ),
            )
            .options(joinedload(WebhookDelivery.webhook_event))
            .order_by(desc(WebhookDelivery.created_at))
        )

        if endpoint_id is not None:
            statement = statement.where(
                WebhookDelivery.webhook_endpoint_id.in_(endpoint_id)
            )

        return await paginate(session, statement, pagination=pagination)

    async def redeliver_event(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> None:
        readable_endpoints_statement = self._get_readable_endpoints_statement(
            auth_subject
        )
        statement = (
            select(WebhookEvent)
            .join(WebhookEndpoint)
            .where(
                WebhookEvent.id == id,
                WebhookEvent.deleted_at.is_(None),
                WebhookEvent.is_archived.is_(False),
                WebhookEndpoint.id.in_(
                    readable_endpoints_statement.with_only_columns(WebhookEndpoint.id)
                ),
            )
            .options(contains_eager(WebhookEvent.webhook_endpoint))
        )

        res = await session.execute(statement)
        event = res.scalars().unique().one_or_none()
        if event is None:
            raise ResourceNotFound()

        enqueue_job("webhook_event.send", webhook_event_id=event.id, redeliver=True)

    async def on_event_success(self, session: AsyncSession, id: UUID) -> None:
        """
        Helper to hook into the event success event.

        Useful to trigger logic that might wait for an event to be delivered.
        """
        event = await self.get_event_by_id(session, id)
        if event is None:
            raise EventDoesNotExist(id)

        if not event.succeeded:
            raise EventNotSuccessul(id)

        if event.webhook_endpoint.format != WebhookFormat.raw:
            return

        assert event.payload is not None
        payload = WebhookPayloadTypeAdapter.validate_json(event.payload)

        if payload.type == WebhookEventType.checkout_updated:
            await publish_checkout_event(
                payload.data.client_secret,
                CheckoutEvent.webhook_event_delivered,
                {"status": payload.data.status},
            )

    async def get_event_by_id(
        self, session: AsyncSession, id: UUID
    ) -> WebhookEvent | None:
        statement = (
            select(WebhookEvent)
            .where(WebhookEvent.deleted_at.is_(None), WebhookEvent.id == id)
            .options(joinedload(WebhookEvent.webhook_endpoint))
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def is_latest_event(self, session: AsyncSession, event: WebhookEvent) -> bool:
        age_limit = utc_now() - datetime.timedelta(minutes=1)
        statement = (
            select(func.count(WebhookEvent.id))
            .join(
                WebhookDelivery,
                WebhookDelivery.webhook_event_id == WebhookEvent.id,
                isouter=True,
            )
            .where(
                WebhookEvent.deleted_at.is_(None),
                WebhookEvent.webhook_endpoint_id == event.webhook_endpoint_id,
                WebhookEvent.id != event.id,  # Not the current event
                WebhookDelivery.id.is_(None),  # Not delivered yet
                WebhookEvent.created_at
                < event.created_at,  # Older than the current event
                WebhookEvent.created_at >= age_limit,  # Not too old
            )
            .limit(1)
        )
        res = await session.execute(statement)
        count = res.scalar_one()
        return count == 0

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.checkout_created],
        data: Checkout,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.checkout_updated],
        data: Checkout,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.customer_created],
        data: Customer,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.customer_updated],
        data: Customer,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.customer_deleted],
        data: Customer,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.customer_state_changed],
        data: CustomerState,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.order_created],
        data: Order,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.order_updated],
        data: Order,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.order_paid],
        data: Order,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.order_refunded],
        data: Order,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.subscription_created],
        data: Subscription,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.subscription_updated],
        data: Subscription,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.subscription_active],
        data: Subscription,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.subscription_canceled],
        data: Subscription,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.subscription_uncanceled],
        data: Subscription,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.subscription_revoked],
        data: Subscription,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.refund_created],
        data: Refund,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.refund_updated],
        data: Refund,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.product_created],
        data: Product,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.product_updated],
        data: Product,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.organization_updated],
        data: Organization,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.benefit_created],
        data: Benefit,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.benefit_updated],
        data: Benefit,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.benefit_grant_created],
        data: BenefitGrant,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.benefit_grant_updated],
        data: BenefitGrant,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.benefit_grant_cycled],
        data: BenefitGrant,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.benefit_grant_revoked],
        data: BenefitGrant,
    ) -> list[WebhookEvent]: ...

    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: WebhookEventType,
        data: object,
    ) -> list[WebhookEvent]:
        now = utc_now()
        payload = WebhookPayloadTypeAdapter.validate_python(
            {"type": event, "timestamp": now, "data": data}
        )

        events: list[WebhookEvent] = []
        for endpoint in await self._get_event_target_endpoints(
            session, event=event, target=target
        ):
            try:
                payload_data = payload.get_payload(endpoint.format, target)
                event_type = WebhookEvent(
                    created_at=payload.timestamp,
                    webhook_endpoint=endpoint,
                    type=event,
                    payload=payload_data,
                )
                session.add(event_type)
                events.append(event_type)
                await session.flush()
                enqueue_job("webhook_event.send", webhook_event_id=event_type.id)
            except UnsupportedTarget as e:
                # Log the error but do not raise to not fail the whole request
                log.error(e.message)
                continue
            except SkipEvent:
                continue

        return events

    async def archive_events(
        self,
        session: AsyncSession,
        older_than: datetime.datetime,
        batch_size: int = 5000,
    ) -> None:
        log.debug(
            "Archive webhook events", older_than=older_than, batch_size=batch_size
        )

        while True:
            batch_subquery = (
                select(WebhookEvent.id)
                .where(
                    WebhookEvent.created_at < older_than,
                    WebhookEvent.payload.is_not(None),
                )
                .order_by(WebhookEvent.created_at.asc())
                .limit(batch_size)
            )
            statement = (
                update(WebhookEvent)
                .where(WebhookEvent.id.in_(batch_subquery))
                .values(payload=None)
            )
            result = await session.execute(statement)
            updated_count = result.rowcount

            await session.commit()

            log.debug("Archived webhook events batch", updated_count=updated_count)

            if updated_count < batch_size:
                break

    def _get_readable_endpoints_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[WebhookEndpoint]]:
        statement = select(WebhookEndpoint).where(WebhookEndpoint.deleted_at.is_(None))

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                WebhookEndpoint.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                WebhookEndpoint.organization_id == auth_subject.subject.id
            )

        return statement

    async def _get_event_target_endpoints(
        self,
        session: AsyncSession,
        *,
        event: WebhookEventType,
        target: Organization,
    ) -> Sequence[WebhookEndpoint]:
        statement = select(WebhookEndpoint).where(
            WebhookEndpoint.deleted_at.is_(None),
            WebhookEndpoint.events.bool_op("@>")(text(f"'[\"{event}\"]'")),
            WebhookEndpoint.organization_id == target.id,
        )
        res = await session.execute(statement)
        return res.scalars().unique().all()


webhook = WebhookService()
