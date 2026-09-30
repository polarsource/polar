import pytest
from pytest_mock import MockerFixture

from polar.models import Organization, UserOrganization
from polar.notifications.notification import (
    MaintainerAccountCreditsGrantedNotificationPayload,
    MaintainerNewPaidSubscriptionNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
    MaintainerNewTrialNotificationPayload,
    MaintainerSubscriptionCancellationNotificationPayload,
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


def _new_trial_notif() -> PartialNotification:
    return PartialNotification(
        type=NotificationType.maintainer_new_trial,
        payload=MaintainerNewTrialNotificationPayload(
            subscriber_name="Subscriber",
            subscriber_email=None,
            product_name="Product",
            organization_name="Test",
            organization_slug=None,
            subscription_id=None,
            trial_end=None,
        ),
    )


def _subscription_cancellation_notif() -> PartialNotification:
    return PartialNotification(
        type=NotificationType.maintainer_subscription_cancellation,
        payload=MaintainerSubscriptionCancellationNotificationPayload(
            subscriber_name="Subscriber",
            subscriber_email=None,
            product_name="Product",
            organization_name="Test",
            organization_slug=None,
            subscription_id=None,
            cancellation_reason=None,
            cancellation_comment=None,
            cancel_at_period_end=True,
            ends_at=None,
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
                notification_settings={"new_order": True, "new_subscription": True},
            )
        )
        await save_fixture(
            UserOrganization(
                user=member_off,
                organization=organization,
                notification_settings={"new_order": False, "new_subscription": True},
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
                notification_settings={"new_order": False, "new_subscription": True},
            )
        )
        await save_fixture(
            UserOrganization(
                user=member_off,
                organization=organization,
                notification_settings={"new_order": True, "new_subscription": False},
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
                notification_settings={"new_order": False, "new_subscription": False},
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

    async def test_free_product_skips_members_excluding_free_products(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        send_to_user_mock = mocker.patch(
            "polar.notifications.service.NotificationsService.send_to_user"
        )

        member_excluding = await create_user(save_fixture)
        member_including = await create_user(save_fixture)
        await save_fixture(
            UserOrganization(
                user=member_excluding,
                organization=organization,
                notification_settings={
                    "new_order": True,
                    "new_subscription": True,
                    "exclude_free_products": True,
                },
            )
        )
        await save_fixture(
            UserOrganization(
                user=member_including,
                organization=organization,
                notification_settings={"new_order": True, "new_subscription": True},
            )
        )

        await notifications_service.send_to_org_members(
            session,
            org_id=organization.id,
            notif=_new_subscription_notif(),
            is_free_product=True,
        )
        notified = {c.kwargs["user_id"] for c in send_to_user_mock.call_args_list}
        assert notified == {member_including.id}

        send_to_user_mock.reset_mock()
        await notifications_service.send_to_org_members(
            session,
            org_id=organization.id,
            notif=_new_subscription_notif(),
            is_free_product=False,
        )
        notified = {c.kwargs["user_id"] for c in send_to_user_mock.call_args_list}
        assert notified == {member_excluding.id, member_including.id}

    async def test_new_trial_setting_falls_back_to_new_subscription(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        send_to_user_mock = mocker.patch(
            "polar.notifications.service.NotificationsService.send_to_user"
        )

        trial_on = await create_user(save_fixture)
        trial_off = await create_user(save_fixture)
        legacy_subscription_on = await create_user(save_fixture)
        legacy_subscription_off = await create_user(save_fixture)
        for user, settings in (
            (trial_on, {"new_subscription": False, "new_trial": True}),
            (trial_off, {"new_subscription": True, "new_trial": False}),
            (legacy_subscription_on, {"new_subscription": True}),
            (legacy_subscription_off, {"new_subscription": False}),
        ):
            await save_fixture(
                UserOrganization(
                    user=user,
                    organization=organization,
                    notification_settings={"new_order": True, **settings},
                )
            )

        await notifications_service.send_to_org_members(
            session, org_id=organization.id, notif=_new_trial_notif()
        )

        notified = {c.kwargs["user_id"] for c in send_to_user_mock.call_args_list}
        assert notified == {trial_on.id, legacy_subscription_on.id}

    async def test_subscription_cancellation_setting_defaults_to_false(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        send_to_user_mock = mocker.patch(
            "polar.notifications.service.NotificationsService.send_to_user"
        )

        cancellation_on = await create_user(save_fixture)
        cancellation_off = await create_user(save_fixture)
        legacy = await create_user(save_fixture)
        for user, settings in (
            (
                cancellation_on,
                {"new_subscription": False, "subscription_cancellation": True},
            ),
            (
                cancellation_off,
                {"new_subscription": True, "subscription_cancellation": False},
            ),
            (legacy, {"new_subscription": True}),
        ):
            await save_fixture(
                UserOrganization(
                    user=user,
                    organization=organization,
                    notification_settings={"new_order": True, **settings},
                )
            )

        await notifications_service.send_to_org_members(
            session, org_id=organization.id, notif=_subscription_cancellation_notif()
        )

        notified = {c.kwargs["user_id"] for c in send_to_user_mock.call_args_list}
        assert notified == {cancellation_on.id}
