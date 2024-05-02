import uuid
from collections.abc import Sequence
from typing import Any, Literal, TypeVar

from sqlalchemy import Select, and_, case, func, or_, select, update
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import contains_eager, joinedload

from polar.account.service import account as account_service
from polar.auth.models import AuthSubject, Subject, is_organization, is_user
from polar.authz.service import AccessType, Authz
from polar.benefit.service.benefit import benefit as benefit_service
from polar.exceptions import NotPermitted, PolarError
from polar.integrations.stripe.service import ProductUpdateKwargs
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.services import ResourceService
from polar.models import (
    Account,
    Benefit,
    Organization,
    SubscriptionTier,
    SubscriptionTierBenefit,
    SubscriptionTierPrice,
    User,
    UserOrganization,
)
from polar.models.subscription_tier import SubscriptionTierType
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.resolver import get_payload_organization
from polar.organization.service import organization as organization_service
from polar.webhook.service import webhook as webhook_service
from polar.webhook.webhooks import WebhookTypeObject
from polar.worker import enqueue_job

from ..schemas import (
    ExistingSubscriptionTierPrice,
    SubscriptionTierCreate,
    SubscriptionTierUpdate,
)


class SubscriptionTierError(PolarError): ...


class BenefitDoesNotExist(SubscriptionTierError):
    def __init__(self, benefit_id: uuid.UUID) -> None:
        self.benefit_id = benefit_id
        message = f"Benefit with id {benefit_id} does not exist."
        super().__init__(message, 422)


class BenefitIsNotSelectable(SubscriptionTierError):
    def __init__(self, benefit_id: uuid.UUID) -> None:
        self.benefit_id = benefit_id
        message = f"Benefit with id {benefit_id} cannot be added or removed."
        super().__init__(message, 422)


