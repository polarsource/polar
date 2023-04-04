import pytest
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_create_pledge(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    # TODO
    pass
