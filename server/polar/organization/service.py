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
from polar.kit.services import ResourceService
from polar.models import Organization, User, UserOrganization
from polar.postgres import AsyncSession, sql
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .schemas import (
    OrganizationCreate,
    OrganizationGitHubUpdate,
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


class OrganizationService(
    ResourceService[Organization, OrganizationCreate, OrganizationGitHubUpdate]
):
    async def create(
        self,
        session: AsyncSession,
        create_schema: OrganizationCreate,
    ) -> Organization:
        organization = Organization(
            platform=create_schema.platform,
            name=create_schema.name,
            avatar_url=create_schema.avatar_url,
            external_id=create_schema.external_id,
            is_personal=create_schema.is_personal,
            installation_id=create_schema.installation_id,
            installation_created_at=create_schema.installation_created_at,
            installation_updated_at=create_schema.installation_updated_at,
            installation_suspended_at=create_schema.installation_suspended_at,
            onboarded_at=create_schema.onboarded_at,
            pledge_minimum_amount=create_schema.pledge_minimum_amount,
            default_badge_custom_content=create_schema.default_badge_custom_content,
        )
        session.add(organization)
        await session.flush()
        return organization

    async def update(
        self,
        session: AsyncSession,
        source: Organization,
        update_schema: OrganizationGitHubUpdate,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        exclude_unset: bool = False,
    ) -> Organization:
        for k, v in update_schema.model_dump(
            include=include, exclude=exclude, exclude_unset=exclude_unset
        ).items():
            setattr(source, k, v)
        session.add(source)
        return source

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

        if settings.profile_settings is not None:
            organization.profile_settings = {
                **organization.profile_settings,
                **settings.profile_settings.model_dump(mode="json", exclude_unset=True),
            }

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
        self, session: AsyncSession, r: OrganizationCreate
    ) -> Organization:
        update_keys = {
            "name",
            "avatar_url",
            "is_personal",
            "installation_id",
            "installation_created_at",
            "installation_updated_at",
            "installation_suspended_at",
            "installation_permissions",
            "status",
            "pledge_badge_show_amount",
            "pledge_minimum_amount",
            "deleted_at",
        }

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
