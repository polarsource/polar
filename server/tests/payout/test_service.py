import datetime
from functools import partial
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Account, Organization, Transaction, User
from polar.payout.service import (
    InsufficientBalance,
    NotReadyAccount,
    UnderReviewAccount,
)
from polar.payout.service import payout as payout_service
from polar.postgres import AsyncSession
from polar.transaction.service.payout import (
    PayoutTransactionService,
)
from tests.fixtures import random_objects as ro
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout
from tests.transaction.conftest import (
    create_account,
)


@pytest.fixture(autouse=True)
def payout_transaction_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=PayoutTransactionService)
    mocker.patch("polar.payout.service.payout_transaction_service", new=mock)
    return mock


create_payment_transaction = partial(ro.create_payment_transaction, amount=10000)
create_refund_transaction = partial(ro.create_refund_transaction, amount=-10000)
create_balance_transaction = partial(ro.create_balance_transaction, amount=10000)


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.parametrize(
        "balance", [-1000, 0, settings.ACCOUNT_PAYOUT_MINIMUM_BALANCE - 1]
    )
    async def test_insufficient_balance(
        self,
        balance: int,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(save_fixture, organization, user)
        await create_balance_transaction(save_fixture, account=account, amount=balance)

        with pytest.raises(InsufficientBalance):
            await payout_service.create(session, locker, account=account)

    async def test_under_review_account(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture, organization, user, status=Account.Status.UNDER_REVIEW
        )

        with pytest.raises(UnderReviewAccount):
            await payout_service.create(session, locker, account=account)

    async def test_inactive_account(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture, organization, user, status=Account.Status.ONBOARDING_STARTED
        )

        with pytest.raises(NotReadyAccount):
            await payout_service.create(session, locker, account=account)

    async def test_payout_disabled_account(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture, organization, user, is_payouts_enabled=False
        )

        with pytest.raises(NotReadyAccount):
            await payout_service.create(session, locker, account=account)

    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        account = await create_account(save_fixture, organization, user)

        payment_transaction_1 = await create_payment_transaction(save_fixture)
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(save_fixture)
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        payout_transaction_service_mock.create.return_value = Transaction()

        payout = await payout_service.create(session, locker, account=account)

        assert payout.account == account
        assert payout.processor == account.account_type
        assert payout.currency == "usd"
        assert payout.amount > 0
        assert payout.fees_amount > 0
        assert payout.account_currency == "usd"
        assert payout.account_amount > 0

        payout_transaction_service_mock.create.assert_called_once()

    async def test_valid_different_currencies(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        payout_transaction_service_mock: MagicMock,
    ) -> None:
        account = await create_account(
            save_fixture, organization, user, country="FR", currency="eur"
        )

        payment_transaction_1 = await create_payment_transaction(save_fixture)
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(save_fixture)
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        payout_transaction_service_mock.create.return_value = Transaction(
            account_currency="eur", account_amount=-1000
        )

        payout = await payout_service.create(session, locker, account=account)

        assert payout.account == account
        assert payout.processor == account.account_type
        assert payout.account_currency == "eur"
        assert payout.account_amount == 1000

        payout_transaction_service_mock.create.assert_called_once()


@pytest.mark.asyncio
class TestTriggerStripePayouts:
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        organization_second: Organization,
        user_second: User,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        account_1 = await create_account(save_fixture, organization, user)
        account_2 = await create_account(save_fixture, organization_second, user_second)

        payout_1 = await create_payout(
            save_fixture,
            account=account_1,
            created_at=utc_now() - datetime.timedelta(days=14),
        )
        payout_2 = await create_payout(
            save_fixture,
            account=account_1,
            created_at=utc_now() - datetime.timedelta(days=7),
        )
        payout_3 = await create_payout(
            save_fixture,
            account=account_2,
            created_at=utc_now() - datetime.timedelta(days=7),
        )

        await payout_service.trigger_stripe_payouts(session)

        assert enqueue_job_mock.call_count == 2
        enqueue_job_mock.assert_any_call(
            "payout.trigger_stripe_payout", payout_id=payout_1.id
        )
        enqueue_job_mock.assert_any_call(
            "payout.trigger_stripe_payout", payout_id=payout_3.id
        )
