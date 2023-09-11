import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.pledge.schemas import PledgeState
from polar.postgres import AsyncSession


@pytest.mark.asyncio
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
        f"/api/v1/dashboard/github/{organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)


@pytest.mark.asyncio
async def test_get_personal(user: User, auth_jwt: str, client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/dashboard/personal",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_no_member(
    user: User,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_with_pledge(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    pledge: Pledge,
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)
    assert len(res["data"][0]["relationships"]["pledges"]["data"]) == 1
    rel_pledged = res["data"][0]["relationships"]["pledges"]["data"][0]

    pledges = [x for x in res["included"] if x["type"] == "pledge"]
    assert len(pledges) == 1
    assert pledges[0]["id"] == rel_pledged["id"]
    assert pledges[0]["attributes"]["pledger_name"] == pledging_organization.name


@pytest.mark.asyncio
async def test_get_with_pledge_initiated(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    pledge: Pledge,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
    client: AsyncClient,
) -> None:
    # assert that initiated pledges does not appear in the result
    pledge.state = PledgeState.initiated
    await pledge.save(session)

    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)

    assert "pledges" not in res["data"][0]["relationships"]

    pledges = [x for x in res["included"] if x["type"] == "pledge"]
    assert len(pledges) == 0


@pytest.mark.asyncio
async def test_get_only_pledged_with_pledge(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    pledge: Pledge,
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}?only_pledged=True",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)
    assert len(res["data"][0]["relationships"]["pledges"]["data"]) == 1
    rel_pledged = res["data"][0]["relationships"]["pledges"]["data"][0]

    pledges = [x for x in res["included"] if x["type"] == "pledge"]
    assert len(pledges) == 1
    assert pledges[0]["id"] == rel_pledged["id"]
    assert pledges[0]["attributes"]["pledger_name"] == pledging_organization.name


@pytest.mark.asyncio
async def test_get_only_pledged_no_pledge(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    # pledging_organization: Organization,
    # pledge: Pledge,
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}?only_pledged=True",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 0
    pledges = [x for x in res["included"] if x["type"] == "pledge"]
    assert len(pledges) == 0


@pytest.mark.asyncio
async def test_get_only_badged_no_badge(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    # pledge: Pledge,
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}?only_badged=True",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 0


@pytest.mark.asyncio
async def test_get_only_badged_is_badged(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    # pledge: Pledge,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
    client: AsyncClient,
) -> None:
    issue.pledge_badge_currently_embedded = True
    await issue.save(session)

    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}?only_badged=True",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
