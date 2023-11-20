from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, Organization, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.transfer import (
    StripeNotConfiguredOnDestinationAccount,
    UnsupportedAccountType,
)
from polar.transaction.service.transfer import (
    transfer_transaction as transfer_transaction_service,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.transfer.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
class TestCreateTransfer:
    async def test_unsupported_account_type(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type="UNKNOWN",
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="USD",
        )

        with pytest.raises(UnsupportedAccountType):
            await transfer_transaction_service.create_transfer(
                session,
                destination_account=account,
                currency="usd",
                amount=1000,
            )

    async def test_stripe_not_configured_on_destination_account(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            stripe_id=None,
        )

        with pytest.raises(StripeNotConfiguredOnDestinationAccount):
            await transfer_transaction_service.create_transfer(
                session,
                destination_account=account,
                currency="usd",
                amount=1000,
            )

    async def test_stripe(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        session.add(account)
        await session.commit()

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID", balance_transaction="STRIPE_BALANCE_TRANSACTION_ID"
        )
        stripe_service_mock.get_balance_transaction.return_value = SimpleNamespace(
            fee=100
        )

        outgoing, incoming = await transfer_transaction_service.create_transfer(
            session,
            destination_account=account,
            currency="usd",
            amount=1000,
        )

        assert outgoing.account_id is None
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.stripe
        assert outgoing.amount == -1000
        assert outgoing.processor_fee_amount == 100
        assert outgoing.transfer_id == "STRIPE_TRANSFER_ID"

        assert incoming.account_id == account.id
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.stripe
        assert incoming.amount == 1000
        assert outgoing.processor_fee_amount == 100
        assert incoming.transfer_id == "STRIPE_TRANSFER_ID"

        assert outgoing.id is not None
        assert incoming.id is not None

        stripe_service_mock.transfer.assert_called_once()
        assert stripe_service_mock.transfer.call_args[1]["metadata"][
            "outgoing_transaction_id"
        ] == str(outgoing.id)
        assert stripe_service_mock.transfer.call_args[1]["metadata"][
            "incoming_transaction_id"
        ] == str(incoming.id)

    async def test_open_collective(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = Account(
            account_type=AccountType.open_collective,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            open_collective_slug="polarsource",
        )
        session.add(account)
        await session.commit()

        outgoing, incoming = await transfer_transaction_service.create_transfer(
            session,
            destination_account=account,
            currency="usd",
            amount=1000,
        )

        assert outgoing.account_id is None
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.open_collective
        assert outgoing.amount == -1000

        assert incoming.account_id == account.id
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.open_collective
        assert incoming.amount == 1000