class FreeTierIsNotArchivable(SubscriptionTierError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = "The Free Subscription Tier is not archivable"
        super().__init__(message, 403)


T = TypeVar("T", bound=tuple[Any])


class SubscriptionTierService(
    ResourceService[SubscriptionTier, SubscriptionTierCreate, SubscriptionTierUpdate]
):
    async def search(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Subject],
        *,
        type: SubscriptionTierType | None = None,
        organization: Organization | None = None,
        include_archived: bool = False,
        pagination: PaginationParams,
    ) -> tuple[Sequence[SubscriptionTier], int]:
        inner_statement = self._get_readable_subscription_tier_ids_statement(
            auth_subject
        )
        count_statement = self._get_readable_subscription_tier_statement(
            auth_subject
        ).with_only_columns(func.count(SubscriptionTier.id))

        if type is not None:
            inner_statement = inner_statement.where(SubscriptionTier.type == type)
            count_statement = count_statement.where(SubscriptionTier.type == type)

        if organization is not None:
            clauses = [SubscriptionTier.organization_id == organization.id]

            inner_statement = inner_statement.where(*clauses)
            count_statement = count_statement.where(*clauses)

        if not include_archived:
            inner_statement = inner_statement.where(
                SubscriptionTier.is_archived.is_(False)
            )
            count_statement = count_statement.where(
                SubscriptionTier.is_archived.is_(False)
            )

        order_by_clauses = [
            case(
                (SubscriptionTier.type == SubscriptionTierType.free, 1),
                (SubscriptionTier.type == SubscriptionTierType.individual, 2),
                (SubscriptionTier.type == SubscriptionTierType.business, 3),
            ),
            SubscriptionTierPrice.price_amount.asc(),
            SubscriptionTier.created_at,
        ]

        inner_statement = inner_statement.order_by(*order_by_clauses)

        # paginate on inner query
        page, limit = pagination
        offset = limit * (page - 1)
        inner_statement = inner_statement.offset(offset).limit(limit)

        # given a list of tiers, join in more data
        outer_statement = (
            select(SubscriptionTier)
            .where(SubscriptionTier.id.in_(inner_statement))
            .join(SubscriptionTier.prices, isouter=True)
            .options(contains_eager(SubscriptionTier.prices))
            .order_by(*order_by_clauses)
            .add_columns(count_statement.scalar_subquery())
        )

        result = await session.execute(outer_statement)

        results: list[Any] = []
        count: int = 0
        for row in result.unique().all():
            (*queried_data, c) = row._tuple()
            count = int(c)
            if len(queried_data) == 1:
                results.append(queried_data[0])
            else:
                results.append(queried_data)

        return results, count

    async def get_by_id(
        self, session: AsyncSession, auth_subject: AuthSubject[Subject], id: uuid.UUID
    ) -> SubscriptionTier | None:
        statement = (
            self._get_readable_subscription_tier_statement(auth_subject)
            .where(SubscriptionTier.id == id, SubscriptionTier.deleted_at.is_(None))
            .options(contains_eager(SubscriptionTier.organization))
            .limit(1)
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_loaded(
        self, session: AsyncSession, id: uuid.UUID, allow_deleted: bool = False
    ) -> SubscriptionTier | None:
        statement = (
            select(SubscriptionTier)
            .where(SubscriptionTier.id == id)
            .options(joinedload(SubscriptionTier.organization))
            .limit(1)
        )

        if not allow_deleted:
            statement = statement.where(SubscriptionTier.deleted_at.is_(None))

        result = await session.execute(statement)

        return result.scalar_one_or_none()

    async def get_free(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
    ) -> SubscriptionTier | None:
        return await self.get_by(
            session, type=SubscriptionTierType.free, organization_id=organization.id
        )

    async def user_create(
        self,
        session: AsyncSession,
        authz: Authz,
        create_schema: SubscriptionTierCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> SubscriptionTier:
        subject = auth_subject.subject

        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )
        if not await authz.can(subject, AccessType.write, organization):
            raise NotPermitted()

        if create_schema.is_highlighted:
            await self._disable_other_highlights(
                session, type=create_schema.type, organization_id=organization.id
            )

        subscription_tier = SubscriptionTier(
            organization=organization,
            prices=[],
            subscription_tier_benefits=[],
            **create_schema.model_dump(exclude={"organization_id", "prices"}),
        )
        session.add(subscription_tier)
        await session.flush()
        assert subscription_tier.id is not None

        metadata: dict[str, str] = {"subscription_tier_id": str(subscription_tier.id)}
        metadata["organization_id"] = str(organization.id)
        metadata["organization_name"] = organization.name

        product = stripe_service.create_product(
            subscription_tier.get_stripe_name(),
            description=subscription_tier.description,
            metadata=metadata,
        )
        subscription_tier.stripe_product_id = product.id

        for price_create in create_schema.prices:
            stripe_price = stripe_service.create_price_for_product(
                product.id,
                price_create.price_amount,
                price_create.price_currency,
                price_create.recurring_interval.as_literal(),
            )
            price = SubscriptionTierPrice(
                **price_create.model_dump(),
                stripe_price_id=stripe_price.id,
                subscription_tier=subscription_tier,
            )
            session.add(price)

        await session.flush()
        await session.refresh(subscription_tier, {"prices"})

        await self._after_tier_created(session, subscription_tier)

        return subscription_tier

    async def user_update(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier: SubscriptionTier,
        update_schema: SubscriptionTierUpdate,
        auth_subject: AuthSubject[User | Organization],
    ) -> SubscriptionTier:
        subscription_tier = await self.with_organization(session, subscription_tier)
        subject = auth_subject.subject

        if not await authz.can(subject, AccessType.write, subscription_tier):
            raise NotPermitted()

        product_update: ProductUpdateKwargs = {}
        if (
            update_schema.name is not None
            and update_schema.name != subscription_tier.name
        ):
            subscription_tier.name = update_schema.name
            product_update["name"] = subscription_tier.get_stripe_name()
        if (
            update_schema.description is not None
            and update_schema.description != subscription_tier.description
        ):
            subscription_tier.description = update_schema.description
            product_update["description"] = update_schema.description

        if product_update and subscription_tier.stripe_product_id is not None:
            stripe_service.update_product(
                subscription_tier.stripe_product_id, **product_update
            )

        existing_prices: set[SubscriptionTierPrice] = set()
        added_prices: list[SubscriptionTierPrice] = []
        if (
            subscription_tier.type != SubscriptionTierType.free
            and update_schema.prices is not None
        ):
            for price_update in update_schema.prices:
                if isinstance(price_update, ExistingSubscriptionTierPrice):
                    existing_price = subscription_tier.get_price(price_update.id)
                    # TODO: we might want to check if the price actually exists
                    if existing_price is not None:
                        existing_prices.add(existing_price)
                    continue

                assert subscription_tier.stripe_product_id is not None
                stripe_price = stripe_service.create_price_for_product(
                    subscription_tier.stripe_product_id,
                    price_update.price_amount,
                    price_update.price_currency,
                    price_update.recurring_interval.as_literal(),
                )
                price = SubscriptionTierPrice(
                    **price_update.model_dump(),
                    stripe_price_id=stripe_price.id,
                    subscription_tier=subscription_tier,
                )
                session.add(price)
                added_prices.append(price)

            deleted_prices = set(subscription_tier.prices) - existing_prices
            updated_prices = list(existing_prices) + added_prices
            if deleted_prices:
                # Make sure to set Stripe's default price to the a non-archived price
                assert subscription_tier.stripe_product_id is not None
                stripe_service.update_product(
                    subscription_tier.stripe_product_id,
                    default_price=updated_prices[0].stripe_price_id,
                )
                for deleted_price in deleted_prices:
                    stripe_service.archive_price(deleted_price.stripe_price_id)
                    deleted_price.is_archived = True
                    session.add(deleted_price)

        if update_schema.is_highlighted:
            await self._disable_other_highlights(
                session,
                type=subscription_tier.type,
                organization_id=subscription_tier.organization_id,
            )

        for attr, value in update_schema.model_dump(
            exclude_unset=True, exclude_none=True, exclude={"prices"}
        ).items():
            setattr(subscription_tier, attr, value)

        session.add(subscription_tier)
        await session.flush()
        await session.refresh(subscription_tier, {"prices"})

        await self._after_tier_updated(session, subscription_tier)

        return subscription_tier

    async def create_free(
        self,
        session: AsyncSession,
        benefits: list[Benefit],
        organization: Organization,
    ) -> SubscriptionTier:
        free_subscription_tier = await self.get_free(session, organization=organization)

        # create if does not exist
        if free_subscription_tier is None:
            free_subscription_tier = SubscriptionTier(
                type=SubscriptionTierType.free,
                name="Free",
                organization_id=organization.id,
                prices=[],
            )

        existing_benefits = [
            str(b.benefit_id) for b in free_subscription_tier.subscription_tier_benefits
        ]

        for index, benefit in enumerate(benefits):
            # this benefit is already attached to this tier
            if str(benefit.id) in existing_benefits:
                continue

            free_subscription_tier.subscription_tier_benefits.append(
                SubscriptionTierBenefit(benefit=benefit, order=index)
            )

        session.add(free_subscription_tier)
        await session.flush()

        enqueue_job(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            free_subscription_tier.id,
        )

        await self._after_tier_created(session, free_subscription_tier)

        return free_subscription_tier

    async def update_benefits(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier: SubscriptionTier,
        benefits: list[uuid.UUID],
        auth_subject: AuthSubject[User | Organization],
    ) -> tuple[SubscriptionTier, set[Benefit], set[Benefit]]:
        subscription_tier = await self.with_organization(session, subscription_tier)

        subject = auth_subject.subject
        if not await authz.can(subject, AccessType.write, subscription_tier):
            raise NotPermitted()

        previous_benefits = set(subscription_tier.benefits)
        new_benefits: set[Benefit] = set()

        nested = await session.begin_nested()

        subscription_tier.subscription_tier_benefits = []
        await session.flush()

        for order, benefit_id in enumerate(benefits):
            benefit = await benefit_service.get_by_id(session, auth_subject, benefit_id)
            if benefit is None:
                await nested.rollback()
                raise BenefitDoesNotExist(benefit_id)
            if not benefit.selectable and benefit not in previous_benefits:
                raise BenefitIsNotSelectable(benefit_id)
            new_benefits.add(benefit)
            subscription_tier.subscription_tier_benefits.append(
                SubscriptionTierBenefit(benefit=benefit, order=order)
            )

        added_benefits = new_benefits - previous_benefits
        deleted_benefits = previous_benefits - new_benefits

        for deleted_benefit in deleted_benefits:
            if not deleted_benefit.selectable:
                raise BenefitIsNotSelectable(deleted_benefit.id)

        session.add(subscription_tier)

        enqueue_job(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            subscription_tier.id,
        )

        await self._after_tier_updated(session, subscription_tier)

        return subscription_tier, added_benefits, deleted_benefits

    async def archive(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier: SubscriptionTier,
        auth_subject: AuthSubject[User | Organization],
    ) -> SubscriptionTier:
        subscription_tier = await self.with_organization(session, subscription_tier)
        if not await authz.can(
            auth_subject.subject, AccessType.write, subscription_tier
        ):
            raise NotPermitted()

        if subscription_tier.type == SubscriptionTierType.free:
            raise FreeTierIsNotArchivable(subscription_tier.id)

        if subscription_tier.stripe_product_id is not None:
            stripe_service.archive_product(subscription_tier.stripe_product_id)

        subscription_tier.is_archived = True
        session.add(subscription_tier)

        await self._after_tier_updated(session, subscription_tier)

        return subscription_tier

    async def with_organization(
        self, session: AsyncSession, subscription_tier: SubscriptionTier
    ) -> SubscriptionTier:
        try:
            subscription_tier.organization
        except InvalidRequestError:
            await session.refresh(subscription_tier, {"organization"})
        return subscription_tier

    def _get_readable_subscription_tier_ids_statement(
        self, auth_subject: AuthSubject[Subject]
    ) -> Select[tuple[uuid.UUID]]:
        return self._apply_readable_subscription_tier_statement(
            auth_subject, select(SubscriptionTier.id)
        )

    def _get_readable_subscription_tier_statement(
        self, auth_subject: AuthSubject[Subject]
    ) -> Select[tuple[SubscriptionTier]]:
        return self._apply_readable_subscription_tier_statement(
            auth_subject, select(SubscriptionTier)
        )

    def _apply_readable_subscription_tier_statement(
        self, auth_subject: AuthSubject[Subject], selector: Select[T]
    ) -> Select[T]:
        stmt = selector.join(SubscriptionTier.organization).where(
            # Prevent to return `None` objects due to the full outer join
            SubscriptionTier.id.is_not(None),
            SubscriptionTier.deleted_at.is_(None),
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            # Direct tier's organization member
            stmt = stmt.join(
                UserOrganization,
                onclause=and_(
                    UserOrganization.organization_id
                    == SubscriptionTier.organization_id,
                    UserOrganization.user_id == user.id,
                    UserOrganization.deleted_at.is_(None),
                ),
                full=True,
            ).where(
                # Can see archived tiers if they are a member of the tier's organization
                or_(
                    SubscriptionTier.is_archived.is_(False),
                    UserOrganization.user_id == user.id,
                ),
            )
        # Organization
        elif is_organization(auth_subject):
            stmt = stmt.where(
                SubscriptionTier.organization_id == auth_subject.subject.id
            )
        # Anonymous
        else:
            stmt = stmt.where(
                SubscriptionTier.is_archived.is_(False),
            )

        return stmt

    async def get_managing_organization_account(
        self, session: AsyncSession, subscription_tier: SubscriptionTier
    ) -> Account | None:
        return await account_service.get_by_organization_id(
            session, subscription_tier.organization_id
        )

    async def _disable_other_highlights(
        self,
        session: AsyncSession,
        *,
        type: SubscriptionTierType,
        organization_id: uuid.UUID,
    ) -> None:
        statement = (
            update(SubscriptionTier)
            .where(
                SubscriptionTier.type == type,
                SubscriptionTier.organization_id == organization_id,
            )
            .values(is_highlighted=False)
        )

        await session.execute(statement)

    async def _after_tier_created(
        self, session: AsyncSession, tier: SubscriptionTier
    ) -> None:
        await self._send_webhook(
            session, tier, WebhookEventType.subscription_tier_created
        )

    async def _after_tier_updated(
        self, session: AsyncSession, tier: SubscriptionTier
    ) -> None:
        await self._send_webhook(
            session, tier, WebhookEventType.subscription_tier_updated
        )

    async def _send_webhook(
        self,
        session: AsyncSession,
        tier: SubscriptionTier,
        event_type: Literal[WebhookEventType.subscription_tier_created]
        | Literal[WebhookEventType.subscription_tier_updated],
    ) -> None:
        # load full tier with relations
        full_tier = await self.get_loaded(session, tier.id, allow_deleted=True)
        assert full_tier

        # mypy 1.9 is does not allow us to do
        #    event = (event_type, subscription)
        # directly, even if it could have...
        event: WebhookTypeObject | None = None
        match event_type:
            case WebhookEventType.subscription_tier_created:
                event = (event_type, full_tier)
            case WebhookEventType.subscription_tier_updated:
                event = (event_type, full_tier)

        if managing_org := await organization_service.get(
            session, tier.organization_id
        ):
            await webhook_service.send(session, target=managing_org, we=event)


subscription_tier = SubscriptionTierService(SubscriptionTier)
