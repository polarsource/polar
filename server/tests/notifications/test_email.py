import inspect
import os
import uuid

import pytest

from polar.models.organization import Organization
from polar.models.pledge import PledgeType
from polar.models.user import User
from polar.notifications.notification import (
    MaintainerNewPaidSubscriptionNotification,
    MaintainerPledgeConfirmationPendingNotification,
    MaintainerPledgeCreatedNotification,
    MaintainerPledgedIssueConfirmationPendingNotification,
    MaintainerPledgedIssuePendingNotification,
    MaintainerPledgePaidNotification,
    MaintainerPledgePendingNotification,
    PledgerPledgePendingNotification,
    RewardPaidNotification,
    TeamAdminMemberPledgedNotification,
)


async def check_diff(email: tuple[str, str]) -> None:
    (subject, body) = email
    expected = f"{subject}\n<hr>\n{body}"

    # Run with `POLAR_TEST_RECORD=1 pytest` to produce new golden files :-)
    record = os.environ.get("POLAR_TEST_RECORD", False) == "1"

    name = inspect.stack()[1].function

    if record:
        with open(f"./tests/notifications/testdata/{name}.html", "w+") as f:
            f.write(expected)
            return

    with open(f"./tests/notifications/testdata/{name}.html") as f:
        content = f.read()
        assert content == expected


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgeCreatedNotification_no_stripe(
    predictable_user: User,
) -> None:
    n = MaintainerPledgeCreatedNotification(
        pledger_name="pledging_org",
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_stripe_account=False,
        pledge_type=PledgeType.pay_directly,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgeCreatedNotification_with_stripe(
    predictable_user: User,
) -> None:
    n = MaintainerPledgeCreatedNotification(
        pledger_name="pledging_org",
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_stripe_account=True,
        pledge_type=PledgeType.pay_directly,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgeCreatedNotification_anonymous(
    predictable_user: User,
) -> None:
    n = MaintainerPledgeCreatedNotification(
        pledger_name=None,
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_stripe_account=True,
        pledge_type=PledgeType.pay_directly,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgeCreatedNotification_pay_on_completion(
    predictable_user: User,
) -> None:
    n = MaintainerPledgeCreatedNotification(
        pledger_name="pledger_name",
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_stripe_account=True,
        pledge_type=PledgeType.pay_on_completion,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgeConfirmationPendingdNotification_no_stripe(
    predictable_user: User,
) -> None:
    n = MaintainerPledgeConfirmationPendingNotification(
        pledger_name="pledging_org",
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_stripe_account=False,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgeConfirmationPendingdNotification_with_stripe(
    predictable_user: User,
) -> None:
    n = MaintainerPledgeConfirmationPendingNotification(
        pledger_name="pledging_org",
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_stripe_account=True,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgePendingdNotification_no_stripe(
    predictable_user: User,
) -> None:
    n = MaintainerPledgePendingNotification(
        pledger_name="pledging_org",
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_stripe_account=False,
        pledge_id=None,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgePendingdNotification_with_stripe(
    predictable_user: User,
) -> None:
    n = MaintainerPledgePendingNotification(
        pledger_name="pledging_org",
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_stripe_account=True,
        pledge_id=None,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_PledgerPledgePendingNotification(
    predictable_user: User,
) -> None:
    n = PledgerPledgePendingNotification(
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        pledge_date="2023-02-02",
        pledge_id=None,
        pledge_type=PledgeType.pay_upfront,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_PledgerPledgePendingNotification_pay_on_completion(
    predictable_user: User,
) -> None:
    n = PledgerPledgePendingNotification(
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        pledge_date="2023-02-02",
        pledge_id=None,
        pledge_type=PledgeType.pay_on_completion,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgePaidNotification(
    predictable_user: User,
) -> None:
    n = MaintainerPledgePaidNotification(
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        paid_out_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        pledge_id=None,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_RewardPaidNotification(
    predictable_user: User,
) -> None:
    n = RewardPaidNotification(
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        paid_out_amount="123.45",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        pledge_id=uuid.uuid4(),
        issue_id=uuid.uuid4(),
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgedIssueConfirmationPendingNotification(
    predictable_user: User,
) -> None:
    n = MaintainerPledgedIssueConfirmationPendingNotification(
        issue_id=uuid.uuid4(),
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount_sum="543.21",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_account=False,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgedIssueConfirmationPendingNotification_with_account(
    predictable_user: User,
) -> None:
    n = MaintainerPledgedIssueConfirmationPendingNotification(
        issue_id=uuid.uuid4(),
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount_sum="543.21",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_account=True,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgedIssuePendingNotification(
    predictable_user: User,
) -> None:
    n = MaintainerPledgedIssuePendingNotification(
        issue_id=uuid.uuid4(),
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount_sum="543.21",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_account=False,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerPledgedIssuePendingNotification_with_account(
    predictable_user: User,
) -> None:
    n = MaintainerPledgedIssuePendingNotification(
        issue_id=uuid.uuid4(),
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount_sum="543.21",
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        maintainer_has_account=True,
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_TeamAdminMemberPledgedNotification(
    predictable_user: User,
    predictable_organization: Organization,
) -> None:
    n = TeamAdminMemberPledgedNotification(
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        issue_org_name="testorg",
        issue_repo_name="testrepo",
        team_name=predictable_organization.name,
        team_member_name=predictable_user.username,
        pledge_amount="500.00",
        pledge_id=uuid.uuid4(),
    )

    await check_diff(n.render(predictable_user))


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
async def test_MaintainerNewPaidSubscriptionNotification(
    predictable_user: User,
) -> None:
    n = MaintainerNewPaidSubscriptionNotification(
        subscriber_name="John Doe",
        tier_name="My Paid Tier",
        tier_price_amount=500,
        tier_organization_name="myorg",
    )

    await check_diff(n.render(predictable_user))
