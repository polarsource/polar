import pytest
import stripe
from arq import Retry

from polar.account.service import account as account_service
from polar.authz.service import Authz
from polar.donation.service import donation_service
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.tasks import charge_succeeded, payment_intent_succeeded
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.models.account import Account
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.user import User
from polar.organization.service import organization as organization_service
from polar.transaction.service.transaction import transaction as transaction_service
from polar.worker import JobContext, PolarWorkerContext

from .conftest import DonationSender, get_charge_succeeded, get_payment_intent_succeeded


@pytest.mark.asyncio
class TestDonations:
    async def test_payment_intent_succeeded(
        self,
        job_context: JobContext,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # then
        session.expunge_all()

        payment_intent_id = "pi_TESTING"
        latest_charge = "py_TESTING"
        to_organization_id = str(organization.id)

        # The pickled/unpickled version of stripe.Events is not the same as the version
        # you can create by calling the constructor. Using construct_from to replicate
        # the unpickling process.
        #
        # In the future, it would be cool if we where in better control of the data format
        # passed over the queue.
        ev = stripe.Event.construct_from(
            values=get_payment_intent_succeeded(
                payment_intent_id=payment_intent_id,
                latest_charge=latest_charge,
                metadata={
                    "type": "donation",
                    "to_organization_id": to_organization_id,
                },
            ),
            key=None,
        )

        await payment_intent_succeeded(
            job_context,
            event=ev,
            polar_context=PolarWorkerContext(),
        )

        # get
        donation = await donation_service.get_by_payment_id(session, payment_intent_id)
        assert donation

    async def test_charge_succeeded_before_payment_intent_throws(
        self,
        job_context: JobContext,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # then
        session.expunge_all()

        payment_intent_id = "pi_TESTING"
        charge_id = "py_TESTING"
        to_organization_id = str(organization.id)

        ev = stripe.Event.construct_from(
            values=get_charge_succeeded(
                payment_intent_id=payment_intent_id,
                charge_id=charge_id,
                metadata={
                    "type": "donation",
                    "to_organization_id": to_organization_id,
                },
                balance_transaction_id="txn_TEST",
            ),
            key=None,
        )

        with pytest.raises(Retry):
            await charge_succeeded(
                job_context,
                event=ev,
                polar_context=PolarWorkerContext(),
            )

    async def test_account_balance(
        self,
        session: AsyncSession,
        organization: Organization,
        open_collective_account: Account,
        user: User,
        donation_sender: DonationSender,
    ) -> None:
        organization.account_id = open_collective_account.id
        session.add(organization)
        await session.commit()

        # then
        session.expunge_all()

        await donation_sender.send_payment_intent_then_charge()

        # expect account balance
        summary = await transaction_service.get_summary(
            session, user, open_collective_account, await Authz.authz(session)
        )

        assert (
            1861 == summary.balance.amount
        )  # $20 minus Polar and payment processor fees
        assert 0 == summary.payout.amount

    async def test_held_balance(
        self,
        session: AsyncSession,
        organization: Organization,
        open_collective_account: Account,
        user: User,
        donation_sender: DonationSender,
    ) -> None:
        # then
        session.expunge_all()

        await donation_sender.send_payment_intent_then_charge()

        # expect held balance

        authz = await Authz.authz(session)

        # (account is not connected at this moment)
        summary = await transaction_service.get_summary(
            session, user, open_collective_account, authz
        )
        assert 0 == summary.balance.amount

        session.expunge_all()

        await organization_service.set_account(
            session,
            authz=authz,
            user=user,
            organization=organization,
            account_id=open_collective_account.id,
        )

        # get account again
        account = await account_service.get(session, open_collective_account.id)
        assert account

        # release balances
        released_tx = await held_balance_service.release_account(session, account)
        assert 1 == len(released_tx)

        # expect account balance
        summary = await transaction_service.get_summary(
            session, user, account, await Authz.authz(session)
        )

        assert (
            1861 == summary.balance.amount
        )  # $20 minus Polar and payment processor fees
        assert 0 == summary.payout.amount

    async def test_with_issue_id(
        self,
        session: AsyncSession,
        organization: Organization,
        open_collective_account: Account,
        user: User,
        donation_sender: DonationSender,
        issue: Issue,
    ) -> None:
        # then
        session.expunge_all()

        await donation_sender.send_payment_intent_then_charge(
            issue_id=issue.id,
        )

        # expect held balance

        (donations, _) = await donation_service.search(
            session,
            to_organization=organization,
            pagination=PaginationParams(page=1, limit=10),
        )

        assert 1 == len(donations)
        assert issue.id == donations[0].issue_id
