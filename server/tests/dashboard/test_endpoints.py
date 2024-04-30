from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge, PledgeState
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from polar.user.service import user as user_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user_github_oauth


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    issue: Issue,
    client: AsyncClient,
) -> None:
    response = await client.get(f"/api/v1/dashboard/github/{organization.name}")

    assert response.status_code == 200
    res = response.json()
    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_personal(client: AsyncClient) -> None:
    response = await client.get("/api/v1/dashboard/personal")

    assert response.status_code == 200


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_no_member(
    user: User,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    client: AsyncClient,
) -> None:
    response = await client.get(f"/api/v1/dashboard/github/{organization.name}")

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_with_pledge_from_org(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    pledge: Pledge,
    issue: Issue,
    client: AsyncClient,
) -> None:
    response = await client.get(f"/api/v1/dashboard/github/{organization.name}")

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)
    assert len(res["data"][0]["pledges"]) == 1
    rel_pledge = res["data"][0]["pledges"][0]

    assert rel_pledge["pledger"]["name"] == pledging_organization.name

    summary = res["data"][0]["pledges_summary"]
    assert summary["pay_upfront"]["total"]["amount"] == pledge.amount
    assert len(summary["pay_upfront"]["pledgers"]) == 1


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_with_pledge_from_user(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    # pledging_organization: Organization,
    pledge_by_user: Pledge,
    issue: Issue,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    assert pledge_by_user.by_user_id
    pledging_user = await user_service.get(session, pledge_by_user.by_user_id)
    assert pledging_user

    response = await client.get(f"/api/v1/dashboard/github/{organization.name}")

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)
    assert len(res["data"][0]["pledges"]) == 1
    rel_pledge = res["data"][0]["pledges"][0]

    assert pledging_user.email
    assert str(rel_pledge["pledger"]["name"]) == pledging_user.email

    summary = res["data"][0]["pledges_summary"]
    assert summary["pay_upfront"]["total"]["amount"] == pledge_by_user.amount
    assert len(summary["pay_upfront"]["pledgers"]) == 1


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_with_pledge_from_user_github_oauth(
    user: User,
    # user_github_oauth: OAuthAccount,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    # pledging_organization: Organization,
    pledge_by_user: Pledge,
    issue: Issue,
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    assert pledge_by_user.by_user_id
    pledging_user = await user_service.get(session, pledge_by_user.by_user_id)
    assert pledging_user
    pledger_gh = await create_user_github_oauth(save_fixture, pledging_user)

    response = await client.get(f"/api/v1/dashboard/github/{organization.name}")

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)
    assert len(res["data"][0]["pledges"]) == 1
    rel_pledge = res["data"][0]["pledges"][0]

    assert pledger_gh
    assert str(rel_pledge["pledger"]["name"]) == pledger_gh.account_username

    summary = res["data"][0]["pledges_summary"]
    assert summary["pay_upfront"]["total"]["amount"] == pledge_by_user.amount
    assert len(summary["pay_upfront"]["pledgers"]) == 1


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_with_pledge_initiated(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    pledge: Pledge,
    issue: Issue,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    # assert that initiated pledges does not appear in the result
    pledge.state = PledgeState.initiated
    await save_fixture(pledge)

    response = await client.get(f"/api/v1/dashboard/github/{organization.name}")

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)

    assert res["data"][0]["pledges"] is None


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_only_pledged_with_pledge(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    pledge: Pledge,
    issue: Issue,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}?only_pledged=True"
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)

    pledges = res["data"][0]["pledges"]
    assert len(pledges) == 1
    res_pledge = pledges[0]

    assert res_pledge["pledger"]["name"] == pledging_organization.name


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_only_pledged_no_pledge(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    # pledging_organization: Organization,
    # pledge: Pledge,
    issue: Issue,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}?only_pledged=True"
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 0


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_only_badged_no_badge(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    # pledge: Pledge,
    issue: Issue,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}?only_badged=True"
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 0


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.authenticated
async def test_get_only_badged_is_badged(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    # pledge: Pledge,
    issue: Issue,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    issue.pledge_badge_embedded_at = datetime.now(UTC)
    await save_fixture(issue)

    response = await client.get(
        f"/api/v1/dashboard/github/{organization.name}?only_badged=True"
    )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
