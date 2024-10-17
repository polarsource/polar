from typing import Unpack

from polar.models import User
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
        **properties: Unpack[Properties],
    ) -> None:
        # Only create contacts for creators on signup.
        # Others can be created later on upon first creator events (flywheel)
        signup_intent = user.signup_attribution.get("intent")
        if signup_intent != "creator":
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
                "storefrontEnabled": False,
                **properties,
            },
        )

    async def user_update(self, user: User, **properties: Unpack[Properties]) -> None:
        properties = self.get_updated_user_properties(user, properties)
        enqueue_job("loops.update_contact", user.email, str(user.id), **properties)

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

    async def user_created_personal_access_token(self, user: User) -> None:
        await self.enqueue_event(
            user,
            event="User PAT Created",
            properties={
                "userPatCreated": True,
            },
        )

    async def user_enabled_storefront(self, user: User) -> None:
        await self.enqueue_event(
            user,
            event="Storefront Enabled",
            properties={
                "storefrontEnabled": True,
            },
        )

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
