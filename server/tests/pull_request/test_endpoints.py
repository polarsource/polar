import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models import issue_reference
from polar.models.issue import Issue
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_search_references(
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    pull_request: PullRequest,
    session: AsyncSession,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository.is_private = False
    await save_fixture(repository)

    ir = issue_reference.IssueReference(
        issue_id=issue.id,
        pull_request_id=pull_request.id,
        external_id=str(pull_request.id),
        reference_type=issue_reference.ReferenceType.PULL_REQUEST,
    )
    await save_fixture(ir)

    response = await client.get(
        f"/api/v1/pull_requests/search?references_issue_id={issue.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(pull_request.id)
