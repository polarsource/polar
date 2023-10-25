from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.models import Subscription, SubscriptionBenefit, SubscriptionBenefitGrant
from polar.postgres import AsyncSession
from polar.subscription.service.benefits import SubscriptionBenefitServiceProtocol
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
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
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
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
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
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
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
            subscription=subscription,
            subscription_benefit=subscription_benefit_organization,
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
