import pytest
from httpx import AsyncClient

from polar.issue.schemas import Reactions
from polar.issue.service import issue as issue_service
from polar.models.external_organization import ExternalOrganization
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
@pytest.mark.auth
async def test_get_issue(
    external_organization: ExternalOrganization,
    repository: Repository,
    issue: Issue,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository.is_private = False
    await save_fixture(repository)

    response = await client.get(f"/v1/issues/{issue.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["repository"]["id"] == str(repository.id)
    assert response.json()["repository"]["organization"]["id"] == str(
        external_organization.id
    )


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_issue_reactions(
    repository: Repository,
    issue: Issue,
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

    response = await client.get(f"/v1/issues/{issue.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(issue.id)
    assert response.json()["reactions"]["plus_one"] == 2


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_not_found_private_repo(
    organization: Organization,
    repository_linked: Repository,
    issue_linked: Issue,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository_linked.is_private = True
    await save_fixture(repository_linked)

    response = await client.get(f"/v1/issues/{issue_linked.id}")

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_private_repo_member(
    repository_linked: Repository,
    issue_linked: Issue,
    save_fixture: SaveFixture,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    repository_linked.is_private = True
    await save_fixture(repository_linked)

    response = await client.get(f"/v1/issues/{issue_linked.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(issue_linked.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_issue_list_public_repo(
    organization: Organization,
    external_organization_linked: ExternalOrganization,
    repository_linked: Repository,
    issue_linked: Issue,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository_linked.is_private = False
    repository_linked.is_archived = False
    await save_fixture(repository_linked)

    response = await client.get(
        "/v1/issues/",
        params={
            "organization_id": str(organization.id),
            "repository_name": repository_linked.name,
        },
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(issue_linked.id)
    assert response.json()["items"][0]["repository"]["id"] == str(repository_linked.id)
    assert response.json()["items"][0]["repository"]["organization"]["id"] == str(
        external_organization_linked.id
    )


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_issue_list_public_repo_without_repo_selector(
    organization: Organization,
    repository_linked: Repository,
    issue_linked: Issue,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository_linked.is_private = False
    repository_linked.is_archived = False
    await save_fixture(repository_linked)

    response = await client.get(
        "/v1/issues/",
        params={
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(issue_linked.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_issue_list_private_repo(
    organization: Organization,
    repository_linked: Repository,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository_linked.is_private = True
    repository_linked.is_archived = False
    await save_fixture(repository_linked)

    response = await client.get(
        "/v1/issues/",
        params={
            "organization_id": str(organization.id),
            "repository_name": repository_linked.name,
        },
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_issue_list_private_repo_without_repo_selector(
    organization: Organization,
    repository_linked: Repository,
    save_fixture: SaveFixture,
    client: AsyncClient,
) -> None:
    repository_linked.is_private = True
    repository_linked.is_archived = False
    await save_fixture(repository_linked)

    response = await client.get(
        "/v1/issues/",
        params={"organization_id": str(organization.id)},
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_funding_goal(
    issue_linked: Issue,
    session: AsyncSession,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    # then
    session.expunge_all()

    # get, default value should be None
    response = await client.get(f"/v1/issues/{issue_linked.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(issue_linked.id)
    assert response.json()["funding"]["funding_goal"] is None

    # update value
    response = await client.post(
        f"/v1/issues/{issue_linked.id}",
        json={"funding_goal": {"currency": "usd", "amount": 12000}},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue_linked.id)
    assert response.json()["funding"]["funding_goal"] == {
        "currency": "usd",
        "amount": 12000,
    }

    # get after post, should be persisted
    response = await client.get(f"/v1/issues/{issue_linked.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(issue_linked.id)
    assert response.json()["funding"]["funding_goal"] == {
        "currency": "usd",
        "amount": 12000,
    }


@pytest.mark.asyncio
@pytest.mark.auth
async def test_confirm_solved(
    organization: Organization,
    issue_linked: Issue,
    pledge_linked: Pledge,
    session: AsyncSession,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    user: User,
) -> None:
    # then
    session.expunge_all()

    await issue_service.mark_confirmed_solved(session, issue_linked.id, user.id)

    # fetch pledges
    pledges_response = await client.get(
        f"/v1/pledges/search?issue_id={pledge_linked.issue_id}"
    )

    assert pledges_response.status_code == 200
    assert len(pledges_response.json()["items"]) == 1
    assert pledges_response.json()["items"][0]["state"] == "created"

    # confirm as solved
    response = await client.post(
        f"/v1/issues/{issue_linked.id}/confirm_solved",
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
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(issue_linked.id)

    # fetch pledges
    pledges_response = await client.get(
        f"/v1/pledges/search?issue_id={pledge_linked.issue_id}"
    )

    assert pledges_response.status_code == 200
    assert len(pledges_response.json()["items"]) == 1
    assert pledges_response.json()["items"][0]["state"] == "pending"
