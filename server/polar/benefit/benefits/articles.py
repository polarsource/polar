import contextlib
import uuid
from collections.abc import AsyncGenerator, Sequence
from typing import Any, cast

from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.locker import Locker
from polar.models import ArticlesSubscription, Benefit, BenefitGrant, Organization, User
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
        user: User,
        grant_properties: BenefitGrantArticlesProperties,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> BenefitGrantArticlesProperties:
        async with self._acquire_lock(user):
            organization_id = benefit.organization_id

            articles_subscription = await self._get_articles_subscription(
                user.id, organization_id
            )
            if articles_subscription is None:
                articles_subscription = ArticlesSubscription(
                    user_id=user.id, organization_id=organization_id
                )

            articles_subscription.deleted_at = None
            articles_subscription.paid_subscriber = benefit.properties["paid_articles"]
            self.session.add(articles_subscription)
            await self.session.commit()

        return {}

    async def revoke(
        self,
        benefit: BenefitArticles,
        user: User,
        grant_properties: BenefitGrantArticlesProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantArticlesProperties:
        async with self._acquire_lock(user):
            organization_id = benefit.organization_id

            articles_subscription = await self._get_articles_subscription(
                user.id, organization_id
            )
            if articles_subscription is not None:
                # Revoke only if there are no other grant giving access to those articles
                # Possible in case of Free -> Premium upgrade or multiple subscriptions
                articles_grants = await self._get_articles_grants(
                    user.id, organization_id
                )
                if len(articles_grants) == 1:
                    await self.session.delete(articles_subscription)
                    await self.session.commit()

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
        self, user_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Sequence[BenefitGrant]:
        statement = (
            select(BenefitGrant)
            .join(BenefitGrant.benefit)
            .where(
                BenefitGrant.user_id == user_id,
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
