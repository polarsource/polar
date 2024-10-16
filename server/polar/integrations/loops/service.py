from typing import Unpack

from polar.models import Organization, Product, User
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .client import Properties


class Loops:
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

        properties = self.get_updated_user_properties(
            user,
            {
                "organizationCreated": False,
                "organizationCount": 0,
                **properties,
            },
        )
        enqueue_job("loops.send_event", user.email, "User Signed Up", **properties)

    async def user_update(self, user: User, **properties: Unpack[Properties]) -> None:
        properties = self.get_updated_user_properties(user, properties)
        enqueue_job("loops.update_contact", user.email, str(user.id), **properties)

    async def add_user_organization(
        self,
        session: AsyncSession,
        *,
        user: User,
        organization: Organization,
    ) -> None:
        user_organizations = await user_organization_service.list_by_user_id(
            session, user.id
        )
        properties = self.get_updated_user_properties(
            user,
            {
                "organizationCreated": True,
                "organizationSlug": organization.slug,
                "organizationCount": len(user_organizations),
            },
        )
        enqueue_job(
            "loops.send_event", user.email, "Organization Created", **properties
        )

    async def user_product_created(
        self,
        user: User,
        product: Product,
    ) -> None:
        properties = self.get_updated_user_properties(
            user,
            {
                "productCreated": True,
            },
        )
        enqueue_job("loops.send_event", user.email, "Product Created", **properties)

    async def user_created_personal_access_token(
        self,
        user: User,
    ) -> None:
        properties = self.get_updated_user_properties(
            user,
            {
                "userPatCreated": True,
            },
        )
        enqueue_job("loops.send_event", user.email, "User PAT Created", **properties)

    async def user_enabled_storefront(
        self,
        user: User,
    ) -> None:
        properties = self.get_updated_user_properties(
            user,
            {
                "storefrontEnabled": True,
            },
        )
        enqueue_job("loops.send_event", user.email, "Storefront Enabled", **properties)


loops = Loops()

__all__ = ["loops"]
