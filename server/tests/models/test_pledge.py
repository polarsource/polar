import pytest

from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.pledge.service import pledge
from polar.postgres import AsyncSession


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "test_amount",
    [1010, 12345678999],
)
async def test_pledge(
    session: AsyncSession,
    test_amount: str,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    email = "alice@polar.sh"

    created = await Pledge(
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        email=email,
        amount=int(test_amount),
        fee=0,
    ).save(
        session,
    )

    assert created.id is not None

    await session.commit()
    await session.refresh(created)

    got = await pledge.get(session, created.id)
    assert got is not None
    assert got.email == email
    assert got.amount == int(test_amount)
