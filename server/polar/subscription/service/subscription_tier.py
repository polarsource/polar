import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import ColumnExpressionArgument, Select, or_, select, update
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import aliased, contains_eager

from polar.account.service import account as account_service
from polar.auth.dependencies import AuthMethod
from polar.authz.service import AccessType, Authz, Subject
from polar.exceptions import NotPermitted, PolarError
from polar.integrations.stripe.service import ProductUpdateKwargs, StripeError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.models import (
    Account,
    Organization,
    Repository,
    SubscriptionTier,
    User,
    UserOrganization,
)
from polar.models.subscription_tier import SubscriptionTierType
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service

from ..schemas import SubscribeSession, SubscriptionTierCreate, SubscriptionTierUpdate


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


class ArchivedSubscriptionTier(SubscriptionTierError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = "This subscription tier is archived."
        super().__init__(message, 404)


class NotAddedToStripeSubscriptionTier(SubscriptionTierError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = "This subscription tier has not beed synced with Stripe."
        super().__init__(message, 500)


class NoAssociatedPayoutAccount(SubscriptionTierError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization = organization_id
        message = (
            "A payout account should be configured for this organization "
            "before being able to accept subscriptions."
        )
        super().__init__(message, 400)


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
        show_archived: bool = False,
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

        if not show_archived:
            statement = statement.where(SubscriptionTier.is_archived.is_(False))

        statement = statement.order_by(
            SubscriptionTier.type,
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
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

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

        subscription_tier = await self.model.create(
            session,
            organization=organization,
            repository=repository,
            **create_schema.dict(exclude={"organization_id", "repository_id"}),
            autocommit=False,
        )
        await session.flush()
        assert subscription_tier.id is not None

        try:
            product = stripe_service.create_product_with_price(
                subscription_tier.get_stripe_name(),
                price_amount=subscription_tier.price_amount,
                price_currency=subscription_tier.price_currency,
                description=subscription_tier.description,
                metadata={
                    "subscription_tier_id": str(subscription_tier.id),
                    "organization_id": str(subscription_tier.organization_id),
                    "organization_name": organization.name
                    if organization is not None
                    else None,
                    "repository_id": str(subscription_tier.repository_id),
                    "repository_name": repository.name
                    if repository is not None
                    else None,
                },
            )
        except StripeError:
            await nested.rollback()
            raise

        subscription_tier.stripe_product_id = product.stripe_id
        subscription_tier.stripe_price_id = product.default_price

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
        subscription_tier = await self._with_organization_or_repository(
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
            subscription_tier.stripe_price_id = new_price.stripe_id

        if update_schema.is_highlighted:
            await self._disable_other_highlights(
                session,
                type=subscription_tier.type,
                organization_id=subscription_tier.organization_id,
                repository_id=subscription_tier.repository_id,
            )

        return await subscription_tier.update(
            session, **update_schema.dict(exclude_unset=True)
        )

    async def archive(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier: SubscriptionTier,
        user: User,
    ) -> SubscriptionTier:
        subscription_tier = await self._with_organization_or_repository(
            session, subscription_tier
        )
        if not await authz.can(user, AccessType.write, subscription_tier):
            raise NotPermitted()

        if subscription_tier.stripe_product_id is not None:
            stripe_service.archive_product(subscription_tier.stripe_product_id)

        return await subscription_tier.update(session, is_archived=True)

    async def create_subscribe_session(
        self,
        session: AsyncSession,
        subscription_tier: SubscriptionTier,
        success_url: str,
        auth_subject: Subject,
        auth_method: AuthMethod | None,
        *,
        customer_email: str | None = None,
    ) -> SubscribeSession:
        subscription_tier = await self._with_organization_or_repository(
            session, subscription_tier
        )

        if subscription_tier.is_archived:
            raise ArchivedSubscriptionTier(subscription_tier.id)

        if subscription_tier.stripe_price_id is None:
            raise NotAddedToStripeSubscriptionTier(subscription_tier.id)

        account = await self._get_managing_organization_account(
            session, subscription_tier
        )
        if account is None:
            raise NoAssociatedPayoutAccount(subscription_tier.managing_organization_id)

        customer_options: dict[str, str] = {}
        # Set the customer only from a cookie-based authentication!
        # With the PAT, it's probably a call from the maintainer who wants to redirect
        # the backer they bring from their own website.
        if (
            auth_method == AuthMethod.COOKIE
            and isinstance(auth_subject, User)
            and auth_subject.stripe_customer_id is not None
        ):
            customer_options["customer"] = auth_subject.stripe_customer_id
        elif customer_email is not None:
            customer_options["customer_email"] = customer_email

        metadata: dict[str, str] = {"subscription_tier_id": str(subscription_tier.id)}

        checkout_session = stripe_service.create_subscription_checkout_session(
            subscription_tier.stripe_price_id,
            success_url,
            **customer_options,
            metadata=metadata,
        )

        return SubscribeSession.from_db(checkout_session, subscription_tier)

    async def get_subscribe_session(
        self, session: AsyncSession, id: str
    ) -> SubscribeSession:
        checkout_session = stripe_service.get_checkout_session(id)

        subscription_tier_id = checkout_session.metadata["subscription_tier_id"]
        subscription_tier = await self.get(session, uuid.UUID(subscription_tier_id))
        assert subscription_tier is not None
        subscription_tier = await self._with_organization_or_repository(
            session, subscription_tier
        )

        return SubscribeSession.from_db(checkout_session, subscription_tier)

    async def _with_organization_or_repository(
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

    async def _get_managing_organization_account(
        self, session: AsyncSession, subscription_tier: SubscriptionTier
    ) -> Account | None:
        return await account_service.get_by_org(
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
