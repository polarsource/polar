from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.benefit.benefits import BenefitPreconditionError, BenefitServiceProtocol
from polar.benefit.service.benefit_grant import (
    benefit_grant as benefit_grant_service,
)
from polar.benefit.service.benefit_grant import (  # type: ignore[attr-defined]
    notification_service,
)
from polar.models import (
    Benefit,
    BenefitGrant,
    Subscription,
    User,
)
from polar.notifications.notification import (
    BenefitPreconditionErrorNotificationContextualPayload,
)
from polar.notifications.service import NotificationsService
from polar.postgres import AsyncSession
from polar.subscription.service.subscription import subscription as subscription_service
from tests.fixtures.database import SaveFixture


@pytest.fixture(autouse=True)
def benefit_service_mock(mocker: MockerFixture) -> MagicMock:
    service_mock = MagicMock(spec=BenefitServiceProtocol)
    service_mock.grant.return_value = {}
    service_mock.revoke.return_value = {}
    mock = mocker.patch("polar.benefit.service.benefit_grant.get_benefit_service")
    mock.return_value = service_mock
    return service_mock


@pytest.mark.asyncio
class TestGrantBenefit:
    async def test_not_existing_grant(
        self,
        session: AsyncSession,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        benefit_service_mock.grant.return_value = {"external_id": "abc"}

        # then
        session.expunge_all()

        grant = await benefit_grant_service.grant_benefit(
            session, user, benefit_organization, subscription=subscription
        )

        assert grant.subscription_id == subscription.id
        assert grant.user_id == user.id
        assert grant.benefit_id == benefit_organization.id
        assert grant.is_granted
        assert grant.properties == {"external_id": "abc"}
        benefit_service_mock.grant.assert_called_once()

    async def test_existing_grant_not_granted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription_id=subscription.id,
            user_id=user.id,
            benefit_id=benefit_organization.id,
        )
        await save_fixture(grant)

        # then
        session.expunge_all()

        updated_grant = await benefit_grant_service.grant_benefit(
            session, user, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        benefit_service_mock.grant.assert_called_once()

    async def test_existing_grant_already_granted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription_id=subscription.id,
            user_id=user.id,
            benefit_id=benefit_organization.id,
        )
        grant.set_granted()
        await save_fixture(grant)

        # then
        session.expunge_all()

        updated_grant = await benefit_grant_service.grant_benefit(
            session, user, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        benefit_service_mock.grant.assert_not_called()

    async def test_precondition_error(
        self,
        session: AsyncSession,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        benefit_service_mock.grant.side_effect = BenefitPreconditionError("Error")

        # then
        session.expunge_all()

        grant = await benefit_grant_service.grant_benefit(
            session, user, benefit_organization, subscription=subscription
        )

        assert not grant.is_granted


@pytest.mark.asyncio
class TestRevokeBenefit:
    async def test_not_existing_grant(
        self,
        session: AsyncSession,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        # then
        session.expunge_all()

        grant = await benefit_grant_service.revoke_benefit(
            session, user, benefit_organization, subscription=subscription
        )

        assert grant.subscription_id == subscription.id
        assert grant.benefit_id == benefit_organization.id
        assert grant.is_revoked
        benefit_service_mock.revoke.assert_called_once()

    async def test_existing_grant_not_revoked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        benefit_service_mock.revoke.return_value = {"message": "ok"}

        # then
        session.expunge_all()

        grant = BenefitGrant(
            subscription_id=subscription.id,
            user_id=user.id,
            benefit_id=benefit_organization.id,
            properties={"external_id": "abc"},
        )
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, user, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        assert updated_grant.properties == {"message": "ok"}
        benefit_service_mock.revoke.assert_called_once()

    async def test_existing_grant_already_revoked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription_id=subscription.id,
            user_id=user.id,
            benefit_id=benefit_organization.id,
        )
        grant.set_revoked()
        await save_fixture(grant)

        # then
        session.expunge_all()

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, user, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        benefit_service_mock.revoke.assert_not_called()


@pytest.mark.asyncio
class TestEnqueueBenefitGrantUpdates:
    async def test_not_required_update(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.benefit.service.benefit_grant.enqueue_job"
        )
        benefit_service_mock.requires_update.return_value = False

        # then
        session.expunge_all()

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, benefit_organization, {}
        )

        enqueue_job_mock.assert_not_called()

    async def test_required_update_granted(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_repository: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        granted_grant = BenefitGrant(
            subscription=subscription,
            user=user,
            benefit=benefit_organization,
        )
        granted_grant.set_granted()
        await save_fixture(granted_grant)

        other_benefit_grant = BenefitGrant(
            subscription=subscription,
            user=user,
            benefit=benefit_repository,
        )
        other_benefit_grant.set_granted()
        await save_fixture(other_benefit_grant)

        enqueue_job_mock = mocker.patch(
            "polar.benefit.service.benefit_grant.enqueue_job"
        )
        benefit_service_mock.requires_update.return_value = True

        # then
        session.expunge_all()

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, benefit_organization, {}
        )

        enqueue_job_mock.assert_called_once_with(
            "benefit.update",
            benefit_grant_id=granted_grant.id,
        )

    async def test_required_update_revoked(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_repository: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        revoked_grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        revoked_grant.set_revoked()
        await save_fixture(revoked_grant)

        other_benefit_grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_repository
        )
        other_benefit_grant.set_granted()
        await save_fixture(other_benefit_grant)

        enqueue_job_mock = mocker.patch(
            "polar.benefit.service.benefit_grant.enqueue_job"
        )
        benefit_service_mock.requires_update.return_value = True

        # then
        session.expunge_all()

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, benefit_organization, {}
        )

        enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
