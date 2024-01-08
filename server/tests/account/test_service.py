import uuid

import pytest

from polar.account.service import AccountDoesNotExist
from polar.account.service import account as account_service
from polar.enums import AccountType
from polar.models import Account, Transaction, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession


async def create_account(
    session: AsyncSession, *, admin: User, status: Account.Status
) -> Account:
    account = Account(
        account_type=AccountType.stripe,
        status=status,
        admin_id=admin.id,
        country="US",
        currency="usd",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
    )
    session.add(account)
    await session.commit()
    session.expunge_all()
    return account


async def create_transaction(
    session: AsyncSession, *, account: Account | None = None, amount: int = 1000
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.transfer,
        processor=PaymentProcessor.stripe,
        currency="usd",
        amount=amount,
        account_currency="eur",
        account_amount=int(amount * 0.9),
        tax_amount=0,
        processor_fee_amount=0,
        account=account,
    )
    session.add(transaction)
    await session.commit()
    session.expunge_all()
    return transaction


@pytest.mark.asyncio
class TestCheckReviewThreshold:
    async def test_not_existing_account(self, session: AsyncSession) -> None:
        session.expunge_all()

        with pytest.raises(AccountDoesNotExist):
            await account_service.check_review_threshold(session, uuid.uuid4())

    async def test_active_account(self, session: AsyncSession, user: User) -> None:
        account = await create_account(
            session, admin=user, status=Account.Status.ACTIVE
        )
        updated_account = await account_service.check_review_threshold(
            session, account.id
        )
        assert updated_account.status == Account.Status.ACTIVE

    async def test_below_threshold(self, session: AsyncSession, user: User) -> None:
        account = await create_account(
            session, admin=user, status=Account.Status.UNREVIEWED
        )
        await create_transaction(session, account=account)

        updated_account = await account_service.check_review_threshold(
            session, account.id
        )
        assert updated_account.status == Account.Status.UNREVIEWED

    async def test_above_threshold(self, session: AsyncSession, user: User) -> None:
        account = await create_account(
            session, admin=user, status=Account.Status.UNREVIEWED
        )
        for _ in range(0, 10):
            await create_transaction(session, account=account)

        updated_account = await account_service.check_review_threshold(
            session, account.id
        )
        assert updated_account.status == Account.Status.UNDER_REVIEW
