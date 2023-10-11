import pytest_asyncio

from polar.models import Organization, Repository, SubscriptionGroup
from polar.postgres import AsyncSession


async def create_subscription_group(
    session: AsyncSession,
    *,
    name: str = "Subscription Group",
    order: int = 1,
    organization: Organization | None = None,
    repository: Repository | None = None
) -> SubscriptionGroup:
    assert (organization is not None) != (repository is not None)
    subscription_group = SubscriptionGroup(
        name=name,
        order=order,
        organization_id=organization.id if organization is not None else None,
        repository_id=repository.id if repository is not None else None,
    )
    session.add(subscription_group)
    await session.commit()
    return subscription_group


@pytest_asyncio.fixture
async def subscription_group_organization(
    session: AsyncSession, organization: Organization
) -> SubscriptionGroup:
    return await create_subscription_group(session, organization=organization)


@pytest_asyncio.fixture
async def subscription_group_repository(
    session: AsyncSession, public_repository: Repository
) -> SubscriptionGroup:
    return await create_subscription_group(session, repository=public_repository)
