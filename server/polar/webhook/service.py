from collections.abc import Sequence
from typing import NoReturn
from uuid import UUID

from sqlalchemy import desc
from sqlalchemy.orm import joinedload

from polar.benefit.schemas import benefit_schema_map
from polar.donation.schemas import Donation as DonationSchema
from polar.kit.db.postgres import AsyncSession
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.utils import utc_now
from polar.models.benefit import Benefit
from polar.models.donation import Donation
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.user import User
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_endpoint import WebhookEndpoint
from polar.models.webhook_event import WebhookEvent
from polar.organization.schemas import Organization as OrganizationSchema
from polar.pledge.schemas import Pledge as PledgeSchema
from polar.subscription.schemas import Subscription as SubscriptionSchema
from polar.subscription.schemas import SubscriptionTier as SubscriptionTierSchema
from polar.webhook.schemas import WebhookEndpointCreate, WebhookEndpointUpdate
from polar.worker import enqueue_job

from .webhooks import (
    WebhookBenefitCreatedPayload,
    WebhookBenefitUpdatedPayload,
    WebhookDonationCreatedPayload,
    WebhookEventType,
    WebhookOrganizationUpdatedPayload,
    WebhookPayload,
    WebhookPledgeCreatedPayload,
    WebhookPledgeUpdatedPayload,
    WebhookSubscriptionCreatedPayload,
    WebhookSubscriptionTierCreatedPayload,
    WebhookSubscriptionTierUpdatedPayload,
    WebhookSubscriptionUpdatedPayload,
    WebhookTypeObject,
)


def assert_never(value: NoReturn) -> NoReturn:
    assert False, f"Unhandled value: {value} ({type(value).__name__})"


