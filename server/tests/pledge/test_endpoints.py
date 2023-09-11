import uuid

import pytest
from httpx import AsyncClient

from polar.app import app
from polar.config import settings
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.pledge.schemas import PledgeState
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import create_issue


@pytest.mark.asyncio
async def test_get_pledge(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    issue: Issue,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/{pledge.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["id"] == str(pledge.id)
    assert response.json()["issue"]["id"] == str(issue.id)
    assert response.json()["issue"]["repository"]["id"] == str(repository.id)
    assert response.json()["issue"]["repository"]["organization"]["id"] == str(
        organization.id
    )


@pytest.mark.asyncio
async def test_get_pledge_not_admin(
    organization: Organization,
    pledging_organization: Organization,
    repository: Repository,
    pledge: Pledge,
    user: User,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = False
    await user_organization.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/{pledge.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_pledge_not_member(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/{pledge.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_search_pledge(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledge: Pledge,
    auth_jwt: str,
    session: AsyncSession,
    issue: Issue,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/search?platform=github&organization_name={organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(pledge.id)
    assert response.json()["items"][0]["issue"]["id"] == str(issue.id)
    assert response.json()["items"][0]["issue"]["repository"]["id"] == str(
        repository.id
    )
    assert response.json()["items"][0]["issue"]["repository"]["organization"][
        "id"
    ] == str(organization.id)


@pytest.mark.asyncio
async def test_search_pledge_no_admin(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledge: Pledge,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = False
    await user_organization.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/search?platform=github&organization_name={organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_search_pledge_no_member(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/search?platform=github&organization_name={organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_search_pledge_by_issue_id(
    organization: Organization,
    pledging_organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledge: Pledge,
    auth_jwt: str,
    session: AsyncSession,
    issue: Issue,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    # create another issue and another pledge
    other_issue = await create_issue(
        session, organization=organization, repository=repository
    )

    other_pledge = await Pledge.create(
        session=session,
        id=uuid.uuid4(),
        by_organization_id=pledging_organization.id,
        issue_id=other_issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=50000,
        fee=50,
        state=PledgeState.created,
    )

    other_pledge_2 = await Pledge.create(
        session=session,
        id=uuid.uuid4(),
        by_organization_id=pledging_organization.id,
        issue_id=other_issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=50000,
        fee=50,
        state=PledgeState.created,
    )

    await session.commit()

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/search?issue_id={pledge.issue_id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(pledge.id)
    assert response.json()["items"][0]["issue"]["id"] == str(issue.id)
    assert response.json()["items"][0]["issue"]["repository"]["id"] == str(
        repository.id
    )
    assert response.json()["items"][0]["issue"]["repository"]["organization"][
        "id"
    ] == str(organization.id)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/search?issue_id={other_issue.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 2
    assert response.json()["items"][0]["id"] == str(other_pledge.id)
    assert response.json()["items"][0]["issue"]["id"] == str(other_issue.id)
    assert response.json()["items"][1]["id"] == str(other_pledge_2.id)
    assert response.json()["items"][1]["issue"]["id"] == str(other_issue.id)


@pytest.mark.asyncio
async def test_search_no_params(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/pledges/search",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "No search criteria specified"}
