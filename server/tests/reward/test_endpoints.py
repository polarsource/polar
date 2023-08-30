from dataclasses import dataclass
from datetime import timedelta

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.app import app
from polar.config import settings
from polar.enums import AccountType
from polar.issue.schemas import ConfirmIssueSplit
from polar.kit.utils import utc_now
from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.reward.service import reward_service


@pytest.mark.asyncio
async def test_search(
    session: AsyncSession,
    pledge: Pledge,
    organization: Organization,
    user_organization: UserOrganization,
    user: User,
    mocker: MockerFixture,
    auth_jwt: str,
) -> None:
    mocker.patch("polar.worker._enqueue_job")

    user_organization.is_admin = True
    await user_organization.save(session)

    await pledge_service.mark_pending_by_pledge_id(session, pledge.id)

    got = await pledge_service.get(session, pledge.id)
    assert got is not None
    got.scheduled_payout_at = utc_now() - timedelta(days=2)
    got.payment_id = "test_transfer_payment_id"
    await got.save(session)

    account = await Account.create(
        session=session,
        organization_id=organization.id,
        account_type=AccountType.stripe,
        admin_id=user.id,
        stripe_id="testing_account_1",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        business_type="company",
    )
    await session.flush()
    await organization.save(session)

    splits = await pledge_service.create_issue_rewards(
        session,
        pledge.issue_id,
        splits=[
            ConfirmIssueSplit(share_thousands=300, github_username="zegl"),
            ConfirmIssueSplit(share_thousands=700, organization_id=organization.id),
        ],
    )

    rewards = await reward_service.list(session, pledge_org_id=organization.id)
    assert len(rewards) == 2

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/rewards/search?pledges_to_organization={organization.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    print(response.text)

    assert response.status_code == 200
    assert len(response.json()["items"]) == 2

    assert response.json()["items"][0]["pledge"]["id"] == str(pledge.id)
    assert response.json()["items"][1]["pledge"]["id"] == str(pledge.id)

    assert response.json()["items"][0]["pledge"]["issue"]["id"] == str(pledge.issue_id)
    assert response.json()["items"][1]["pledge"]["issue"]["id"] == str(pledge.issue_id)

    assert response.json()["items"][0]["user"]["username"] == "zegl"
    assert response.json()["items"][0]["organization"] is None

    assert response.json()["items"][1]["user"] is None
    assert response.json()["items"][1]["organization"]["name"] == organization.name

    assert response.json()["items"][0]["state"] == "pending"
    assert response.json()["items"][1]["state"] == "pending"
