import pytest
from pytest_mock import MockerFixture

from polar.models import Organization, UserOrganization
from polar.notifications.notification import (
    MaintainerAccountCreditsGrantedNotificationPayload,
    MaintainerNewPaidSubscriptionNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user


def _new_order_notif() -> PartialNotification:
    return PartialNotification(
        type=NotificationType.maintainer_new_product_sale,
        payload=MaintainerNewProductSaleNotificationPayload(
            product_name="Test product",
            product_price_amount=1000,
        ),
    )


def _new_subscription_notif() -> PartialNotification:
    return PartialNotification(
        type=NotificationType.maintainer_new_paid_subscription,
        payload=MaintainerNewPaidSubscriptionNotificationPayload(
            subscriber_name="Subscriber",
            tier_name="Tier",
            tier_price_amount=1000,
            tier_price_recurring_interval="month",
            tier_organization_name="Test",
        ),
    )


def _unmapped_notif() -> PartialNotification:
    # account-credits has no entry in the per-user settings map
    return PartialNotification(
        type=NotificationType.maintainer_account_credits_granted,
        payload=MaintainerAccountCreditsGrantedNotificationPayload(
            organization_name="Test",
            amount=5000,
        ),
    )


@pytest.mark.asyncio
class TestSendToOrgMembers:
    async def test_per_user_setting_is_honored(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Only members who enabled the setting are notified."""
        send_to_user_mock = mocker.patch(
            "polar.notifications.service.NotificationsService.send_to_user"
        )

        member_on = await create_user(save_fixture)
        member_off = await create_user(save_fixture)
        await save_fixture(
            UserOrganization(
                user=member_on,
                organization=organization,
                notification_settings={
                    "new_order": True,
                    "new_subscription": True,
                    "chargeback_prevention": True,
                },
            )
        )
        await save_fixture(
            UserOrganization(
                user=member_off,
                organization=organization,
                notification_settings={
                    "new_order": False,
                    "new_subscription": True,
                    "chargeback_prevention": True,
                },
            )
        )

        await notifications_service.send_to_org_members(
            session, org_id=organization.id, notif=_new_order_notif()
        )

        notified = {c.kwargs["user_id"] for c in send_to_user_mock.call_args_list}
        assert notified == {member_on.id}

    async def test_oposite_settings_are_honored(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Sending a new_subscription notif reads the `new_subscription` flag, not
        `new_order`. The two flags are set to opposite values so reading the wrong
        key would notify the wrong member."""
        send_to_user_mock = mocker.patch(
            "polar.notifications.service.NotificationsService.send_to_user"
        )

        member_on = await create_user(save_fixture)
        member_off = await create_user(save_fixture)
        await save_fixture(
            UserOrganization(
                user=member_on,
                organization=organization,
                # new_order off, new_subscription on — proves the keys don't cross
                notification_settings={
                    "new_order": False,
                    "new_subscription": True,
                    "chargeback_prevention": True,
                },
            )
        )
        await save_fixture(
            UserOrganization(
                user=member_off,
                organization=organization,
                notification_settings={
                    "new_order": True,
                    "new_subscription": False,
                    "chargeback_prevention": True,
                },
            )
        )

        await notifications_service.send_to_org_members(
            session, org_id=organization.id, notif=_new_subscription_notif()
        )

        notified = {c.kwargs["user_id"] for c in send_to_user_mock.call_args_list}
        assert notified == {member_on.id}

    async def test_unmapped_notification_goes_to_all_members(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """A notification type with no settings key bypasses the filter entirely,
        preserving today's behavior for e.g. account-credit notifications.
        """
        send_to_user_mock = mocker.patch(
            "polar.notifications.service.NotificationsService.send_to_user"
        )

        member_a = await create_user(save_fixture)
        member_b = await create_user(save_fixture)
        await save_fixture(
            UserOrganization(
                user=member_a,
                organization=organization,
                # everything off — still notified, because the type isn't mapped
                notification_settings={
                    "new_order": False,
                    "new_subscription": False,
                    "chargeback_prevention": False,
                },
            )
        )
        await save_fixture(
            UserOrganization(
                user=member_b,
                organization=organization,
                # default settings — still notified, because the type isn't mapped
            )
        )

        await notifications_service.send_to_org_members(
            session, org_id=organization.id, notif=_unmapped_notif()
        )

        notified = {c.kwargs["user_id"] for c in send_to_user_mock.call_args_list}
        assert notified == {member_a.id, member_b.id}
