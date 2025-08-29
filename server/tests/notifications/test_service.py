import pytest
from uuid import uuid4

from polar.models import Organization, OrganizationNotification, User
from polar.notifications.service import notifications
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestNotificationsService:
    async def test_get_for_organization(
        self, session, organization: Organization
    ) -> None:
        # Test getting notifications for an organization
        notifs = await notifications.get_for_organization(session, organization.id)
        assert isinstance(notifs, list)

    async def test_get_organization_last_read(
        self, session, organization: Organization
    ) -> None:
        # Test getting last read notification for an organization
        last_read = await notifications.get_organization_last_read(
            session, organization.id
        )
        assert last_read is None  # Should be None initially

    async def test_set_organization_last_read(
        self, session, organization: Organization, save_fixture: SaveFixture
    ) -> None:
        # Test setting last read notification for an organization
        notification_id = uuid4()
        await notifications.set_organization_last_read(
            session, organization.id, notification_id
        )
        await session.commit()

        # Verify it was set
        last_read = await notifications.get_organization_last_read(
            session, organization.id
        )
        assert last_read == notification_id

    async def test_send_to_organization(
        self, session, organization: Organization
    ) -> None:
        # Test sending a notification to an organization
        from polar.notifications.notification import NotificationPayload, NotificationType

        from polar.notifications.service import PartialNotification

        from polar.notifications.notification import MaintainerNewProductSaleNotificationPayload

        notif = PartialNotification(
            type=NotificationType.maintainer_new_product_sale,
            payload=MaintainerNewProductSaleNotificationPayload(
                customer_name="Test Customer",
                product_name="Test Product",
                product_price_amount=1000,
                organization_name="Test Org",
            ),
        )

        result = await notifications.send_to_organization(
            session, organization.id, notif
        )
        assert result is True

        # Verify the notification was created
        notifs = await notifications.get_for_organization(session, organization.id)
        assert len(notifs) == 1
        assert notifs[0].organization_id == organization.id
