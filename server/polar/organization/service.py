import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import Select, UnaryExpression, and_, asc, desc, false, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased, contains_eager

from polar.account.service import account as account_service
from polar.auth.models import Anonymous, AuthSubject, is_organization, is_user
from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, PolarError, PolarRequestValidationError
from polar.integrations.loops.service import loops as loops_service
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import (
    Donation,
    OAuthAccount,
    Order,
    Organization,
    Product,
    ProductPrice,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.product_price import ProductPriceAmountType
from polar.models.user import OAuthPlatform
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession, sql
from polar.posthog import posthog
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .auth import OrganizationsWrite
from .schemas import OrganizationCreate, OrganizationCustomerType, OrganizationUpdate
from .sorting import OrganizationSortProperty

log = structlog.get_logger()


class OrganizationError(PolarError): ...


class InvalidAccount(OrganizationError):
    def __init__(self, account_id: UUID) -> None:
        self.account_id = account_id
        message = (
            f"The account {account_id} does not exist "
            "or you don't have access to it."
        )
        super().__init__(message)


class OrganizationService(ResourceServiceReader[Organization]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Anonymous | User | Organization],
        *,
        slug: str | None = None,
        is_member: bool | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[OrganizationSortProperty]] = [
            (OrganizationSortProperty.created_at, False)
        ],
    ) -> tuple[Sequence[Organization], int]:
        statement = self._get_readable_organization_statement(auth_subject)

        if slug is not None:
            statement = statement.where(Organization.slug == slug)

        if is_member is not None:
            if is_user(auth_subject):
                user_organization_statement = select(
                    UserOrganization.organization_id
                ).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.deleted_at.is_(None),
                )
                if is_member:
                    statement = statement.where(
                        Organization.id.in_(user_organization_statement)
                    )
                else:
                    statement = statement.where(
                        Organization.id.not_in(user_organization_statement)
                    )
            elif is_organization(auth_subject):
                if is_member:
                    statement = statement.where(
                        Organization.id == auth_subject.subject.id
                    )
                else:
                    statement = statement.where(
                        Organization.id != auth_subject.subject.id
                    )
            else:
                if is_member:
                    statement = statement.where(false())

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == OrganizationSortProperty.created_at:
                order_by_clauses.append(clause_function(Organization.created_at))
            elif criterion == OrganizationSortProperty.name:
                order_by_clauses.append(clause_function(Organization.slug))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Anonymous | User | Organization],
        id: uuid.UUID,
    ) -> Organization | None:
        statement = self._get_readable_organization_statement(auth_subject).where(
            Organization.id == id
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def create(
        self,
        session: AsyncSession,
        create_schema: OrganizationCreate,
        auth_subject: AuthSubject[User],
    ) -> Organization:
        existing_slug = await self.get_by(session, slug=create_schema.slug)
        if existing_slug is not None:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body", "slug"),
                        "msg": "An organization with this slug already exists.",
                        "type": "value_error",
                        "input": create_schema.slug,
                    }
                ]
            )

        organization = Organization(**create_schema.model_dump(exclude_unset=True))
        session.add(organization)
        await self.add_user(session, organization, auth_subject.subject)

        enqueue_job("organization.created", organization_id=organization.id)

        posthog.auth_subject_event(
            auth_subject,
            "organizations",
            "create",
            "done",
            {
                "id": organization.id,
                "name": organization.name,
                "slug": organization.slug,
            },
        )
        return organization

    async def update(
        self,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        update_schema: OrganizationUpdate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Organization:
        subject = auth_subject.subject

        if not await authz.can(subject, AccessType.write, organization):
            raise NotPermitted()

        if organization.onboarded_at is None:
            organization.onboarded_at = datetime.now(UTC)

        enabled_storefront = False
        if update_schema.profile_settings is not None:
            storefront_enabled_before = organization.storefront_enabled
            organization.profile_settings = {
                **organization.profile_settings,
                **update_schema.profile_settings.model_dump(
                    mode="json", exclude_unset=True
                ),
            }
            enabled_storefront = (
                organization.storefront_enabled and not storefront_enabled_before
            )

        if update_schema.feature_settings is not None:
            organization.feature_settings = {
                **organization.feature_settings,
                **update_schema.feature_settings.model_dump(
                    mode="json", exclude_unset=True, exclude_none=True
                ),
            }

        update_dict = update_schema.model_dump(
            by_alias=True,
            exclude_unset=True,
            exclude={"profile_settings", "feature_settings"},
        )
        for key, value in update_dict.items():
            setattr(organization, key, value)

        session.add(organization)

        await self._after_update(session, organization)

        if enabled_storefront and is_user(auth_subject):
            user = auth_subject.subject
            await loops_service.user_enabled_storefront(user)

        return organization

    # Override get method to include `blocked_at` filter
    async def get(
        self,
        session: AsyncSession,
        id: UUID,
        allow_deleted: bool = False,
        *,
        options: Sequence[sql.ExecutableOption] | None = None,
    ) -> Organization | None:
        conditions = [Organization.id == id]
        if not allow_deleted:
            conditions.append(Organization.deleted_at.is_(None))

        conditions.append(Organization.blocked_at.is_(None))
        query = sql.select(Organization).where(*conditions)

        if options is not None:
            query = query.options(*options)

        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def list_all_orgs_by_user_id(
        self,
        session: AsyncSession,
        user_id: UUID,
        filter_by_name: str | None = None,
    ) -> Sequence[Organization]:
        statement = (
            sql.select(Organization)
            .join(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
            )
        )

        if filter_by_name:
            statement = statement.where(Organization.slug == filter_by_name)

        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def add_user(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = UserOrganization(
                user_id=user.id, organization_id=organization.id
            )
            session.add(relation)
            await session.flush()
            log.info(
                "organization.add_user.created",
                user_id=user.id,
                organization_id=organization.id,
            )
        except IntegrityError:
            # TODO: Currently, we treat this as success since the connection
            # exists. However, once we use status to distinguish active/inactive
            # installations we need to change this.
            log.info(
                "organization.add_user.already_exists",
                organization_id=organization.id,
                user_id=user.id,
            )
            await session.rollback()
            # Update
            stmt = (
                sql.Update(UserOrganization)
                .where(
                    UserOrganization.user_id == user.id,
                    UserOrganization.organization_id == organization.id,
                )
                .values(
                    deleted_at=None,  # un-delete user if exists
                )
            )
            await session.execute(stmt)
            await session.flush()
        finally:
            await loops_service.user_organization_added(
                session, organization=organization, user=user
            )

    async def set_account(
        self,
        session: AsyncSession,
        *,
        authz: Authz,
        auth_subject: OrganizationsWrite,
        organization: Organization,
        account_id: UUID,
    ) -> Organization:
        account = await account_service.get_by_id(session, account_id)
        if account is None:
            raise InvalidAccount(account_id)
        if not await authz.can(auth_subject.subject, AccessType.write, account):
            raise InvalidAccount(account_id)

        first_account_set = organization.account_id is None

        organization.account = account
        session.add(organization)
        await session.commit()

        if first_account_set:
            enqueue_job("organization.account_set", organization.id)

        await self._after_update(session, organization)

        return organization

    async def set_default_issue_badge_custom_message(
        self, session: AsyncSession, org: Organization, message: str
    ) -> Organization:
        stmt = (
            sql.update(Organization)
            .where(Organization.id == org.id)
            .values(default_badge_custom_content=message)
        )
        await session.execute(stmt)
        await session.commit()

        # update the in memory version as well
        org.default_badge_custom_content = message

        await self._after_update(session, org)

        return org

    async def list_customers(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        pagination: PaginationParams,
        customer_types: set[OrganizationCustomerType] = {
            OrganizationCustomerType.free_subscription,
            OrganizationCustomerType.paid_subscription,
            OrganizationCustomerType.order,
            OrganizationCustomerType.donation,
        },
    ) -> tuple[Sequence[User], int]:
        clauses = []

        def append_subscription_clause(is_free: bool | None = None) -> None:
            SubscriptionProduct = aliased(Product)
            SubscriptionProductPrice = aliased(ProductPrice)
            where = [
                Subscription.deleted_at.is_(None),
                SubscriptionProduct.organization_id == organization.id,
                Subscription.active.is_(True),
            ]
            if is_free is True:
                where.append(
                    SubscriptionProductPrice.amount_type == ProductPriceAmountType.free
                )
            elif is_free is False:
                where.append(
                    SubscriptionProductPrice.amount_type != ProductPriceAmountType.free
                )

            clauses.append(
                User.id.in_(
                    select(Subscription)
                    .with_only_columns(Subscription.user_id)
                    .join(
                        SubscriptionProduct,
                        onclause=SubscriptionProduct.id == Subscription.product_id,
                    )
                    .join(
                        SubscriptionProductPrice,
                        onclause=SubscriptionProductPrice.id == Subscription.price_id,
                    )
                    .where(*where)
                ),
            )

        if (
            OrganizationCustomerType.free_subscription in customer_types
            and OrganizationCustomerType.paid_subscription in customer_types
        ):
            append_subscription_clause()
        elif OrganizationCustomerType.free_subscription in customer_types:
            append_subscription_clause(is_free=True)
        elif OrganizationCustomerType.paid_subscription in customer_types:
            append_subscription_clause(is_free=False)

        if OrganizationCustomerType.order in customer_types:
            OrderProduct = aliased(Product)
            clauses.append(
                User.id.in_(
                    select(Order)
                    .with_only_columns(Order.user_id)
                    .join(OrderProduct, onclause=OrderProduct.id == Order.product_id)
                    .where(
                        Order.deleted_at.is_(None),
                        OrderProduct.organization_id == organization.id,
                        Order.subscription_id.is_(None),
                    )
                ),
            )

        if OrganizationCustomerType.donation in customer_types:
            clauses.append(
                User.id.in_(
                    select(Donation)
                    .with_only_columns(Donation.by_user_id)
                    .where(
                        Donation.deleted_at.is_(None),
                        Donation.to_organization_id == organization.id,
                    )
                ),
            )

        statement = (
            select(User)
            .join(
                OAuthAccount,
                onclause=and_(
                    User.id == OAuthAccount.user_id,
                    OAuthAccount.platform == OAuthPlatform.github,
                ),
                isouter=True,
            )
            .where(or_(*clauses))
            .order_by(
                # Put users with a GitHub account first, so we can display their avatar
                OAuthAccount.created_at.desc().nulls_last()
            )
            .options(contains_eager(User.oauth_accounts))
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def _after_update(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await webhook_service.send(
            session,
            target=organization,
            we=(WebhookEventType.organization_updated, organization),
        )

    def _get_readable_organization_statement(
        self, auth_subject: AuthSubject[Anonymous | User | Organization]
    ) -> Select[tuple[Organization]]:
        statement = select(Organization).where(
            Organization.deleted_at.is_(None), Organization.blocked_at.is_(None)
        )

        if is_organization(auth_subject):
            statement = statement.where(Organization.id == auth_subject.subject.id)

        return statement


organization = OrganizationService(Organization)
