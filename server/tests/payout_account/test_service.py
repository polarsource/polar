import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.enums import PayoutAccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Organization, User
from polar.payout_account.service import (
    PayoutAccountLinkedToOrganization,
    PayoutAccountNonZeroBalance,
    PayoutAccountStripeAccountDoesNotExist,
)
from polar.payout_account.service import (
    payout_account as payout_account_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout_account


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> StripeService:
    mock = mocker.MagicMock(spec=StripeService)
    mocker.patch("polar.payout_account.service.stripe", new=mock)
    return mock


@pytest.mark.asyncio
class TestDelete:
    @pytest.mark.auth
    async def test_linked_to_organization_raises_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        """Cannot delete a payout account linked to an organization."""
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )

        with pytest.raises(PayoutAccountLinkedToOrganization):
            await payout_account_service.delete(session, payout_account)

    @pytest.mark.auth
    async def test_stripe_account_does_not_exist_raises_error(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        """Cannot delete a payout account when Stripe account doesn't exist."""
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        # Unlink from org first so we get past the linked check
        organization.payout_account = None
        await save_fixture(organization)

        stripe_service_mock.account_exists.return_value = False  # type: ignore[attr-defined]

        with pytest.raises(PayoutAccountStripeAccountDoesNotExist):
            await payout_account_service.delete(session, payout_account)

    @pytest.mark.auth
    async def test_non_zero_balance_raises_error(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        """Cannot delete a payout account with a non-zero Stripe balance."""
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        # Unlink from org first so we get past the linked check
        organization.payout_account = None
        await save_fixture(organization)

        stripe_service_mock.account_exists.return_value = True  # type: ignore[attr-defined]
        stripe_service_mock.retrieve_balance.return_value = ("usd", 5000)  # type: ignore[attr-defined]

        with pytest.raises(PayoutAccountNonZeroBalance):
            await payout_account_service.delete(session, payout_account)

    @pytest.mark.auth
    async def test_successful_deletion(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        """Successfully deletes a payout account with zero balance."""
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        # Unlink from org so we get past the linked check
        organization.payout_account = None
        await save_fixture(organization)

        stripe_service_mock.account_exists.return_value = True  # type: ignore[attr-defined]
        stripe_service_mock.retrieve_balance.return_value = ("usd", 0)  # type: ignore[attr-defined]
        stripe_service_mock.delete_account.return_value = None  # type: ignore[attr-defined]

        await payout_account_service.delete(session, payout_account)

        stripe_service_mock.delete_account.assert_called_once_with(  # type: ignore[attr-defined]
            payout_account.stripe_id
        )
