from typing import Any, Unpack

from polar.models import Issue, Organization, User
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .client import Properties


class Loops:
    def get_user_base_properties(self, user: User) -> dict[str, Any]:
        signup_intent = user.signup_attribution.get("intent")
        return {
            "userGroup": "creator",
            "signupIntent": signup_intent,
        }

    async def user_signup(
        self,
        user: User,
        **properties: Unpack[Properties],
    ) -> None:
        # Only create contacts for creators on signup.
        # Others can be created later on upon first creator events (flywheel)
        signup_intent = user.signup_attribution.get("intent")
        if signup_intent != "creator":
            return

        user_properties = self.get_user_base_properties(user)
        properties = {
            "userId": str(user.id),
            "organizationInstalled": False,
            "repositoryInstalled": False,
            "issueBadged": False,
            **properties,
        }
        user_properties.update(properties)
        enqueue_job("loops.send_event", user.email, "User Signed Up", **user_properties)

    async def user_update(self, user: User, **properties: Unpack[Properties]) -> None:
        user_properties = self.get_user_base_properties(user)
        user_properties.update(properties)
        enqueue_job("loops.update_contact", user.email, str(user.id), **user_properties)

    async def organization_installed(
        self, session: AsyncSession, *, user: User
    ) -> None:
        organization_users = await user_organization_service.list_by_user_id(
            session, user.id
        )
        enqueue_job(
            "loops.send_event",
            user.email,
            "Organization Installed",
            userId=str(user.id),
            isMaintainer=True,
            organizationInstalled=True,
            firstOrganizationName=organization_users[0].organization.slug,
        )

    async def repository_installed_on_organization(
        self, session: AsyncSession, *, organization: Organization
    ) -> None:
        for organization_user in await user_organization_service.list_by_org(
            session, organization.id
        ):
            user = organization_user.user
            enqueue_job(
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
            enqueue_job(
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
