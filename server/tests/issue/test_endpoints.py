import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.config import settings
from polar.issue.schemas import Reactions
from polar.issue.service import issue as issue_service
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_issue(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository.is_private = False
    await save_fixture(repository)

    response = await client.get(
        f"/api/v1/issues/{issue.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["repository"]["id"] == str(repository.id)
    assert response.json()["repository"]["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_issue_reactions(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository.is_private = False
    await save_fixture(repository)

    issue.reactions = Reactions(
        total_count=3,
        plus_one=2,
        minus_one=0,
        laugh=0,
        hooray=0,
        confused=0,
        heart=1,
        rocket=0,
        eyes=0,
    ).model_dump(mode="json")
    await save_fixture(issue)

    response = await client.get(
        f"/api/v1/issues/{issue.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["reactions"]["plus_one"] == 2


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_not_found_private_repo(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository.is_private = True
    await save_fixture(repository)

    response = await client.get(
        f"/api/v1/issues/{issue.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_private_repo_member(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    save_fixture: SaveFixture,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    repository.is_private = True
    await save_fixture(repository)

    response = await client.get(
        f"/api/v1/issues/{issue.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_issue_search_public_repo(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository.is_private = False
    repository.is_archived = False
    await save_fixture(repository)

    response = await client.get(
        f"/api/v1/issues/search?platform=github&organization_name={organization.name}&repository_name={repository.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(issue.id)
    assert response.json()["items"][0]["repository"]["id"] == str(repository.id)
    assert response.json()["items"][0]["repository"]["organization"]["id"] == str(
        organization.id
    )


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_issue_search_public_repo_without_repo_selector(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository.is_private = False
    repository.is_archived = False
    await save_fixture(repository)

    response = await client.get(
        f"/api/v1/issues/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(issue.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_issue_search_private_repo(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository.is_private = True
    repository.is_archived = False
    await save_fixture(repository)

    response = await client.get(
        f"/api/v1/issues/search?platform=github&organization_name={organization.name}&repository_name={repository.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Repository not found"}


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_issue_search_private_repo_without_repo_selector(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository.is_private = True
    repository.is_archived = False
    await save_fixture(repository)

    response = await client.get(
        f"/api/v1/issues/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_update_funding_goal(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
    save_fixture: SaveFixture,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    # get, default value should be None
    response = await client.get(
        f"/api/v1/issues/{issue.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["funding"]["funding_goal"] is None

    # update value
    response = await client.post(
        f"/api/v1/issues/{issue.id}",
        json={"funding_goal": {"currency": "USD", "amount": 12000}},
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["funding"]["funding_goal"] == {
        "currency": "USD",
        "amount": 12000,
    }

    # get after post, should be persisted
    response = await client.get(
        f"/api/v1/issues/{issue.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["funding"]["funding_goal"] == {
        "currency": "USD",
        "amount": 12000,
    }


@pytest.mark.asyncio
async def test_confirm_solved(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    pledge: Pledge,
    session: AsyncSession,
    save_fixture: SaveFixture,
    user_organization: UserOrganization,  # makes User a member of Organization
    mocker: MockerFixture,
    client: AsyncClient,
    user: User,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    await issue_service.mark_confirmed_solved(session, issue.id, user.id)

    # fetch pledges
    pledges_response = await client.get(
        f"/api/v1/pledges/search?issue_id={pledge.issue_id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert pledges_response.status_code == 200
    assert len(pledges_response.json()["items"]) == 1
    assert pledges_response.json()["items"][0]["state"] == "created"

    # confirm as solved
    response = await client.post(
        f"/api/v1/issues/{issue.id}/confirm_solved",
        json={
            "splits": [
                {
                    "github_username": "zegl",
                    "share_thousands": 300,
                },
                {
                    "organization_id": str(organization.id),
                    "share_thousands": 700,
                },
            ]
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)

    # fetch pledges
    pledges_response = await client.get(
        f"/api/v1/pledges/search?issue_id={pledge.issue_id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert pledges_response.status_code == 200
    assert len(pledges_response.json()["items"]) == 1
    assert pledges_response.json()["items"][0]["state"] == "pending"
