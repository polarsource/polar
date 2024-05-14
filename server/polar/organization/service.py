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
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession, sql
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .schemas import (
    OrganizationCreateFromGitHubInstallation,
    OrganizationCreateFromGitHubUser,
    OrganizationUpdate,
)

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
    async def list_installed(self, session: AsyncSession) -> Sequence[Organization]:
        stmt = sql.select(Organization).where(
            Organization.deleted_at.is_(None),
            Organization.blocked_at.is_(None),
            Organization.installation_id.is_not(None),
        )
        res = await session.execute(stmt)
        return res.scalars().all()

    # Override get method to include `blocked_at` filter
    async def get(
        self, session: AsyncSession, id: UUID, allow_deleted: bool = False
    ) -> Organization | None:
        conditions = [Organization.id == id]
        if not allow_deleted:
            conditions.append(Organization.deleted_at.is_(None))

        conditions.append(Organization.blocked_at.is_(None))
        query = sql.select(Organization).where(*conditions)
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> Organization | None:
        # TODO: Also add deleted_at=None in a separate commit
        return await self.get_by(
            session,
            platform=platform,
            external_id=external_id,
            blocked_at=None,
        )

    async def get_by_name(
        self, session: AsyncSession, platform: Platforms, name: str
    ) -> Organization | None:
        # TODO: Also add deleted_at=None in a separate commit
        return await self.get_by(session, platform=platform, name=name, blocked_at=None)

    async def get_by_custom_domain(
        self, session: AsyncSession, custom_domain: str
    ) -> Organization | None:
        # TODO: Also add deleted_at=None in a separate commit
        query = sql.select(Organization).where(
            Organization.custom_domain == custom_domain,
            Organization.blocked_at.is_(None),
        )
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def get_personal(
        self, session: AsyncSession, user_id: UUID
    ) -> Organization | None:
        query = (
            sql.select(Organization)
            .join(UserOrganization)
            .where(
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
                Organization.is_personal.is_(True),
                UserOrganization.user_id == user_id,
                UserOrganization.deleted_at.is_(None),
            )
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
                Organization.blocked_at.is_(None),
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
        organization_update: OrganizationUpdate,
    ) -> Organization:
        if (
            organization_update.per_user_monthly_spending_limit
            and not organization.total_monthly_spending_limit
        ):
            raise BadRequest(
                "per_user_monthly_spending_limit requires total_monthly_spending_limit to be set"
            )

        if (
            organization_update.per_user_monthly_spending_limit is not None
            and organization.total_monthly_spending_limit is not None
            and organization_update.per_user_monthly_spending_limit
            > organization.total_monthly_spending_limit
        ):
            raise BadRequest(
                "per_user_monthly_spending_limit can not be higher than total_monthly_spending_limit"
            )

        if organization.onboarded_at is None:
            organization.onboarded_at = datetime.now(UTC)

        if organization_update.profile_settings is not None:
            organization.profile_settings = {
                **organization.profile_settings,
                **organization_update.profile_settings.model_dump(
                    mode="json", exclude_unset=True
                ),
            }

        if organization_update.feature_settings is not None:
            organization.feature_settings = {
                **organization.feature_settings,
                **organization_update.feature_settings.model_dump(
                    mode="json", exclude_unset=True, exclude_none=True
                ),
            }

        update_dict = organization_update.model_dump(
            by_alias=True,
            exclude_unset=True,
            exclude={"profile_settings", "feature_settings"},
        )
        for key, value in update_dict.items():
            setattr(organization, key, value)

        session.add(organization)

        log.info(
            "organization.update_settings",
            organization_id=organization.id,
            settings=organization_update.model_dump(mode="json"),
        )

        await self._after_update(session, organization)

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

        await self._after_update(session, organization)

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
        org = res.scalars().one()

        await self._after_update(session, org)

        return org

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


organization = OrganizationService(Organization)
