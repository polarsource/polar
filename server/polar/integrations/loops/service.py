from typing import Unpack

from polar.enums import AccountType
from polar.models import User
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .client import Properties


class Loops:
    #####################################################################
    # CREATOR-ONLY EVENTS: We can skip `is_creator` check on all below
    #####################################################################

    async def user_organization_added(self, session: AsyncSession, user: User) -> None:
        user_organizations = await user_organization_service.list_by_user_id(
            session, user.id
        )
        await self.enqueue_event(
            user,
            event="Organization Created",
            properties={
                "organizationCreated": True,
                # Always use the first organization.
                # Loops contacts are 1:1 with users vs. organizations so we can
                # only keep reference to one (main) organization to link to etc.
                "organizationSlug": user_organizations[0].organization.slug,
                "organizationCount": len(user_organizations),
            },
        )

    async def user_created_product(self, user: User) -> None:
        await self.enqueue_event(
            user,
            event="Product Created",
            properties={
                "productCreated": True,
            },
        )

    async def user_installed_github_organization(self, user: User) -> None:
        await self.enqueue_event(
            user,
            event="GitHub Organization Installed",
            properties={
                "githubOrgInstalled": True,
            },
        )

    async def user_badged_github_issue(self, user: User) -> None:
        await self.enqueue_event(
            user,
            event="GitHub Issue Badged",
            properties={
                "githubIssueBadged": True,
            },
        )

    #####################################################################
    # USER EVENTS: We have to check `is_creator`
    #####################################################################

    async def user_signup(
        self,
        user: User,
        **properties: Unpack[Properties],
    ) -> None:
        # Only create contacts for creators on signup.
        # Others can be created later on upon first creator events (flywheel)
        if not user.had_creator_signup_intent:
            return

        await self.enqueue_event(
            user,
            event="User Signed Up",
            properties={
                # Set login method in `properties` to override defaults (False)
                "emailLogin": False,
                "githubLogin": False,
                "googleLogin": False,
                "organizationCreated": False,
                "organizationCount": 0,
                "productCreated": False,
                "userPatCreated": False,
                "githubOrgInstalled": False,
                "githubIssueBadged": False,
                **properties,
            },
        )

    async def user_update(
        self, session: AsyncSession, user: User, **properties: Unpack[Properties]
    ) -> None:
        is_creator = await self.is_creator(session, user)
        if not is_creator:
            return

        properties = self.get_updated_user_properties(user, properties)
        enqueue_job("loops.update_contact", user.email, str(user.id), **properties)

    async def user_created_personal_access_token(
        self, session: AsyncSession, user: User
    ) -> None:
        is_creator = await self.is_creator(session, user)
        if not is_creator:
            return

        await self.enqueue_event(
            user,
            event="User PAT Created",
            properties={
                "userPatCreated": True,
            },
        )

    async def user_created_account(
        self, session: AsyncSession, user: User, accountType: AccountType
    ) -> None:
        is_creator = await self.is_creator(session, user)
        if not is_creator:
            return

        await self.enqueue_event(
            user,
            event="User Finance Account Created",
            properties={
                "accountType": accountType,
            },
        )

    #####################################################################
    # HELPERS
    #####################################################################

    async def is_creator(self, session: AsyncSession, user: User) -> bool:
        if user.had_creator_signup_intent:
            return True

        user_organization_count = (
            await user_organization_service.get_user_organization_count(
                session, user.id
            )
        )
        return user_organization_count > 0

    def get_updated_user_properties(
        self, user: User, properties: Properties
    ) -> Properties:
        signup_intent = user.signup_attribution.get("intent")
        updated: Properties = {
            "userId": str(user.id),
            "userGroup": "creator",
            "signupIntent": signup_intent or "",
        }
        updated.update(properties)
        return updated

    async def enqueue_event(
        self, user: User, *, event: str, properties: Properties
    ) -> None:
        properties = self.get_updated_user_properties(user, properties)
        enqueue_job("loops.send_event", user.email, event, **properties)


loops = Loops()

__all__ = ["loops"]
