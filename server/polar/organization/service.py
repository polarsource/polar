from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy.exc import IntegrityError

from polar.account.service import account as account_service
from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.exceptions import BadRequest, PolarError
from polar.integrations.loops.service import loops as loops_service
from polar.kit.services import ResourceServiceReader
from polar.models import Organization, User, UserOrganization
from polar.postgres import AsyncSession, sql
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .schemas import (
    OrganizationCreateFromGitHubInstallation,
    OrganizationCreateFromGitHubUser,
    OrganizationProfileSettings,
    OrganizationUpdate,
)

log = structlog.get_logger()


class OrganizationError(PolarError):
    ...


class InvalidAccount(OrganizationError):
    def __init__(self, account_id: UUID) -> None:
        self.account_id = account_id
        message = (
            f"The account {account_id} does not exist "
            "or you don't have access to it."
        )
        super().__init__(message)


class OrganizationService(ResourceServiceReader[Organization]):
    async def list_installed(self, session: AsyncSession) -> Sequence[Organization]:
        stmt = sql.select(Organization).where(
            Organization.deleted_at.is_(None),
            Organization.installation_id.is_not(None),
        )
        res = await session.execute(stmt)
        return res.scalars().all()

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> Organization | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def get_by_name(
        self, session: AsyncSession, platform: Platforms, name: str
    ) -> Organization | None:
        return await self.get_by(session, platform=platform, name=name)

    async def get_by_custom_domain(
        self, session: AsyncSession, custom_domain: str
    ) -> Organization | None:
        query = sql.select(Organization).where(
            Organization.custom_domain == custom_domain
        )
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def list_all_orgs_by_user_id(
        self,
        session: AsyncSession,
        user_id: UUID,
        is_admin_only: bool,
    ) -> Sequence[Organization]:
        statement = (
            sql.select(Organization)
            .join(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
            )
        )

        if is_admin_only:
            statement = statement.where(UserOrganization.is_admin.is_(True))

        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def add_user(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        is_admin: bool,
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = UserOrganization(
                user_id=user.id,
                organization_id=organization.id,
                is_admin=is_admin,
            )
            session.add(relation)
            await nested.commit()
            await session.commit()
            log.info(
                "organization.add_user.created",
                user_id=user.id,
                organization_id=organization.id,
                is_admin=is_admin,
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
            await nested.rollback()

            # Update
            stmt = (
                sql.Update(UserOrganization)
                .where(
                    UserOrganization.user_id == user.id,
                    UserOrganization.organization_id == organization.id,
                )
                .values(
                    is_admin=is_admin,
                    deleted_at=None,  # un-delete user if exists
                )
            )
            await session.execute(stmt)
            await session.commit()
        finally:
            await loops_service.organization_installed(session, user=user)

    async def update_settings(
        self,
        session: AsyncSession,
        organization: Organization,
        settings: OrganizationUpdate,
    ) -> Organization:
        if settings.billing_email is not None:
            organization.billing_email = settings.billing_email

        if organization.onboarded_at is None:
            organization.onboarded_at = datetime.now(UTC)

        if settings.set_default_upfront_split_to_contributors:
            organization.default_upfront_split_to_contributors = (
                settings.default_upfront_split_to_contributors
            )

        if settings.pledge_badge_show_amount is not None:
            organization.pledge_badge_show_amount = settings.pledge_badge_show_amount

        if settings.set_default_badge_custom_content:
            organization.default_badge_custom_content = (
                settings.default_badge_custom_content
            )

        if settings.pledge_minimum_amount is not None:
            organization.pledge_minimum_amount = settings.pledge_minimum_amount

        if settings.set_total_monthly_spending_limit:
            organization.total_monthly_spending_limit = (
                settings.total_monthly_spending_limit
            )

        if settings.set_per_user_monthly_spending_limit:
            if (
                settings.per_user_monthly_spending_limit
                and not organization.total_monthly_spending_limit
            ):
                raise BadRequest(
                    "per_user_monthly_spending_limit requires total_monthly_spending_limit to be set"
                )

            if (
                settings.per_user_monthly_spending_limit is not None
                and organization.total_monthly_spending_limit is not None
                and settings.per_user_monthly_spending_limit
                > organization.total_monthly_spending_limit
            ):
                raise BadRequest(
                    "per_user_monthly_spending_limit can not be higher than total_monthly_spending_limit"
                )

            organization.per_user_monthly_spending_limit = (
                settings.per_user_monthly_spending_limit
            )

        profile_settings = OrganizationProfileSettings.model_validate(
            organization.profile_settings
        )

        if settings.profile_settings is not None:
            if settings.profile_settings.set_description:
                profile_settings.description = (
                    settings.profile_settings.description.strip()
                    if settings.profile_settings.description is not None
                    else None
                )

            if settings.profile_settings.featured_projects is not None:
                profile_settings.featured_projects = (
                    settings.profile_settings.featured_projects
                )

            if settings.profile_settings.featured_organizations is not None:
                profile_settings.featured_organizations = (
                    settings.profile_settings.featured_organizations
                )

            organization.profile_settings = profile_settings.model_dump(mode="json")

        session.add(organization)

        log.info(
            "organization.update_settings",
            organization_id=organization.id,
            settings=settings.model_dump(mode="json"),
        )

        return organization

    async def set_account(
        self,
        session: AsyncSession,
        *,
        authz: Authz,
        user: User,
        organization: Organization,
        account_id: UUID,
    ) -> Organization:
        account = await account_service.get_by_id(session, account_id)
        if account is None:
            raise InvalidAccount(account_id)
        if not await authz.can(user, AccessType.write, account):
            raise InvalidAccount(account_id)

        first_account_set = organization.account_id is None

        organization.account = account
        session.add(organization)
        await session.commit()

        if first_account_set:
            enqueue_job("organization.account_set", organization.id)

        return organization

    async def set_personal_account(
        self, session: AsyncSession, *, organization: Organization
    ) -> Organization:
        if organization.is_personal and organization.account_id is None:
            user_admins = await user_organization_service.list_by_org(
                session, organization.id, is_admin=True
            )
            if len(user_admins) > 0:
                user_admin = user_admins[0]
                if user_admin.user.account_id is not None:
                    organization.account_id = user_admin.user.account_id
                    session.add(organization)
                    await session.commit()
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
        return org

    async def create_or_update(
        self,
        session: AsyncSession,
        r: OrganizationCreateFromGitHubInstallation | OrganizationCreateFromGitHubUser,
    ) -> Organization:
        update_keys = r.__annotations__.keys()

        insert_stmt = sql.insert(Organization).values(**r.model_dump())

        stmt = (
            insert_stmt.on_conflict_do_update(
                index_elements=[Organization.external_id],
                set_={k: getattr(insert_stmt.excluded, k) for k in update_keys},
            )
            .returning(Organization)
            .execution_options(populate_existing=True)
        )

        res = await session.execute(stmt)
        await session.commit()
        return res.scalars().one()


organization = OrganizationService(Organization)
