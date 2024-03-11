import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import ColumnExpressionArgument, Select, case, or_, select, update
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import aliased, contains_eager

from polar.account.service import account as account_service
from polar.authz.service import AccessType, Authz, Subject
from polar.exceptions import NotPermitted, PolarError
from polar.integrations.stripe.service import ProductUpdateKwargs, StripeError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.models import (
    Account,
    Organization,
    Repository,
    SubscriptionBenefit,
    SubscriptionTier,
    SubscriptionTierBenefit,
    User,
    UserOrganization,
)
from polar.models.subscription_tier import SubscriptionTierType
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service
from polar.worker import enqueue_job

from ..schemas import SubscriptionTierCreate, SubscriptionTierUpdate
from .subscription_benefit import subscription_benefit as subscription_benefit_service


class SubscriptionTierError(PolarError):
    ...


class OrganizationDoesNotExist(SubscriptionTierError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Organization with id {organization_id} does not exist."
        super().__init__(message, 422)


class RepositoryDoesNotExist(SubscriptionTierError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Repository with id {organization_id} does not exist."
        super().__init__(message, 422)


class SubscriptionBenefitDoesNotExist(SubscriptionTierError):
    def __init__(self, subscription_benefit_id: uuid.UUID) -> None:
        self.subscription_benefit_id = subscription_benefit_id
        message = (
            f"Subscription benefit with id {subscription_benefit_id} does not exist."
        )
        super().__init__(message, 422)


class SubscriptionBenefitIsNotSelectable(SubscriptionTierError):
    def __init__(self, subscription_benefit_id: uuid.UUID) -> None:
        self.subscription_benefit_id = subscription_benefit_id
        message = (
            f"Subscription benefit with id {subscription_benefit_id} "
            "cannot be added or removed."
        )
        super().__init__(message, 422)


class FreeTierIsNotArchivable(SubscriptionTierError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = "The Free Subscription Tier is not archivable"
        super().__init__(message, 403)


class SubscriptionTierService(
    ResourceService[SubscriptionTier, SubscriptionTierCreate, SubscriptionTierUpdate]
):
    async def search(
        self,
        session: AsyncSession,
        auth_subject: Subject,
        *,
        type: SubscriptionTierType | None = None,
        organization: Organization | None = None,
        repository: Repository | None = None,
        direct_organization: bool = True,
        include_archived: bool = False,
        pagination: PaginationParams,
    ) -> tuple[Sequence[SubscriptionTier], int]:
        statement = self._get_readable_subscription_tier_statement(auth_subject)

        if type is not None:
            statement = statement.where(SubscriptionTier.type == type)

        if organization is not None:
            clauses = [SubscriptionTier.organization_id == organization.id]
            if not direct_organization:
                clauses.append(Repository.organization_id == organization.id)
            statement = statement.where(or_(*clauses))

        if repository is not None:
            statement = statement.where(SubscriptionTier.repository_id == repository.id)

        if not include_archived:
            statement = statement.where(SubscriptionTier.is_archived.is_(False))

        statement = statement.order_by(
            case(
                (SubscriptionTier.type == SubscriptionTierType.free, 1),
                (SubscriptionTier.type == SubscriptionTierType.individual, 2),
                (SubscriptionTier.type == SubscriptionTierType.business, 3),
            ),
            SubscriptionTier.price_amount,
            SubscriptionTier.created_at,
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_by_id(
        self, session: AsyncSession, auth_subject: Subject, id: uuid.UUID
    ) -> SubscriptionTier | None:
        statement = (
            self._get_readable_subscription_tier_statement(auth_subject)
            .where(SubscriptionTier.id == id, SubscriptionTier.deleted_at.is_(None))
            .options(
                contains_eager(SubscriptionTier.organization),
                contains_eager(SubscriptionTier.repository),
            )
            .limit(1)
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_free(
        self,
        session: AsyncSession,
        *,
        organization: Organization | None = None,
        repository: Repository | None = None,
    ) -> SubscriptionTier | None:
        return await self.get_by(
            session,
            type=SubscriptionTierType.free,
            organization_id=organization.id if organization else None,
            repository_id=repository.id if repository else None,
        )

    async def get_by_stripe_product_id(
        self, session: AsyncSession, stripe_product_id: str
    ) -> SubscriptionTier | None:
        return await self.get_by(session, stripe_product_id=stripe_product_id)

    async def user_create(
        self,
        session: AsyncSession,
        authz: Authz,
        create_schema: SubscriptionTierCreate,
        user: User,
    ) -> SubscriptionTier:
        organization: Organization | None = None
        repository: Repository | None = None
        if create_schema.organization_id is not None:
            organization = await organization_service.get(
                session, create_schema.organization_id
            )
            if organization is None or not await authz.can(
                user, AccessType.write, organization
            ):
                raise OrganizationDoesNotExist(create_schema.organization_id)

        if create_schema.repository_id is not None:
            repository = await repository_service.get(
                session, create_schema.repository_id
            )
            if repository is None or not await authz.can(
                user, AccessType.write, repository
            ):
                raise RepositoryDoesNotExist(create_schema.repository_id)

        nested = await session.begin_nested()

        if create_schema.is_highlighted:
            await self._disable_other_highlights(
                session,
                type=create_schema.type,
                organization_id=create_schema.organization_id,
                repository_id=create_schema.repository_id,
            )

        subscription_tier = SubscriptionTier(
            organization=organization,
            repository=repository,
            subscription_tier_benefits=[],
            **create_schema.model_dump(exclude={"organization_id", "repository_id"}),
        )
        session.add(subscription_tier)
        await session.flush()
        assert subscription_tier.id is not None

        try:
            metadata: dict[str, str] = {
                "subscription_tier_id": str(subscription_tier.id)
            }
            if organization is not None:
                metadata["organization_id"] = str(organization.id)
                metadata["organization_name"] = organization.name
            if repository is not None:
                metadata["repository_id"] = str(repository.id)
                metadata["repository_name"] = repository.name

            product = stripe_service.create_product_with_price(
                subscription_tier.get_stripe_name(),
                price_amount=subscription_tier.price_amount,
                price_currency=subscription_tier.price_currency,
                description=subscription_tier.description,
                metadata=metadata,
            )
        except StripeError:
            await nested.rollback()
            raise

        subscription_tier.stripe_product_id = product.id
        assert product.default_price is not None
        subscription_tier.stripe_price_id = get_expandable_id(product.default_price)

        await session.commit()
        return subscription_tier

    async def user_update(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier: SubscriptionTier,
        update_schema: SubscriptionTierUpdate,
        user: User,
    ) -> SubscriptionTier:
        subscription_tier = await self.with_organization_or_repository(
            session, subscription_tier
        )

        if not await authz.can(user, AccessType.write, subscription_tier):
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

        if (
            update_schema.price_amount is not None
            and subscription_tier.stripe_product_id is not None
            and subscription_tier.stripe_price_id is not None
            and update_schema.price_amount != subscription_tier.price_amount
        ):
            new_price = stripe_service.create_price_for_product(
                subscription_tier.stripe_product_id,
                update_schema.price_amount,
                subscription_tier.price_currency,
                set_default=True,
            )
            stripe_service.archive_price(subscription_tier.stripe_price_id)
            subscription_tier.stripe_price_id = new_price.id

        if update_schema.is_highlighted:
            await self._disable_other_highlights(
                session,
                type=subscription_tier.type,
                organization_id=subscription_tier.organization_id,
                repository_id=subscription_tier.repository_id,
            )

        for attr, value in update_schema.model_dump(
            exclude_unset=True, exclude_none=True
        ).items():
            setattr(subscription_tier, attr, value)

        session.add(subscription_tier)
        return subscription_tier

    async def create_free(
        self,
        session: AsyncSession,
        benefits: list[SubscriptionBenefit],
        organization: Organization | None = None,
        repository: Repository | None = None,
    ) -> SubscriptionTier:
        free_subscription_tier = await self.get_free(
            session, organization=organization, repository=repository
        )

        # create if does not exist
        if free_subscription_tier is None:
            free_subscription_tier = SubscriptionTier(
                type=SubscriptionTierType.free,
                name="Free",
                price_amount=0,
                price_currency="usd",
                organization_id=organization.id if organization else None,
                repository_id=repository.id if repository else None,
            )

        existing_benefits = [
            str(b.subscription_benefit_id)
            for b in free_subscription_tier.subscription_tier_benefits
        ]

        for index, benefit in enumerate(benefits):
            # this benefit is already attached to this tier
            if str(benefit.id) in existing_benefits:
                continue

            free_subscription_tier.subscription_tier_benefits.append(
                SubscriptionTierBenefit(subscription_benefit=benefit, order=index)
            )

        session.add(free_subscription_tier)
        await session.commit()

        await enqueue_job(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            free_subscription_tier.id,
        )

        return free_subscription_tier

    async def update_benefits(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier: SubscriptionTier,
        benefits: list[uuid.UUID],
        user: User,
    ) -> tuple[SubscriptionTier, set[SubscriptionBenefit], set[SubscriptionBenefit]]:
        subscription_tier = await self.with_organization_or_repository(
            session, subscription_tier
        )
        if not await authz.can(user, AccessType.write, subscription_tier):
            raise NotPermitted()

        previous_benefits = set(subscription_tier.benefits)
        new_benefits: set[SubscriptionBenefit] = set()

        nested = await session.begin_nested()

        subscription_tier.subscription_tier_benefits = []
        await session.flush()

        for order, subscription_benefit_id in enumerate(benefits):
            subscription_benefit = await subscription_benefit_service.get_by_id(
                session, user, subscription_benefit_id
            )
            if subscription_benefit is None:
                await nested.rollback()
                raise SubscriptionBenefitDoesNotExist(subscription_benefit_id)
            if (
                not subscription_benefit.selectable
                and subscription_benefit not in previous_benefits
            ):
                raise SubscriptionBenefitIsNotSelectable(subscription_benefit_id)
            new_benefits.add(subscription_benefit)
            subscription_tier.subscription_tier_benefits.append(
                SubscriptionTierBenefit(
                    subscription_benefit=subscription_benefit, order=order
                )
            )

        added_benefits = new_benefits - previous_benefits
        deleted_benefits = previous_benefits - new_benefits

        for deleted_benefit in deleted_benefits:
            if not deleted_benefit.selectable:
                raise SubscriptionBenefitIsNotSelectable(deleted_benefit.id)

        session.add(subscription_tier)
        await session.commit()

        await enqueue_job(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            subscription_tier.id,
        )

        return subscription_tier, added_benefits, deleted_benefits

    async def archive(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier: SubscriptionTier,
        user: User,
    ) -> SubscriptionTier:
        subscription_tier = await self.with_organization_or_repository(
            session, subscription_tier
        )
        if not await authz.can(user, AccessType.write, subscription_tier):
            raise NotPermitted()

        if subscription_tier.type == SubscriptionTierType.free:
            raise FreeTierIsNotArchivable(subscription_tier.id)

        if subscription_tier.stripe_product_id is not None:
            stripe_service.archive_product(subscription_tier.stripe_product_id)

        subscription_tier.is_archived = True
        session.add(subscription_tier)
        return subscription_tier

    async def with_organization_or_repository(
        self, session: AsyncSession, subscription_tier: SubscriptionTier
    ) -> SubscriptionTier:
        try:
            subscription_tier.organization
            subscription_tier.repository
        except InvalidRequestError:
            await session.refresh(subscription_tier, {"organization", "repository"})
        return subscription_tier

    def _get_readable_subscription_tier_statement(
        self, auth_subject: Subject
    ) -> Select[Any]:
        RepositoryOrganization = aliased(Organization)
        RepositoryUserOrganization = aliased(UserOrganization)

        private_repositories_clauses: list[ColumnExpressionArgument[bool]] = [
            SubscriptionTier.repository_id.is_(None),
            Repository.is_private.is_(False),
        ]
        if isinstance(auth_subject, User):
            private_repositories_clauses.append(
                RepositoryUserOrganization.user_id == auth_subject.id
            )

        archived_clauses: list[ColumnExpressionArgument[bool]] = [
            SubscriptionTier.is_archived.is_(False)
        ]
        if isinstance(auth_subject, User):
            archived_clauses.append(UserOrganization.user_id == auth_subject.id)

        return (
            select(SubscriptionTier)
            .join(SubscriptionTier.organization, full=True)
            .join(SubscriptionTier.repository, full=True)
            .join(
                UserOrganization,
                onclause=UserOrganization.organization_id
                == SubscriptionTier.organization_id,
                full=True,
            )
            .join(
                RepositoryOrganization,
                onclause=RepositoryOrganization.id == Repository.organization_id,
                full=True,
            )
            .join(
                RepositoryUserOrganization,
                onclause=RepositoryUserOrganization.organization_id
                == RepositoryOrganization.id,
                full=True,
            )
            .where(
                # Prevent to return `None` objects due to the full outer join
                SubscriptionTier.id.is_not(None),
                SubscriptionTier.deleted_at.is_(None),
                or_(*private_repositories_clauses),
                or_(*archived_clauses),
            )
        )

    async def get_managing_organization_account(
        self, session: AsyncSession, subscription_tier: SubscriptionTier
    ) -> Account | None:
        return await account_service.get_by_organization_id(
            session, subscription_tier.managing_organization_id
        )

    async def _disable_other_highlights(
        self,
        session: AsyncSession,
        *,
        type: SubscriptionTierType,
        organization_id: uuid.UUID | None = None,
        repository_id: uuid.UUID | None = None,
    ) -> None:
        statement = (
            update(SubscriptionTier)
            .where(SubscriptionTier.type == type)
            .values(is_highlighted=False)
        )

        if organization_id is not None:
            statement = statement.where(
                SubscriptionTier.organization_id == organization_id
            )

        if repository_id is not None:
            statement = statement.where(SubscriptionTier.repository_id == repository_id)

        await session.execute(statement)


subscription_tier = SubscriptionTierService(SubscriptionTier)
