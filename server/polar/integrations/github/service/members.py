from polar.integrations.github.service.organization import Member
from polar.models import Organization
from polar.models.user import OAuthAccount
from polar.models.user_organization import UserOrganization
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, sql
from polar.subscription.service.subscription import subscription as subscription_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .. import client as github
from .user import github_user as github_user_service


class GitHubMembersService:
    async def _fetch_members(
        self,
        org: Organization,
    ) -> list[Member]:
        client = github.get_app_installation_client(org.safe_installation_id)

        mems: list[Member] = []

        # GitHub has no API to list all members and their role.

        admins: set[int] = set()

        per_page = 50

        # First, we get all admins, and then we get all users
        for page in range(1, 1000):
            res = await client.rest.orgs.async_list_members(
                org.name,
                page=page,
                per_page=per_page,
                role="admin",
            )

            if len(res.parsed_data) == 0:
                break

            for m in res.parsed_data:
                mems.append(
                    Member(
                        external_id=m.id,
                        username=m.login,
                        avatar_url=m.avatar_url,
                        is_admin=True,
                    )
                )
                admins.add(m.id)

            if len(res.parsed_data) < per_page:
                break

        # ... then get all users, including admins, and filter away users that we already have!
        for page in range(1, 1000):
            res = await client.rest.orgs.async_list_members(
                org.name, page=page, per_page=per_page, role="all"
            )

            if len(res.parsed_data) == 0:
                break

            for m in res.parsed_data:
                if m.id in admins:
                    continue

                mems.append(
                    Member(
                        external_id=m.id,
                        username=m.login,
                        avatar_url=m.avatar_url,
                        is_admin=False,
                    )
                )

            if len(res.parsed_data) < per_page:
                break

        return mems

    async def synchronize_members(
        self, session: AsyncSession, org: Organization
    ) -> None:
        # get members from github
        github_members = await self._fetch_members(org)

        db_members_stmt = (
            sql.select(OAuthAccount)
            .where(
                UserOrganization.user_id == OAuthAccount.user_id,
                OAuthAccount.platform == "github",
                OAuthAccount.deleted_at.is_(None),
            )
            .where(
                UserOrganization.organization_id == org.id,
                UserOrganization.deleted_at.is_(None),
            )
        )

        res = await session.execute(db_members_stmt)
        db_members = res.scalars().unique().all()

        # add or update members from github
        for gh_m in github_members:
            # get user
            get_user = await github_user_service.get_user_by_github_id(
                session, gh_m.external_id
            )
            if not get_user:
                continue

            # add as member, or update admin status
            await organization_service.add_user(
                session, org, get_user, is_admin=gh_m.is_admin
            )

        # remove members that are members in our DB, but not a member on github
        github_user_ids: set[int] = set()
        for gh_m in github_members:
            github_user_ids.add(gh_m.external_id)

        for db_m in db_members:
            if int(db_m.account_id) in github_user_ids:
                continue

            await user_organization_service.remove_member(session, db_m.user_id, org.id)

        await subscription_service.update_organization_benefits_grants(session, org)


github_members_service = GitHubMembersService()
