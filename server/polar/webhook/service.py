import datetime
import json
from collections.abc import Sequence
from typing import Literal, cast, overload
from uuid import UUID

import structlog
from sqlalchemy import CursorResult, desc, func, select, text, update
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.checkout.repository import CheckoutRepository
from polar.config import settings
from polar.customer.schemas.state import CustomerState
from polar.email.react import render_email_template
from polar.email.schemas import EmailAdapter
from polar.email.sender import enqueue_email
from polar.exceptions import PolarError, ResourceNotFound
from polar.integrations.loops.service import loops as loops_service
from polar.kit.crypto import generate_token
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    Benefit,
    BenefitGrant,
    Checkout,
    Customer,
    CustomerSeat,
    Order,
    Organization,
    Product,
    Refund,
    Subscription,
    User,
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
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .repository import (
    WebhookDeliveryRepository,
    WebhookEndpointRepository,
    WebhookEventRepository,
)
from .schemas import WebhookEndpointCreate, WebhookEndpointUpdate
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
        repository = WebhookEndpointRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).order_by(
            WebhookEndpoint.created_at.desc()
        )

        if organization_id is not None:
            statement = statement.where(
                WebhookEndpoint.organization_id.in_(organization_id)
            )

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get_endpoint(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> WebhookEndpoint | None:
        repository = WebhookEndpointRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            WebhookEndpoint.id == id
        )
        return await repository.get_one_or_none(statement)

    async def create_endpoint(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: WebhookEndpointCreate,
    ) -> WebhookEndpoint:
        repository = WebhookEndpointRepository.from_session(session)
        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )
        if create_schema.secret is not None:
            secret = create_schema.secret
        else:
            secret = generate_token(prefix=WEBHOOK_SECRET_PREFIX)

        endpoint = await repository.create(
            WebhookEndpoint(
                **create_schema.model_dump(exclude={"secret"}, by_alias=True),
                secret=secret,
                organization=organization,
            )
        )

        # Store it in Loops in case we need to announce technical things regarding webhooks
        user_organizations = await user_organization_service.list_by_org(
            session, organization.id
        )
        for user_organization in user_organizations:
            await loops_service.user_update(
                session, user_organization.user, webhooksCreated=True
            )

        return endpoint

    async def update_endpoint(
        self,
        session: AsyncSession,
        *,
        endpoint: WebhookEndpoint,
        update_schema: WebhookEndpointUpdate,
    ) -> WebhookEndpoint:
        repository = WebhookEndpointRepository.from_session(session)
        return await repository.update(
            endpoint,
            update_dict=update_schema.model_dump(exclude_unset=True, exclude_none=True),
        )

    async def reset_endpoint_secret(
        self, session: AsyncSession, *, endpoint: WebhookEndpoint
    ) -> WebhookEndpoint:
        repository = WebhookEndpointRepository.from_session(session)
        return await repository.update(
            endpoint,
            update_dict={
                "secret": generate_token(prefix=WEBHOOK_SECRET_PREFIX),
            },
        )

    async def delete_endpoint(
        self,
        session: AsyncSession,
        endpoint: WebhookEndpoint,
    ) -> WebhookEndpoint:
        repository = WebhookEndpointRepository.from_session(session)
        return await repository.soft_delete(endpoint)

    async def list_deliveries(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        endpoint_id: Sequence[UUID] | None = None,
        start_timestamp: datetime.datetime | None = None,
        end_timestamp: datetime.datetime | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[WebhookDelivery], int]:
        repository = WebhookDeliveryRepository.from_session(session)

        statement = (
            repository.get_readable_statement(auth_subject)
            .options(joinedload(WebhookDelivery.webhook_event))
            .order_by(desc(WebhookDelivery.created_at))
        )

        if endpoint_id is not None:
            statement = statement.where(
                WebhookDelivery.webhook_endpoint_id.in_(endpoint_id)
            )

        if start_timestamp is not None:
            statement = statement.where(WebhookDelivery.created_at > start_timestamp)

        if end_timestamp is not None:
            statement = statement.where(WebhookDelivery.created_at < end_timestamp)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def redeliver_event(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> None:
        repository = WebhookEventRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            WebhookEvent.id == id
        )
        event = await repository.get_one_or_none(statement)

        if event is None:
            raise ResourceNotFound()

        enqueue_job("webhook_event.send", webhook_event_id=event.id, redeliver=True)

    async def on_event_success(self, session: AsyncSession, id: UUID) -> None:
        """
        Helper to hook into the event success event.

        Useful to trigger logic that might wait for an event to be delivered.
        """
        repository = WebhookEventRepository.from_session(session)
        event = await repository.get_by_id(id, options=repository.get_eager_options())
        if event is None:
            raise EventDoesNotExist(id)

        if not event.succeeded:
            raise EventNotSuccessul(id)

        if event.webhook_endpoint.format != WebhookFormat.raw:
            return

        if event.payload is None:
            return

        if event.type == WebhookEventType.checkout_updated:
            checkout_repository = CheckoutRepository.from_session(session)
            payload = json.loads(event.payload)
            checkout = await checkout_repository.get_by_id(UUID(payload["data"]["id"]))
            assert checkout is not None
            await publish_checkout_event(
                checkout.client_secret,
                CheckoutEvent.webhook_event_delivered,
                {"status": checkout.status},
            )

    async def on_event_failed(self, session: AsyncSession, id: UUID) -> None:
        """
        Helper to hook into the event failed event.

        Detects consecutive failures and disables the endpoint if threshold is exceeded.
        """
        webhook_event_repository = WebhookEventRepository.from_session(session)
        event = await webhook_event_repository.get_by_id(
            id, options=webhook_event_repository.get_eager_options()
        )
        if event is None:
            raise EventDoesNotExist(id)

        if event.succeeded is not False:
            return

        endpoint = event.webhook_endpoint
        if not endpoint.enabled:
            return

        # Get recent events to count the streak
        recent_events = await webhook_event_repository.get_recent_by_endpoint(
            endpoint.id, limit=settings.WEBHOOK_FAILURE_THRESHOLD
        )

        # Check if all recent events are failures
        if len(recent_events) >= settings.WEBHOOK_FAILURE_THRESHOLD and all(
            event.succeeded is False for event in recent_events
        ):
            log.warning(
                "Disabling webhook endpoint due to consecutive failures",
                webhook_endpoint_id=endpoint.id,
                failure_count=len(recent_events),
            )
            webhook_endpoint_repository = WebhookEndpointRepository.from_session(
                session
            )
            await webhook_endpoint_repository.update(
                endpoint, update_dict={"enabled": False}, flush=True
            )

            # Mark all pending events as skipped
            pending_events = await webhook_event_repository.get_pending_by_endpoint(
                endpoint.id
            )
            for pending_event in pending_events:
                pending_event.skipped = True
                session.add(pending_event)

            if pending_events:
                log.info(
                    "Marked pending events as skipped",
                    webhook_endpoint_id=endpoint.id,
                    count=len(pending_events),
                )

            # Send email to all organization members
            organization_id = endpoint.organization_id
            user_organizations = await user_organization_service.list_by_org(
                session, organization_id
            )

            if user_organizations:
                # User and Organization are eagerly loaded
                organization = user_organizations[0].organization
                dashboard_url = f"{settings.FRONTEND_BASE_URL}/dashboard/{organization.slug}/settings/webhooks"

                for user_org in user_organizations:
                    user = user_org.user
                    email = EmailAdapter.validate_python(
                        {
                            "template": "webhook_endpoint_disabled",
                            "props": {
                                "email": user.email,
                                "organization": organization,
                                "webhook_endpoint_url": endpoint.url,
                                "dashboard_url": dashboard_url,
                            },
                        }
                    )

                    body = render_email_template(email)

                    enqueue_email(
                        to_email_addr=user.email,
                        subject=f"Webhook endpoint disabled for {organization.name}",
                        html_content=body,
                    )

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
        event: Literal[WebhookEventType.customer_seat_assigned],
        data: CustomerSeat,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.customer_seat_claimed],
        data: CustomerSeat,
    ) -> list[WebhookEvent]: ...

    @overload
    async def send(
        self,
        session: AsyncSession,
        target: Organization,
        event: Literal[WebhookEventType.customer_seat_revoked],
        data: CustomerSeat,
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
        event: Literal[WebhookEventType.subscription_past_due],
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

            # https://github.com/sqlalchemy/sqlalchemy/commit/67f62aac5b49b6d048ca39019e5bd123d3c9cfb2
            result = cast(CursorResult[WebhookEvent], await session.execute(statement))
            updated_count = result.rowcount

            await session.commit()

            log.debug("Archived webhook events batch", updated_count=updated_count)

            if updated_count < batch_size:
                break

    async def _get_event_target_endpoints(
        self,
        session: AsyncSession,
        *,
        event: WebhookEventType,
        target: Organization,
    ) -> Sequence[WebhookEndpoint]:
        statement = select(WebhookEndpoint).where(
            WebhookEndpoint.deleted_at.is_(None),
            WebhookEndpoint.enabled.is_(True),
            WebhookEndpoint.events.bool_op("@>")(text(f"'[\"{event}\"]'")),
            WebhookEndpoint.organization_id == target.id,
        )
        res = await session.execute(statement)
        return res.scalars().unique().all()


webhook = WebhookService()
