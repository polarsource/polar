from re import S
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.models import Subscription, SubscriptionBenefit, SubscriptionBenefitGrant
from polar.postgres import AsyncSession
from polar.subscription.schemas import SubscriptionBenefitCustomUpdate
from polar.subscription.service.benefits import (
    SubscriptionBenefitPreconditionError,
    SubscriptionBenefitServiceProtocol,
)
from polar.subscription.service.subscription_benefit_grant import (
    subscription_benefit_grant as subscription_benefit_grant_service,
)


@pytest.fixture(autouse=True)
def subscription_benefit_service_mock(mocker: MockerFixture) -> MagicMock:
    service_mock = MagicMock(spec=SubscriptionBenefitServiceProtocol)
    mock = mocker.patch(
        "polar.subscription.service.subscription_benefit_grant"
        ".get_subscription_benefit_service"
    )
    mock.return_value = service_mock
    return service_mock


@pytest.mark.asyncio
class TestGrantBenefit:
    async def test_not_existing_grant(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = await subscription_benefit_grant_service.grant_benefit(
            session, subscription, subscription_benefit_organization
        )

        assert grant.subscription_id == subscription.id
        assert grant.subscription_benefit_id == subscription_benefit_organization.id
        assert grant.is_granted
        subscription_benefit_service_mock.grant.assert_called_once()

    async def test_existing_grant_not_granted(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription_id=subscription.id,
            subscription_benefit_id=subscription_benefit_organization.id,
        )
        session.add(grant)
        await session.commit()

        updated_grant = await subscription_benefit_grant_service.grant_benefit(
            session, subscription, subscription_benefit_organization
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        subscription_benefit_service_mock.grant.assert_called_once()

    async def test_existing_grant_already_granted(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription_id=subscription.id,
            subscription_benefit_id=subscription_benefit_organization.id,
        )
        grant.set_granted()
        session.add(grant)
        await session.commit()

        updated_grant = await subscription_benefit_grant_service.grant_benefit(
            session, subscription, subscription_benefit_organization
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        subscription_benefit_service_mock.grant.assert_not_called()

    async def test_precondition_error(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        subscription_benefit_service_mock.grant.side_effect = (
            SubscriptionBenefitPreconditionError("Error")
        )

        grant = await subscription_benefit_grant_service.grant_benefit(
            session, subscription, subscription_benefit_organization
        )

        assert not grant.is_granted


@pytest.mark.asyncio
class TestRevokeBenefit:
    async def test_not_existing_grant(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = await subscription_benefit_grant_service.revoke_benefit(
            session, subscription, subscription_benefit_organization
        )

        assert grant.subscription_id == subscription.id
        assert grant.subscription_benefit_id == subscription_benefit_organization.id
        assert grant.is_revoked
        subscription_benefit_service_mock.revoke.assert_called_once()

    async def test_existing_grant_not_revoked(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription_id=subscription.id,
            subscription_benefit_id=subscription_benefit_organization.id,
        )
        session.add(grant)
        await session.commit()

        updated_grant = await subscription_benefit_grant_service.revoke_benefit(
            session, subscription, subscription_benefit_organization
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        subscription_benefit_service_mock.revoke.assert_called_once()

    async def test_existing_grant_already_revoked(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription_id=subscription.id,
            subscription_benefit_id=subscription_benefit_organization.id,
        )
        grant.set_revoked()
        session.add(grant)
        await session.commit()

        updated_grant = await subscription_benefit_grant_service.revoke_benefit(
            session, subscription, subscription_benefit_organization
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        subscription_benefit_service_mock.revoke.assert_not_called()


@pytest.mark.asyncio
class TestEnqueueBenefitGrantUpdates:
    async def test_not_required_update(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription_benefit_grant.enqueue_job"
        )
        subscription_benefit_service_mock.requires_update.return_value = False

        await subscription_benefit_grant_service.enqueue_benefit_grant_updates(
            session,
            subscription_benefit_organization,
            SubscriptionBenefitCustomUpdate(description="Update"),
        )

        enqueue_job_mock.assert_not_called()

    async def test_required_update(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_repository: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        granted_grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
        )
        granted_grant.set_granted()
        session.add(granted_grant)

        revoked_grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
        )
        revoked_grant.set_revoked()
        session.add(revoked_grant)

        other_benefit_grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_repository,
        )
        other_benefit_grant.set_granted()
        session.add(other_benefit_grant)

        await session.commit()

        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription_benefit_grant.enqueue_job"
        )
        subscription_benefit_service_mock.requires_update.return_value = True

        await subscription_benefit_grant_service.enqueue_benefit_grant_updates(
            session,
            subscription_benefit_organization,
            SubscriptionBenefitCustomUpdate(description="Update"),
        )

        enqueue_job_mock.assert_called_once_with(
            "subscription.subscription_benefit.update",
            subscription_benefit_grant_id=granted_grant.id,
        )


@pytest.mark.asyncio
class TestUpdateBenefitGrant:
    async def test_revoked_grant(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
        )
        grant.set_revoked()
        session.add(grant)
        await session.commit()

        updated_grant = await subscription_benefit_grant_service.update_benefit_grant(
            session, grant
        )

        assert updated_grant.id == grant.id
        subscription_benefit_service_mock.grant.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
        )
        grant.set_granted()
        session.add(grant)
        await session.commit()

        updated_grant = await subscription_benefit_grant_service.update_benefit_grant(
            session, grant
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        subscription_benefit_service_mock.grant.assert_called_once()

    async def test_precondition_error(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
        )
        grant.set_granted()
        session.add(grant)
        await session.commit()

        subscription_benefit_service_mock.grant.side_effect = (
            SubscriptionBenefitPreconditionError("Error")
        )

        updated_grant = await subscription_benefit_grant_service.update_benefit_grant(
            session, grant
        )

        assert not updated_grant.is_granted


@pytest.mark.asyncio
class TestEnqueueBenefitGrantDeletions:
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_repository: SubscriptionBenefit,
    ) -> None:
        granted_grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
        )
        granted_grant.set_granted()
        session.add(granted_grant)

        revoked_grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
        )
        revoked_grant.set_revoked()
        session.add(revoked_grant)

        other_benefit_grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_repository,
        )
        other_benefit_grant.set_granted()
        session.add(other_benefit_grant)

        await session.commit()

        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription_benefit_grant.enqueue_job"
        )

        await subscription_benefit_grant_service.enqueue_benefit_grant_deletions(
            session, subscription_benefit_organization
        )

        enqueue_job_mock.assert_called_once_with(
            "subscription.subscription_benefit.delete",
            subscription_benefit_grant_id=granted_grant.id,
        )


