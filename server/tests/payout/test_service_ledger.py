"""Integration tests for the held-payout ledger mechanics.

Unlike ``test_service.py`` these exercise the *real* transaction and platform
fee services (no mocks), so they assert the actual available-balance effect of
holding then canceling a payout — the guarantee from Appendix A of the
payout-reviews RFC: canceling a held payout returns the full reserved amount
(gross plus fees) to the merchant.
"""

from datetime import timedelta
from functools import partial

import pytest

from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Account, Organization, User
from polar.models.organization import OrganizationStatus
from polar.models.payout import PayoutStatus
from polar.payout.service import payout as payout_service
from polar.postgres import AsyncSession
from polar.transaction.service.transaction import transaction as transaction_service
from tests.fixtures import random_objects as ro
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout_account

ten_days_ago = utc_now() - timedelta(days=10)
create_payment_transaction = partial(
    ro.create_payment_transaction, amount=10000, created_at=ten_days_ago
)
create_balance_transaction = partial(
    ro.create_balance_transaction, amount=10000, created_at=ten_days_ago
)


@pytest.mark.asyncio
class TestHeldPayoutLedger:
    async def test_cancel_held_returns_gross_and_fees(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.set_status(OrganizationStatus.REVIEW)
        await save_fixture(organization)

        await create_payout_account(save_fixture, organization, user)

        payment_transaction = await create_payment_transaction(save_fixture)
        await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction
        )

        summary_before = await transaction_service.get_summary(session, account)
        available_before = summary_before.available_balance.amount
        assert available_before == 10000

        payout = await payout_service.create(session, locker, organization)
        assert payout.status == PayoutStatus.held
        # Held reserves the balance exactly like a pending payout: gross plus
        # fees are deducted from the available balance right away.
        assert payout.fees_amount > 0

        summary_held = await transaction_service.get_summary(session, account)
        assert summary_held.available_balance.amount == 0

        canceled = await payout_service.cancel(session, payout)
        assert canceled.status == PayoutStatus.canceled

        summary_after = await transaction_service.get_summary(session, account)
        # The full reserved amount (gross plus fees) is returned to the ledger:
        # the total balance is restored to its original value.
        assert summary_after.balance.amount == available_before
        # The fees become available immediately (they carry a payout fee type).
        # The gross is returned via a payout_reversal row, which re-ages into
        # the available balance like any other balance row — this matches how
        # canceling a regular pending payout already behaves.
        assert summary_after.available_balance.amount == payout.fees_amount
