import pytest
from fastapi.encoders import jsonable_encoder
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.app import app
from polar.config import settings
from polar.issue.schemas import Reactions
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization
from polar.pledge.schemas import PledgeState
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_get_issue(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    repository.is_private = False
    await repository.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/issues/{issue.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["repository"]["id"] == str(repository.id)
    assert response.json()["repository"]["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_get_issue_reactions(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    repository.is_private = False
    await repository.save(session)

    issue.reactions = jsonable_encoder(
        Reactions(
            total_count=3,
            plus_one=2,
            minus_one=0,
            laugh=0,
            hooray=0,
            confused=0,
            heart=1,
            rocket=0,
            eyes=0,
        )
    )
    await issue.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/issues/{issue.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["reactions"]["plus_one"] == 2


@pytest.mark.asyncio
async def test_get_not_found_private_repo(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    repository.is_private = True
    await repository.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/issues/{issue.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_private_repo_member(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
    user_organization: UserOrganization,  # makes User a member of Organization
) -> None:
    repository.is_private = True
    await repository.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/issues/{issue.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)


@pytest.mark.asyncio
async def test_issue_search_public_repo(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    repository.is_private = False
    repository.is_archived = False
    await repository.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
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
async def test_issue_search_public_repo_without_repo_selector(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    repository.is_private = False
    repository.is_archived = False
    await repository.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/issues/search?platform=github&organization_name={organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(issue.id)


@pytest.mark.asyncio
async def test_issue_search_private_repo(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    repository.is_private = True
    repository.is_archived = False
    await repository.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/issues/search?platform=github&organization_name={organization.name}&repository_name={repository.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 404
    assert response.json() == {"detail": "Repository not found"}


@pytest.mark.asyncio
async def test_issue_search_private_repo_without_repo_selector(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    repository.is_private = True
    repository.is_archived = False
    await repository.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
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
    user_organization: UserOrganization,  # makes User a member of Organization
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    # get, default value should be None
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/issues/{issue.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["funding"]["funding_goal"] is None

    # update value
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
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
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
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
    user_organization: UserOrganization,  # makes User a member of Organization
    mocker: MockerFixture,
) -> None:
    mocker.patch("polar.worker._enqueue_job")

    user_organization.is_admin = True
    await user_organization.save(session)

    await pledge_service.mark_confirmation_pending_by_issue_id(session, issue.id)

    # fetch pledges
    async with AsyncClient(app=app, base_url="http://test") as ac:
        pledges_response = await ac.get(
            f"/api/v1/pledges/search?issue_id={pledge.issue_id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    print(pledges_response.text)

    assert pledges_response.status_code == 200
    assert len(pledges_response.json()["items"]) == 1
    assert pledges_response.json()["items"][0]["state"] == "confirmation_pending"

    # confirm as solved
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
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

    print(response.text)

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)

    # fetch pledges
    async with AsyncClient(app=app, base_url="http://test") as ac:
        pledges_response = await ac.get(
            f"/api/v1/pledges/search?issue_id={pledge.issue_id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    print(pledges_response.text)

    assert pledges_response.status_code == 200
    assert len(pledges_response.json()["items"]) == 1
    assert pledges_response.json()["items"][0]["state"] == "pending"