@pytest.mark.asyncio
class TestDeleteBenefitGrant:
    async def test_revoked_grant(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
        )
        grant.set_revoked()
        session.add(grant)
        await session.commit()

        updated_grant = await subscription_benefit_grant_service.delete_benefit_grant(
            session, grant
        )

        assert updated_grant.id == grant.id
        subscription_benefit_service_mock.revoke.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        subscription_benefit_service_mock: MagicMock,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
        )
        grant.set_granted()
        session.add(grant)
        await session.commit()

        updated_grant = await subscription_benefit_grant_service.delete_benefit_grant(
            session, grant
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        subscription_benefit_service_mock.revoke.assert_called_once()


@pytest.fixture
def email_sender_mock(mocker: MockerFixture) -> MagicMock:
    email_sender_mock = MagicMock()
    mocker.patch(
        "polar.subscription.service.subscription_benefit_grant.get_email_sender",
        return_value=email_sender_mock,
    )
    return email_sender_mock


@pytest.mark.asyncio
class TestHandlePreconditionError:
    async def test_no_email(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        email_sender_mock: MagicMock,
    ) -> None:
        error = SubscriptionBenefitPreconditionError("Error")

        await subscription_benefit_grant_service.handle_precondition_error(
            session, error, subscription, subscription_benefit_organization
        )

        email_sender_mock.assert_not_called()

    async def test_email(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        email_sender_mock: MagicMock,
    ) -> None:
        error = SubscriptionBenefitPreconditionError(
            "Error",
            email_subject="Email subject",
            email_body_template="benefits/custom/precondition_failed.html",
            email_extra_context={"foo": "bar"},
        )

        await subscription_benefit_grant_service.handle_precondition_error(
            session, error, subscription, subscription_benefit_organization
        )

        send_to_user_mock: MagicMock = email_sender_mock.send_to_user
        assert send_to_user_mock.called
        to_email_addr = send_to_user_mock.call_args[0][0]

        assert subscription.user.email == to_email_addr
