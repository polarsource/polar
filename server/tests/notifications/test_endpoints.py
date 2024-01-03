import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/notifications",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
