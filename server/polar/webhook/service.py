from collections.abc import Sequence
from typing import NoReturn
from uuid import UUID

from sqlalchemy import Select, and_, desc, or_, select, text
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.service import AccessType, Authz
from polar.benefit.schemas import benefit_schema_map
from polar.donation.schemas import Donation as DonationSchema
from polar.exceptions import NotPermitted, PolarRequestValidationError, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.utils import utc_now
from polar.models.benefit import Benefit
from polar.models.donation import Donation
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_endpoint import WebhookEndpoint, WebhookEventType
from polar.models.webhook_event import WebhookEvent
from polar.organization.resolver import get_payload_organization
from polar.organization.schemas import Organization as OrganizationSchema
from polar.pledge.schemas import Pledge as PledgeSchema
from polar.product.schemas import Product as ProductSchema
from polar.subscription.schemas import Subscription as SubscriptionSchema
from polar.webhook.schemas import WebhookEndpointCreate, WebhookEndpointUpdate
from polar.worker import enqueue_job

from .webhooks import (
    WebhookBenefitCreatedPayload,
    WebhookBenefitUpdatedPayload,
    WebhookDonationCreatedPayload,
    WebhookOrganizationUpdatedPayload,
    WebhookPayload,
    WebhookPledgeCreatedPayload,
    WebhookPledgeUpdatedPayload,
    WebhookProductCreatedPayload,
    WebhookProductUpdatedPayload,
    WebhookSubscriptionCreatedPayload,
    WebhookSubscriptionUpdatedPayload,
    WebhookTypeObject,
)


def assert_never(value: NoReturn) -> NoReturn:
    assert False, f"Unhandled value: {value} ({type(value).__name__})"


class WebhookService:
    async def list_endpoints(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        user_id: UUID | None,
        organization_id: UUID | None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[WebhookEndpoint], int]:
        statement = self._get_readable_endpoints_statement(auth_subject)

        if user_id is not None:
            statement = statement.where(WebhookEndpoint.user_id == user_id)
        if organization_id is not None:
            statement = statement.where(
                WebhookEndpoint.organization_id == organization_id
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
        authz: Authz,
        auth_subject: AuthSubject[User | Organization],
        create_schema: WebhookEndpointCreate,
    ) -> WebhookEndpoint:
        endpoint = WebhookEndpoint(**create_schema.model_dump())

        # Organization ID unset: guess from auth_subject
        if create_schema.organization_id is None:
            if is_user(auth_subject):
                endpoint.user_id = auth_subject.subject.id
            elif is_organization(auth_subject):
                endpoint.organization_id = auth_subject.subject.id
        # Organization ID set: check if it's a user, and that he can write to it
        else:
            organization = await get_payload_organization(
                session, auth_subject, create_schema
            )
            if not await authz.can(
                auth_subject.subject, AccessType.write, organization
            ):
                raise PolarRequestValidationError(
                    [
                        {
                            "loc": (
                                "body",
                                "organization_id",
                            ),
                            "msg": "Organization not found.",
                            "type": "value_error",
                            "input": organization.id,
                        }
                    ]
                )
            endpoint.organization_id = organization.id

        session.add(endpoint)
        await session.flush()
        return endpoint

    async def update_endpoint(
        self,
        session: AsyncSession,
        authz: Authz,
        auth_subject: AuthSubject[User | Organization],
        *,
        endpoint: WebhookEndpoint,
        update_schema: WebhookEndpointUpdate,
    ) -> WebhookEndpoint:
        await self._can_write_endpoint(authz, auth_subject, endpoint)

        for attr, value in update_schema.model_dump(
            exclude_unset=True, exclude_none=True
        ).items():
            setattr(endpoint, attr, value)
        session.add(endpoint)
        await session.flush()
        return endpoint

    async def delete_endpoint(
        self,
        session: AsyncSession,
        authz: Authz,
        auth_subject: AuthSubject[User | Organization],
        endpoint: WebhookEndpoint,
    ) -> WebhookEndpoint:
        await self._can_write_endpoint(authz, auth_subject, endpoint)

        endpoint.deleted_at = utc_now()
        session.add(endpoint)
        await session.flush()
        return endpoint

    async def list_deliveries(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        endpoint_id: UUID | None = None,
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
                WebhookDelivery.webhook_endpoint_id == endpoint_id
            )

        return await paginate(session, statement, pagination=pagination)

    async def redeliver_event(
        self,
        session: AsyncSession,
        authz: Authz,
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

        endpoint = event.webhook_endpoint
        await self._can_write_endpoint(authz, auth_subject, endpoint)

        enqueue_job("webhook_event.send", webhook_event_id=event.id)

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

    async def send(
        self,
        session: AsyncSession,
        target: Organization | User,
        we: WebhookTypeObject,
    ) -> None:
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
            case WebhookEventType.product_created:
                payload = WebhookProductCreatedPayload(
                    type=we[0],
                    data=ProductSchema.model_validate(we[1]),
                )
            case WebhookEventType.product_updated:
                payload = WebhookProductUpdatedPayload(
                    type=we[0],
                    data=ProductSchema.model_validate(we[1]),
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
                        data=OrganizationSchema.model_validate(we[1]),
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

        for e in await self._get_event_target_endpoints(
            session, event=we[0], target=target
        ):
            event = WebhookEvent(
                webhook_endpoint_id=e.id, payload=payload.model_dump_json()
            )
            session.add(event)
            await session.flush()

            enqueue_job("webhook_event.send", webhook_event_id=event.id)

        return

    def _get_readable_endpoints_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[WebhookEndpoint]]:
        statement = select(WebhookEndpoint).where(WebhookEndpoint.deleted_at.is_(None))

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.join(
                UserOrganization,
                onclause=UserOrganization.organization_id
                == WebhookEndpoint.organization_id,
                full=True,
            ).where(
                or_(
                    WebhookEndpoint.user_id == user.id,
                    and_(
                        UserOrganization.deleted_at.is_(None),
                        UserOrganization.user_id == user.id,
                    ),
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
        target: Organization | User,
    ) -> Sequence[WebhookEndpoint]:
        statement = select(WebhookEndpoint).where(
            WebhookEndpoint.deleted_at.is_(None),
            WebhookEndpoint.events.bool_op("@>")(text(f"'[\"{event}\"]'")),
        )
        if isinstance(target, Organization):
            statement = statement.where(WebhookEndpoint.organization_id == target.id)
        else:
            statement = statement.where(WebhookEndpoint.user_id == target.id)

        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def _can_write_endpoint(
        self,
        authz: Authz,
        auth_subject: AuthSubject[User | Organization],
        endpoint: WebhookEndpoint,
    ) -> None:
        if not await authz.can(auth_subject.subject, AccessType.write, endpoint):
            raise NotPermitted()


webhook = WebhookService()
