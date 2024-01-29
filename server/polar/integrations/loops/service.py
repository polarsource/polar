from typing import Unpack

from polar.enums import UserSignupType
from polar.models import Issue, Organization, User
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .client import Properties


class Loops:
    async def user_signup(
        self,
        user: User,
        signup_type: UserSignupType | None = None,
        **properties: Unpack[Properties],
    ) -> None:
        if signup_type == UserSignupType.imported:
            return

        properties = {
            "isMaintainer": False,
            "isBacker": False,
            "gitHubConnected": False,
            "organizationInstalled": False,
            "repositoryInstalled": False,
            "issueBadged": False,
            "userId": str(user.id),
            **properties,
        }
        if signup_type is not None:
            properties["isMaintainer"] = signup_type == UserSignupType.maintainer
            properties["isBacker"] = signup_type == UserSignupType.backer

        await enqueue_job(
            "loops.send_event", user.email, "User Signed Up", **properties
        )

    async def user_update(self, user: User, **properties: Unpack[Properties]) -> None:
        await enqueue_job(
            "loops.update_contact", user.email, str(user.id), **properties
        )

    async def organization_installed(
        self, session: AsyncSession, *, user: User
    ) -> None:
        organization_users = await user_organization_service.list_by_user_id(
            session, user.id
        )
        await enqueue_job(
            "loops.send_event",
            user.email,
            "Organization Installed",
            userId=str(user.id),
            isMaintainer=True,
            organizationInstalled=True,
            firstOrganizationName=organization_users[0].organization.name,
        )

    async def repository_installed_on_organization(
        self, session: AsyncSession, *, organization: Organization
    ) -> None:
        for organization_user in await user_organization_service.list_by_org(
            session, organization.id
        ):
            user = organization_user.user
            await enqueue_job(
                "loops.send_event",
                user.email,
                "Repository Installed",
                userId=str(user.id),
                isMaintainer=True,
                organizationInstalled=True,
                repositoryInstalled=True,
            )

    async def issue_badged(self, session: AsyncSession, *, issue: Issue) -> None:
        for organization_user in await user_organization_service.list_by_org(
            session, issue.organization_id
        ):
            user = organization_user.user
            await enqueue_job(
                "loops.send_event",
                user.email,
                "Issue Badged",
                userId=str(user.id),
                isMaintainer=True,
                organizationInstalled=True,
                repositoryInstalled=True,
                issueBadged=True,
            )


loops = Loops()

__all__ = ["loops"]
