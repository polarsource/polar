import pytest
from pytest_mock import MockerFixture

from polar.account.service import account as account_service
from polar.models import Account, Transaction, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from tests.account.conftest import create_account
from tests.fixtures.database import SaveFixture


async def create_transaction(
    save_fixture: SaveFixture, *, account: Account | None = None, amount: int = 1000
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.balance,
        processor=PaymentProcessor.stripe,
        currency="usd",
        amount=amount,
        account_currency="eur",
        account_amount=int(amount * 0.9),
        tax_amount=0,
        account=account,
    )
    await save_fixture(transaction)
    return transaction


@pytest.mark.asyncio
class TestCheckReviewThreshold:
    @pytest.mark.parametrize(
        "status", [Account.Status.ACTIVE, Account.Status.UNDER_REVIEW]
    )
    async def test_not_applicable_account(
        self,
        status: Account.Status,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.account.service.enqueue_job")

        account = await create_account(save_fixture, admin=user, status=status)

        # then
        session.expunge_all()

        updated_account = await account_service.check_review_threshold(session, account)
        assert updated_account.status == status

        enqueue_job_mock.assert_not_called()

    async def test_below_threshold(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.account.service.enqueue_job")

        account = await create_account(
            save_fixture, admin=user, status=Account.Status.UNREVIEWED
        )
        await create_transaction(save_fixture, account=account)

        # then
        session.expunge_all()

        updated_account = await account_service.check_review_threshold(session, account)
        assert updated_account.status == Account.Status.UNREVIEWED

        enqueue_job_mock.assert_not_called()

    async def test_above_threshold(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.account.service.enqueue_job")

        account = await create_account(
            save_fixture, admin=user, status=Account.Status.UNREVIEWED
        )
        for _ in range(0, 10):
            await create_transaction(save_fixture, account=account)

        # then
        session.expunge_all()

        updated_account = await account_service.check_review_threshold(session, account)
        assert updated_account.status == Account.Status.UNDER_REVIEW

        enqueue_job_mock.assert_called_once_with(
            "account.under_review", account_id=account.id
        )


@pytest.mark.asyncio
class TestConfirmAccountReviewed:
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture, admin=user, status=Account.Status.UNDER_REVIEW
        )

        enqueue_job_mock = mocker.patch("polar.account.service.enqueue_job")

        # then
        session.expunge_all()

        updated_account = await account_service.confirm_account_reviewed(
            session, account
        )

        assert updated_account.status == Account.Status.ACTIVE

        enqueue_job_mock.assert_called_once_with(
            "account.reviewed", account_id=account.id
        )
