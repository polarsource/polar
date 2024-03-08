import pytest

from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.pledge.service import pledge
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
@pytest.mark.parametrize(
    "test_amount",
    [1010, 12345678999],
)
async def test_pledge(
    session: AsyncSession,
    save_fixture: SaveFixture,
    test_amount: str,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    email = "alice@polar.sh"

    created = Pledge(
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        email=email,
        amount=int(test_amount),
        fee=0,
    )
    await save_fixture(created)

    assert created.id is not None

    got = await pledge.get(session, created.id)
    assert got is not None
    assert got.email == email
    assert got.amount == int(test_amount)
