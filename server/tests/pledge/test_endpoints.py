import uuid

import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.pledge.schemas import Pledge as PledgeSchema
from polar.pledge.schemas import PledgeState
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import (
    create_issue,
    create_organization,
    create_pledge,
    create_user,
)


@pytest.mark.asyncio
async def test_get_pledge(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    issue: Issue,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    session: AsyncSession,
    client: AsyncClient,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    response = await client.get(
        f"/api/v1/pledges/{pledge.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(pledge.id)
    assert response.json()["type"] == "pay_upfront"
    assert response.json()["issue"]["id"] == str(issue.id)
    assert response.json()["issue"]["repository"]["id"] == str(repository.id)
    assert response.json()["issue"]["repository"]["organization"]["id"] == str(
        organization.id
    )


@pytest.mark.asyncio
async def test_get_pledge_member_sending_org(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
    client: AsyncClient,
    user: User,
) -> None:
    pledging_organization = await create_organization(session=session)

    pledge_created_by_user = await create_user(session=session)

    pledge = await create_pledge(
        session=session,
        organization=organization,
        repository=repository,
        issue=issue,
        pledging_organization=pledging_organization,
    )

    pledge.created_by_user_id = pledge_created_by_user.id
    await pledge.save(session)

    # make user member of the pledging organization
    await UserOrganization.create(
        session=session,
        user_id=user.id,
        organization_id=pledging_organization.id,
    )

    response = await client.get(
        f"/api/v1/pledges/{pledge.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    assert response.json()["id"] == str(pledge.id)
    res: PledgeSchema = PledgeSchema.parse_obj(response.json())
    assert res.id == pledge.id
    assert res.created_by is not None
    assert res.created_by.name == pledge_created_by_user.username


@pytest.mark.asyncio
async def test_get_pledge_member_receiving_org(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    issue: Issue,
    auth_jwt: str,
    session: AsyncSession,
    client: AsyncClient,
    user: User,
) -> None:
    pledging_organization = await create_organization(session=session)

    pledge_created_by_user = await create_user(session=session)

    pledge = await create_pledge(
        session=session,
        organization=organization,
        repository=repository,
        issue=issue,
        pledging_organization=pledging_organization,
    )

    pledge.created_by_user_id = pledge_created_by_user.id
    await pledge.save(session)

    # make user member of the receiving organization
    await UserOrganization.create(
        session=session,
        user_id=user.id,
        organization_id=organization.id,
    )

    response = await client.get(
        f"/api/v1/pledges/{pledge.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    assert response.json()["id"] == str(pledge.id)
    res: PledgeSchema = PledgeSchema.parse_obj(response.json())
    assert res.id == pledge.id
    assert res.created_by is None  # created_by should not be available!


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
    client: AsyncClient,
) -> None:
    user_organization.is_admin = False
    await user_organization.save(session)

    response = await client.get(
        f"/api/v1/pledges/{pledge.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_pledge_not_member(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    auth_jwt: str,
    session: AsyncSession,
    client: AsyncClient,
) -> None:
    response = await client.get(
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
    client: AsyncClient,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    response = await client.get(
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
    client: AsyncClient,
) -> None:
    user_organization.is_admin = False
    await user_organization.save(session)

    response = await client.get(
        f"/api/v1/pledges/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1


@pytest.mark.asyncio
async def test_search_pledge_no_member(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/pledges/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 0


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
    client: AsyncClient,
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

    response = await client.get(
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

    response = await client.get(
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
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/pledges/search",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "No search criteria specified"}


@pytest.mark.asyncio
async def test_create_pay_on_completion(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    create_pledge = await client.post(
        "/api/v1/pledges/pay_on_completion",
        json={"issue_id": str(issue.id), "amount": 133700},
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert create_pledge.status_code == 200

    pledge = create_pledge.json()
    assert pledge["state"] == "created"
    assert pledge["type"] == "pay_on_completion"

    # pledge_id = pledge["id"]
    # create_invoice = await client.post(
    #     f"/api/v1/pledges/{pledge_id}/create_invoice",
    #     cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    # )
    # assert create_invoice.status_code == 200
    # pledge = create_invoice.json()
    # assert pledge["type"] == "pay_on_completion"
    # assert len(pledge["hosted_invoice_url"]) > 5
    # assert response.json() == {"detail": "No search criteria specified"}
    # assert False


@pytest.mark.asyncio
async def test_summary(
    repository: Repository,
    pledge: Pledge,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    repository.is_private = False
    await repository.save(session)

    response = await client.get(
        f"/api/v1/pledges/summary?issue_id={pledge.issue_id}",
    )

    print(response.json())
    assert response.status_code == 200
    assert response.json() == {
        "funding": {
            "funding_goal": None,
            "pledges_sum": {"amount": pledge.amount, "currency": "USD"},
        },
        "pledges": [
            {
                "pledger": {
                    "avatar_url": "https://avatars.githubusercontent.com/u/105373340?s=200&v=4",
                    "github_username": pledge.by_organization.name,
                    "name": pledge.by_organization.name,
                },
                "type": "pay_upfront",
            }
        ],
    }


@pytest.mark.asyncio
async def test_summary_private_repo(
    repository: Repository,
    pledge: Pledge,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    repository.is_private = True
    await repository.save(session)

    response = await client.get(
        f"/api/v1/pledges/summary?issue_id={pledge.issue_id}",
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_pay_on_completion_total_monthly_spending_limit(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    # configure org spending limit
    organization.total_monthly_spending_limit = 10000
    await organization.save(session)

    # first pledge is OK
    create_pledge = await client.post(
        "/api/v1/pledges/pay_on_completion",
        json={
            "issue_id": str(issue.id),
            "amount": 6000,
            "by_organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert create_pledge.status_code == 200

    pledge = create_pledge.json()
    assert pledge["state"] == "created"

    # not OK, reached spending limit
    create_pledge = await client.post(
        "/api/v1/pledges/pay_on_completion",
        json={
            "issue_id": str(issue.id),
            "amount": 6000,
            "by_organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert create_pledge.status_code == 400

    assert (
        create_pledge.text
        == '{"type":"BadRequest","detail":"The team spending limit has been reached"}'
    )


@pytest.mark.asyncio
async def test_create_pay_on_completion_per_user_monthly_spending_limit(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    # configure org spending limit
    organization.per_user_monthly_spending_limit = 10000
    await organization.save(session)

    # first pledge is OK
    create_pledge = await client.post(
        "/api/v1/pledges/pay_on_completion",
        json={
            "issue_id": str(issue.id),
            "amount": 6000,
            "by_organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert create_pledge.status_code == 200

    pledge = create_pledge.json()
    assert pledge["state"] == "created"

    # not OK, reached spending limit
    create_pledge = await client.post(
        "/api/v1/pledges/pay_on_completion",
        json={
            "issue_id": str(issue.id),
            "amount": 6000,
            "by_organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert create_pledge.status_code == 400

    assert (
        create_pledge.text
        == '{"type":"BadRequest","detail":"The user spending limit has been reached"}'
    )


@pytest.mark.asyncio
async def test_spending(
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    # configure org spending limit
    organization.per_user_monthly_spending_limit = 10000
    await organization.save(session)

    # make a pledge
    create_pledge = await client.post(
        "/api/v1/pledges/pay_on_completion",
        json={
            "issue_id": str(issue.id),
            "amount": 6000,
            "by_organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert create_pledge.status_code == 200

    pledge = create_pledge.json()
    assert pledge["state"] == "created"

    # get spending

    spending = await client.get(
        f"/api/v1/pledges/spending?organization_id={organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert spending.status_code == 200
    assert spending.json()["amount"]["amount"] == 6000


@pytest.mark.asyncio
async def test_spending_zero(
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    # get spending

    spending = await client.get(
        f"/api/v1/pledges/spending?organization_id={organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert spending.status_code == 200
    assert spending.json()["amount"]["amount"] == 0
