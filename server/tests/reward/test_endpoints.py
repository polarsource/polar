from datetime import timedelta

import pytest
from httpx import AsyncClient

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
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
async def test_search(
    session: AsyncSession,
    save_fixture: SaveFixture,
    pledge: Pledge,
    organization: Organization,
    user_organization: UserOrganization,
    user: User,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    await pledge_service.mark_pending_by_issue_id(session, pledge.issue_id)

    got = await pledge_service.get(session, pledge.id)
    assert got is not None
    got.scheduled_payout_at = utc_now() - timedelta(days=2)
    got.payment_id = "test_transfer_payment_id"
    await save_fixture(got)

    account = Account(
        account_type=AccountType.stripe,
        admin_id=user.id,
        stripe_id="testing_account_1",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        business_type="company",
        country="SE",
        currency="USD",
    )
    await save_fixture(account)

    # then
    session.expunge_all()

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

    response = await client.get(
        f"/api/v1/rewards/search?pledges_to_organization={organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    json = response.json()
    assert len(json["items"]) == 2

    assert json["items"][0]["pledge"]["id"] == str(pledge.id)
    assert json["items"][1]["pledge"]["id"] == str(pledge.id)

    assert json["items"][0]["pledge"]["issue"]["id"] == str(pledge.issue_id)
    assert json["items"][1]["pledge"]["issue"]["id"] == str(pledge.issue_id)

    assert json["items"][0]["user"]["username"] == "zegl"
    assert json["items"][0]["organization"] is None

    assert json["items"][1]["user"] is None
    assert json["items"][1]["organization"]["name"] == organization.name

    assert json["items"][0]["state"] == "pending"
    assert json["items"][1]["state"] == "pending"