class TestUpdateBenefitGrant:
    async def test_revoked_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        grant.set_revoked()
        await save_fixture(grant)

        # then
        session.expunge_all()

        updated_grant = await benefit_grant_service.update_benefit_grant(session, grant)

        assert updated_grant.id == grant.id
        benefit_service_mock.grant.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        benefit_service_mock.grant.return_value = {"external_id": "xyz"}

        grant = BenefitGrant(
            subscription=subscription,
            user=user,
            benefit=benefit_organization,
            properties={"external_id": "abc"},
        )
        grant.set_granted()
        await save_fixture(grant)

        # then
        session.expunge_all()

        # load
        grant_loaded = await benefit_grant_service.get(session, grant.id)
        assert grant_loaded

        updated_grant = await benefit_grant_service.update_benefit_grant(
            session, grant_loaded
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        assert updated_grant.properties == {"external_id": "xyz"}
        benefit_service_mock.grant.assert_called_once()
        assert benefit_service_mock.grant.call_args[1]["update"] is True

    async def test_precondition_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        benefit_service_mock.grant.side_effect = BenefitPreconditionError("Error")

        # then
        session.expunge_all()

        # load
        grant_loaded = await benefit_grant_service.get(session, grant.id)
        assert grant_loaded

        updated_grant = await benefit_grant_service.update_benefit_grant(
            session, grant_loaded
        )

        assert not updated_grant.is_granted


@pytest.mark.asyncio
class TestEnqueueBenefitGrantDeletions:
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_repository: Benefit,
    ) -> None:
        granted_grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        granted_grant.set_granted()
        await save_fixture(granted_grant)

        other_benefit_grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_repository
        )
        other_benefit_grant.set_granted()
        await save_fixture(other_benefit_grant)

        enqueue_job_mock = mocker.patch(
            "polar.benefit.service.benefit_grant.enqueue_job"
        )

        # then
        session.expunge_all()

        await benefit_grant_service.enqueue_benefit_grant_deletions(
            session, benefit_organization
        )

        enqueue_job_mock.assert_called_once_with(
            "benefit.delete", benefit_grant_id=granted_grant.id
        )


@pytest.mark.asyncio
class TestDeleteBenefitGrant:
    async def test_revoked_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        grant.set_revoked()
        await save_fixture(grant)

        # then
        session.expunge_all()

        updated_grant = await benefit_grant_service.delete_benefit_grant(session, grant)

        assert updated_grant.id == grant.id
        benefit_service_mock.revoke.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        benefit_service_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        # then
        session.expunge_all()

        # load
        grant_loaded = await benefit_grant_service.get(session, grant.id)
        assert grant_loaded

        updated_grant = await benefit_grant_service.delete_benefit_grant(
            session, grant_loaded
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        benefit_service_mock.revoke.assert_called_once()


@pytest.fixture
def notification_send_to_user_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(
        notification_service, "send_to_user", spec=NotificationsService.send_to_user
    )


@pytest.mark.asyncio
class TestHandlePreconditionError:
    async def test_no_notification(
        self,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        user: User,
        notification_send_to_user_mock: MagicMock,
    ) -> None:
        error = BenefitPreconditionError("Error")

        # then
        session.expunge_all()

        await benefit_grant_service.handle_precondition_error(
            session, error, user, benefit_organization, subscription=subscription
        )

        notification_send_to_user_mock.assert_not_called()

    async def test_email(
        self,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        user: User,
        notification_send_to_user_mock: MagicMock,
    ) -> None:
        error = BenefitPreconditionError(
            "Error",
            payload=BenefitPreconditionErrorNotificationContextualPayload(
                subject_template="Action required for granting {subscription_benefit_name}",
                body_template="Go here to fix this: {extra_context[url]}",
                extra_context={"url": "https://polar.sh"},
            ),
        )

        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        await benefit_grant_service.handle_precondition_error(
            session,
            error,
            user,
            benefit_organization,
            subscription=subscription_loaded,
        )

        notification_send_to_user_mock.assert_called_once()


@pytest.mark.asyncio
class TestEnqueueGrantsAfterPreconditionFulfilled:
    async def test_required_update(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user: User,
        user_second: User,
        benefit_organization: Benefit,
    ) -> None:
        pending_grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        await save_fixture(pending_grant)

        other_user_grant = BenefitGrant(
            subscription=subscription, user=user_second, benefit=benefit_organization
        )
        await save_fixture(other_user_grant)

        enqueue_job_mock = mocker.patch(
            "polar.benefit.service.benefit_grant.enqueue_job"
        )

        # then
        session.expunge_all()

        await benefit_grant_service.enqueue_grants_after_precondition_fulfilled(
            session, user, benefit_organization.type
        )

        enqueue_job_mock.assert_called_once_with(
            "benefit.grant",
            user_id=user.id,
            benefit_id=pending_grant.benefit_id,
            **pending_grant.get_scope(),
        )
