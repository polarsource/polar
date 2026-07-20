import pytest
import pytest_asyncio

from polar.enums import PayoutAccountType
from polar.models import Account, Organization, PayoutAccount, User
from polar.models.transaction import TransactionType
from polar.observability.invariants.rules.payout_transactions_amount_invariant import (
    PayoutTransactionsAmountInvariant,
    PayoutTransactionsAmountInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout, create_payout_account
from tests.transaction.conftest import create_transaction


@pytest_asyncio.fixture
async def payout_account_fixture(
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
) -> tuple[Account, PayoutAccount]:
    """Create and return account, payout_account tuple for testing."""
    account = organization.account
    payout_account = await create_payout_account(
        save_fixture,
        organization=organization,
        user=user,
        type=PayoutAccountType.stripe,
    )
    return account, payout_account


@pytest_asyncio.fixture
async def invariant(session: AsyncSession) -> PayoutTransactionsAmountInvariant:
    return PayoutTransactionsAmountInvariant(session)


@pytest.mark.asyncio
async def test_success_no_payouts(
    invariant: PayoutTransactionsAmountInvariant,
) -> None:
    """No payout transactions exist - invariant should pass."""
    await invariant.check()


@pytest.mark.asyncio
async def test_success_matching_amounts(
    invariant: PayoutTransactionsAmountInvariant,
    save_fixture: SaveFixture,
    payout_account_fixture: tuple[Account, PayoutAccount],
) -> None:
    """Payout with transactions that sum correctly - invariant should pass."""
    account, payout_account = payout_account_fixture

    # Create payout transaction first
    payout_transaction = await create_transaction(
        save_fixture,
        type=TransactionType.payout,
        amount=-1000,  # -$10.00 from Polar's perspective
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=1000,
    )

    # Create payout with the transaction
    payout = await create_payout(
        save_fixture,
        payout_account=payout_account,
        account=account,
        transaction=payout_transaction,
        amount=-1000,
        fees_amount=0,
        account_amount=1000,
    )

    # Create two balance transactions that sum to 1000
    await create_transaction(
        save_fixture,
        type=TransactionType.balance,
        amount=300,
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=300,
        payout_transaction=payout_transaction,
    )

    await create_transaction(
        save_fixture,
        type=TransactionType.balance,
        amount=700,
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=700,
        payout_transaction=payout_transaction,
    )

    # ABS(-1000) = 1000, sum = 300 + 700 = 1000, diff = 0
    await invariant.check()


@pytest.mark.asyncio
async def test_success_zero_amount(
    invariant: PayoutTransactionsAmountInvariant,
    save_fixture: SaveFixture,
    payout_account_fixture: tuple[Account, PayoutAccount],
) -> None:
    """Payout with amount=0 and no paid transactions - invariant should pass."""
    account, payout_account = payout_account_fixture

    # Create payout transaction first
    payout_transaction = await create_transaction(
        save_fixture,
        type=TransactionType.payout,
        amount=0,
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=0,
    )

    # Create payout with the transaction
    payout = await create_payout(
        save_fixture,
        payout_account=payout_account,
        account=account,
        transaction=payout_transaction,
        amount=0,
        fees_amount=0,
        account_amount=0,
    )

    # ABS(0) = 0, sum = 0, diff = 0
    await invariant.check()


@pytest.mark.asyncio
async def test_failure_amount_mismatch(
    invariant: PayoutTransactionsAmountInvariant,
    save_fixture: SaveFixture,
    payout_account_fixture: tuple[Account, PayoutAccount],
) -> None:
    """Payout with transactions that don't sum to payout amount - should fail."""
    account, payout_account = payout_account_fixture

    # Create payout transaction first
    payout_transaction = await create_transaction(
        save_fixture,
        type=TransactionType.payout,
        amount=-1000,  # -$10.00
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=1000,
    )

    # Create payout with the transaction
    payout = await create_payout(
        save_fixture,
        payout_account=payout_account,
        account=account,
        transaction=payout_transaction,
        amount=-1000,
        fees_amount=0,
        account_amount=1000,
    )

    # Create balance transaction with wrong amount
    await create_transaction(
        save_fixture,
        type=TransactionType.balance,
        amount=500,  # $5.00 instead of $10.00
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=500,
        payout_transaction=payout_transaction,
    )

    # ABS(-1000) = 1000, sum = 500, diff = 500 > 0
    with pytest.raises(PayoutTransactionsAmountInvariantError) as exc_info:
        await invariant.check()

    assert exc_info.value.context["count"] == 1
    assert exc_info.value.context["payout_transactions"]["ids"] == [
        payout_transaction.id
    ]
    assert exc_info.value.context["payout_transactions"]["differences"] == [500]
    assert exc_info.value.context["payout_transactions"]["has_more"] is False


@pytest.mark.asyncio
async def test_failure_missing_transactions(
    invariant: PayoutTransactionsAmountInvariant,
    save_fixture: SaveFixture,
    payout_account_fixture: tuple[Account, PayoutAccount],
) -> None:
    """Payout with no transactions referencing it - should fail."""
    account, payout_account = payout_account_fixture

    # Create payout transaction first
    payout_transaction = await create_transaction(
        save_fixture,
        type=TransactionType.payout,
        amount=-1000,
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=1000,
    )

    # Create payout with the transaction
    payout = await create_payout(
        save_fixture,
        payout_account=payout_account,
        account=account,
        transaction=payout_transaction,
        amount=-1000,
        fees_amount=0,
        account_amount=1000,
    )

    # No balance transactions created
    # ABS(-1000) = 1000, sum = 0, diff = 1000 > 0
    with pytest.raises(PayoutTransactionsAmountInvariantError) as exc_info:
        await invariant.check()

    assert exc_info.value.context["count"] == 1
    assert exc_info.value.context["payout_transactions"]["ids"] == [
        payout_transaction.id
    ]
    assert exc_info.value.context["payout_transactions"]["differences"] == [1000]


@pytest.mark.asyncio
async def test_failure_sum_exceeds_payout(
    invariant: PayoutTransactionsAmountInvariant,
    save_fixture: SaveFixture,
    payout_account_fixture: tuple[Account, PayoutAccount],
) -> None:
    """Sum of paid transactions exceeds payout amount - should fail (caught by abs)."""
    account, payout_account = payout_account_fixture

    # Create payout transaction first
    payout_transaction = await create_transaction(
        save_fixture,
        type=TransactionType.payout,
        amount=-500,  # -$5.00
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=500,
    )

    # Create payout with the transaction
    payout = await create_payout(
        save_fixture,
        payout_account=payout_account,
        account=account,
        transaction=payout_transaction,
        amount=-500,
        fees_amount=0,
        account_amount=500,
    )

    # Create balance transaction with amount > payout
    await create_transaction(
        save_fixture,
        type=TransactionType.balance,
        amount=1000,  # $10.00 > $5.00
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=1000,
        payout_transaction=payout_transaction,
    )

    # ABS(-500) = 500, sum = 1000, diff = -500, ABS(diff) = 500 > 0
    with pytest.raises(PayoutTransactionsAmountInvariantError) as exc_info:
        await invariant.check()

    assert exc_info.value.context["count"] == 1
    assert exc_info.value.context["payout_transactions"]["ids"] == [
        payout_transaction.id
    ]
    # diff = 500 - 1000 = -500
    assert exc_info.value.context["payout_transactions"]["differences"] == [-500]


@pytest.mark.asyncio
async def test_failure_over_limit(
    invariant: PayoutTransactionsAmountInvariant,
    save_fixture: SaveFixture,
    payout_account_fixture: tuple[Account, PayoutAccount],
) -> None:
    """More violations than LIMIT - verify has_more flag."""
    account, payout_account = payout_account_fixture

    # Create 15 payout transactions with mismatches (no paid transactions)
    for i in range(15):
        payout_transaction = await create_transaction(
            save_fixture,
            type=TransactionType.payout,
            amount=-1000,
            account=account,
            account_currency="usd",
            presentment_currency="usd",
            presentment_amount=1000,
        )

        await create_payout(
            save_fixture,
            payout_account=payout_account,
            account=account,
            transaction=payout_transaction,
            amount=-1000,
            fees_amount=0,
            account_amount=1000,
            invoice_number=f"INV-{i:03d}",
        )

    with pytest.raises(PayoutTransactionsAmountInvariantError) as exc_info:
        await invariant.check()

    assert exc_info.value.context["count"] == 15
    assert len(exc_info.value.context["payout_transactions"]["ids"]) == 10  # LIMIT
    assert exc_info.value.context["payout_transactions"]["has_more"] is True


@pytest.mark.asyncio
async def test_excludes_reversed_payouts(
    invariant: PayoutTransactionsAmountInvariant,
    save_fixture: SaveFixture,
    payout_account_fixture: tuple[Account, PayoutAccount],
) -> None:
    """Payout that has been reversed should be excluded from check."""
    account, payout_account = payout_account_fixture

    # Create payout transaction first
    payout_transaction = await create_transaction(
        save_fixture,
        type=TransactionType.payout,
        amount=-1000,
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=1000,
    )

    # Create payout with the transaction
    payout = await create_payout(
        save_fixture,
        payout_account=payout_account,
        account=account,
        transaction=payout_transaction,
        amount=-1000,
        fees_amount=0,
        account_amount=1000,
        invoice_number="INV-REVERSED",
    )

    # Create a payout_reversal transaction (same payout_id)
    await create_transaction(
        save_fixture,
        type=TransactionType.payout_reversal,
        amount=1000,
        account=account,
        account_currency="usd",
        presentment_currency="usd",
        presentment_amount=1000,
        payout=payout,  # Same payout_id
    )

    # The payout_transaction should be excluded because there's a payout_reversal
    # with the same payout_id
    await invariant.check()
