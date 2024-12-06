import contextlib
import uuid
from collections.abc import AsyncGenerator, Sequence
from typing import Any, cast

from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.locker import Locker
from polar.models import (
    ArticlesSubscription,
    Benefit,
    BenefitGrant,
    Customer,
    Organization,
    User,
)
from polar.models.benefit import BenefitArticles, BenefitArticlesProperties, BenefitType
from polar.models.benefit_grant import BenefitGrantArticlesProperties

from .base import BenefitServiceProtocol


class BenefitArticlesService(
    BenefitServiceProtocol[
        BenefitArticles, BenefitArticlesProperties, BenefitGrantArticlesProperties
    ]
):
    async def grant(
        self,
        benefit: BenefitArticles,
        customer: Customer,
        grant_properties: BenefitGrantArticlesProperties,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> BenefitGrantArticlesProperties:
        # This benefit will be deleted before this PR lands, no need to update the logic

        return {}

    async def revoke(
        self,
        benefit: BenefitArticles,
        customer: Customer,
        grant_properties: BenefitGrantArticlesProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantArticlesProperties:
        # This benefit will be deleted before this PR lands, no need to update the logic

        return {}

    async def requires_update(
        self,
        benefit: BenefitArticles,
        previous_properties: BenefitArticlesProperties,
    ) -> bool:
        return False

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitArticlesProperties:
        return cast(BenefitArticlesProperties, properties)

    async def _get_articles_subscription(
        self, user_id: uuid.UUID, organization_id: uuid.UUID
    ) -> ArticlesSubscription | None:
        statement = select(ArticlesSubscription).where(
            ArticlesSubscription.user_id == user_id,
            ArticlesSubscription.organization_id == organization_id,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def _get_articles_grants(
        self, customer_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Sequence[BenefitGrant]:
        statement = (
            select(BenefitGrant)
            .join(BenefitGrant.benefit)
            .where(
                BenefitGrant.customer_id == customer_id,
                BenefitGrant.is_granted.is_(True),
                Benefit.type == BenefitType.articles,
                Benefit.organization_id == organization_id,
            )
        )
        result = await self.session.execute(statement)
        return result.scalars().all()

    @contextlib.asynccontextmanager
    async def _acquire_lock(self, user: User) -> AsyncGenerator[None, None]:
        async with Locker(self.redis).lock(
            f"articles-{user.id}", timeout=1, blocking_timeout=2
        ):
            yield