class WebhookService:
    async def list_endpoints(
        self,
        session: AsyncSession,
        target: Organization | User,
        event: WebhookEventType | None = None,
    ) -> Sequence[WebhookEndpoint]:
        stmt = sql.select(WebhookEndpoint).where(
            WebhookEndpoint.deleted_at.is_(None),
        )

        if isinstance(target, Organization):
            stmt = stmt.where(WebhookEndpoint.organization_id == target.id)
        else:
            stmt = stmt.where(WebhookEndpoint.user_id == target.id)

        match event:
            case None:
                ...
            case WebhookEventType.subscription_created:
                stmt = stmt.where(WebhookEndpoint.event_subscription_created.is_(True))
            case WebhookEventType.subscription_updated:
                stmt = stmt.where(WebhookEndpoint.event_subscription_updated.is_(True))
            case WebhookEventType.subscription_tier_created:
                stmt = stmt.where(
                    WebhookEndpoint.event_subscription_tier_created.is_(True)
                )
            case WebhookEventType.subscription_tier_updated:
                stmt = stmt.where(
                    WebhookEndpoint.event_subscription_tier_updated.is_(True)
                )
            case WebhookEventType.pledge_created:
                stmt = stmt.where(WebhookEndpoint.event_pledge_created.is_(True))
            case WebhookEventType.pledge_updated:
                stmt = stmt.where(WebhookEndpoint.event_pledge_updated.is_(True))
            case WebhookEventType.donation_created:
                stmt = stmt.where(WebhookEndpoint.event_donation_created.is_(True))
            case WebhookEventType.organization_updated:
                stmt = stmt.where(WebhookEndpoint.event_organization_updated.is_(True))
            case WebhookEventType.benefit_created:
                stmt = stmt.where(WebhookEndpoint.event_benefit_created.is_(True))
            case WebhookEventType.benefit_updated:
                stmt = stmt.where(WebhookEndpoint.event_benefit_updated.is_(True))
            case x:
                assert_never(x)  # asserts that the match above is exhaustive

        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def get_event(self, session: AsyncSession, id: UUID) -> WebhookEvent | None:
        stmt = (
            sql.select(WebhookEvent)
            .where(
                WebhookEvent.id == id,
            )
            .options(joinedload(WebhookEvent.webhook_endpoint))
        )
        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def get_endpoint(
        self, session: AsyncSession, id: UUID
    ) -> WebhookEndpoint | None:
        stmt = sql.select(WebhookEndpoint).where(
            WebhookEndpoint.id == id,
            WebhookEndpoint.deleted_at.is_(None),
        )
        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def delete_endpoint(self, session: AsyncSession, id: UUID) -> None:
        stmt = (
            sql.update(WebhookEndpoint)
            .where(
                WebhookEndpoint.id == id,
            )
            .values(deleted_at=utc_now())
        )
        await session.execute(stmt)

    async def send(
        self,
        session: AsyncSession,
        target: Organization | User,
        we: WebhookTypeObject,
    ) -> None:
        endpoints = await self.list_endpoints(session, target, event=we[0])

        payload: WebhookPayload | None = None

        match we[0]:
            case WebhookEventType.subscription_created:
                payload = WebhookSubscriptionCreatedPayload(
                    type=we[0],
                    data=SubscriptionSchema.model_validate(we[1]),
                )
            case WebhookEventType.subscription_updated:
                payload = WebhookSubscriptionUpdatedPayload(
                    type=we[0],
                    data=SubscriptionSchema.model_validate(we[1]),
                )
            case WebhookEventType.subscription_tier_created:
                payload = WebhookSubscriptionTierCreatedPayload(
                    type=we[0],
                    data=SubscriptionTierSchema.model_validate(we[1]),
                )
            case WebhookEventType.subscription_tier_updated:
                payload = WebhookSubscriptionTierUpdatedPayload(
                    type=we[0],
                    data=SubscriptionTierSchema.model_validate(we[1]),
                )
            case WebhookEventType.pledge_created:
                # mypy is not able to deduce this by itself
                if isinstance(we[1], Pledge):
                    payload = WebhookPledgeCreatedPayload(
                        type=we[0],
                        data=PledgeSchema.from_db(
                            we[1],
                            include_receiver_admin_fields=True,
                            include_sender_admin_fields=False,
                            include_sender_fields=False,
                        ),
                    )
            case WebhookEventType.pledge_updated:
                # mypy is not able to deduce this by itself
                if isinstance(we[1], Pledge):
                    payload = WebhookPledgeUpdatedPayload(
                        type=we[0],
                        data=PledgeSchema.from_db(
                            we[1],
                            include_receiver_admin_fields=True,
                            include_sender_admin_fields=False,
                            include_sender_fields=False,
                        ),
                    )
            case WebhookEventType.donation_created:
                # mypy is not able to deduce this by itself
                if isinstance(we[1], Donation):
                    payload = WebhookDonationCreatedPayload(
                        type=we[0],
                        data=DonationSchema.from_db(we[1]),
                    )
            case WebhookEventType.organization_updated:
                # mypy is not able to deduce this by itself
                if isinstance(we[1], Organization):
                    payload = WebhookOrganizationUpdatedPayload(
                        type=we[0],
                        data=OrganizationSchema.from_db(we[1]),
                    )
            case WebhookEventType.benefit_created:
                # mypy is not able to deduce this by itself
                if isinstance(we[1], Benefit):
                    t = benefit_schema_map[we[1].type]
                    payload = WebhookBenefitCreatedPayload(
                        type=we[0],
                        data=t.model_validate(we[1]),
                    )
            case WebhookEventType.benefit_updated:
                # mypy is not able to deduce this by itself
                if isinstance(we[1], Benefit):
                    t = benefit_schema_map[we[1].type]
                    payload = WebhookBenefitUpdatedPayload(
                        type=we[0],
                        data=t.model_validate(we[1]),
                    )
            case x:
                assert_never(x)  # asserts that the match is exhaustive

        if payload is None:
            raise Exception("no payload")

        for e in endpoints:
            event = WebhookEvent(
                webhook_endpoint_id=e.id, payload=payload.model_dump_json()
            )
            session.add(event)
            await session.flush()

            enqueue_job("webhook_event.send", webhook_event_id=event.id)

        return

    async def create_endpoint(
        self,
        session: AsyncSession,
        *,
        create: WebhookEndpointCreate,
    ) -> WebhookEndpoint:
        endpoint = WebhookEndpoint(
            url=str(create.url),
            user_id=create.user_id,
            organization_id=create.organization_id,
            secret=create.secret,
            event_subscription_created=create.event_subscription_created,
            event_subscription_updated=create.event_subscription_updated,
            event_subscription_tier_created=create.event_subscription_tier_created,
            event_subscription_tier_updated=create.event_subscription_tier_updated,
            event_pledge_created=create.event_pledge_created,
            event_pledge_updated=create.event_pledge_updated,
            event_donation_created=create.event_donation_created,
            event_organization_updated=create.event_organization_updated,
            event_benefit_created=create.event_benefit_created,
            event_benefit_updated=create.event_benefit_updated,
        )
        session.add(endpoint)
        await session.flush()
        return endpoint

    async def update_endpoint(
        self,
        session: AsyncSession,
        *,
        endpoint: WebhookEndpoint,
        update: WebhookEndpointUpdate,
    ) -> WebhookEndpoint:
        if update.url is not None:
            endpoint.url = update.url

        if update.secret is not None:
            endpoint.secret = update.secret

        if update.event_subscription_created is not None:
            endpoint.event_subscription_created = update.event_subscription_created
        if update.event_subscription_updated is not None:
            endpoint.event_subscription_updated = update.event_subscription_updated
        if update.event_subscription_tier_created is not None:
            endpoint.event_subscription_tier_created = (
                update.event_subscription_tier_created
            )
        if update.event_subscription_tier_updated is not None:
            endpoint.event_subscription_tier_updated = (
                update.event_subscription_tier_updated
            )
        if update.event_pledge_created is not None:
            endpoint.event_pledge_created = update.event_pledge_created
        if update.event_pledge_updated is not None:
            endpoint.event_pledge_updated = update.event_pledge_updated
        if update.event_donation_created is not None:
            endpoint.event_donation_created = update.event_donation_created
        if update.event_organization_updated is not None:
            endpoint.event_organization_updated = update.event_organization_updated
        if update.event_benefit_created is not None:
            endpoint.event_benefit_created = update.event_benefit_created
        if update.event_benefit_updated is not None:
            endpoint.event_benefit_updated = update.event_benefit_updated

        session.add(endpoint)
        await session.flush()
        return endpoint

    async def search_endpoints(
        self,
        session: AsyncSession,
        *,
        user_id: UUID | None,
        organization_id: UUID | None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[WebhookEndpoint], int]:
        stmt = sql.select(WebhookEndpoint).where(WebhookEndpoint.deleted_at.is_(None))

        if user_id is not None:
            stmt = stmt.where(WebhookEndpoint.user_id == user_id)
        if organization_id is not None:
            stmt = stmt.where(WebhookEndpoint.organization_id == organization_id)

        stmt = stmt.order_by(desc(WebhookEndpoint.created_at))

        results, count = await paginate(session, stmt, pagination=pagination)

        return results, count

    async def search_deliveries(
        self,
        session: AsyncSession,
        *,
        endpoint_id: UUID,
        pagination: PaginationParams,
    ) -> tuple[Sequence[WebhookDelivery], int]:
        stmt = sql.select(WebhookDelivery)

        stmt = stmt.where(WebhookDelivery.webhook_endpoint_id == endpoint_id)

        stmt = stmt.options(joinedload(WebhookDelivery.webhook_event))

        stmt = stmt.order_by(desc(WebhookDelivery.created_at))

        results, count = await paginate(session, stmt, pagination=pagination)

        return results, count


webhook_service = WebhookService()
