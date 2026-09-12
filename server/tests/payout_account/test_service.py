import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.enums import PayoutAccountStatus, PayoutAccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Organization, User, UserOrganization
from polar.models.payout_attempt import PayoutAttemptStatus
from polar.payout_account.schemas import (
    PayoutAccountCreate,
    StripeAccountCountry,
)
from polar.payout_account.service import (
    PayoutAccountHasPendingPayouts,
    PayoutAccountLinkedToOrganization,
    PayoutAccountNonZeroBalance,
    PayoutAccountStripeAccountDoesNotExist,
    PayoutAccountSyncFailed,
    PayoutAccountSyncUnsupported,
)
from polar.payout_account.service import (
    payout_account as payout_account_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_payout,
    create_payout_account,
)


def _stripe_account(id: str, country: str = "US") -> stripe_lib.Account:
    return stripe_lib.Account.construct_from(
        {
            "id": id,
            "email": "merchant@example.com",
            "country": country,
            "default_currency": "usd",
            "details_submitted": False,
            "charges_enabled": False,
            "payouts_enabled": False,
            "business_type": None,
        },
        None,
    )


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> StripeService:
    mock = mocker.MagicMock(spec=StripeService)
    mocker.patch("polar.payout_account.service.stripe", new=mock)
    return mock


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_enqueues_website_sync(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: StripeService,
    ) -> None:
        stripe_service_mock.create_account.return_value = (  # type: ignore[attr-defined]
            stripe_lib.Account.construct_from(
                {
                    "id": "acct_created",
                    "email": "merchant@example.com",
                    "country": "US",
                    "default_currency": "usd",
                    "details_submitted": False,
                    "charges_enabled": False,
                    "payouts_enabled": False,
                    "business_type": None,
                },
                None,
            )
        )
        enqueue_job_mock = mocker.patch("polar.payout_account.service.enqueue_job")

        await payout_account_service.create_or_resume(
            auth_subject,
            session,
            PayoutAccountCreate(
                type=PayoutAccountType.stripe,
                organization_id=organization.id,
                country=StripeAccountCountry.US,
            ),
        )

        enqueue_job_mock.assert_any_call(
            "organization.sync_payout_account_website",
            organization_id=organization.id,
        )

    @pytest.mark.auth
    async def test_resumes_an_unfinished_account(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        stripe_service_mock: StripeService,
    ) -> None:
        unfinished = await create_payout_account(
            save_fixture, organization, user, is_payouts_enabled=False, country="US"
        )

        payout_account = await payout_account_service.create_or_resume(
            auth_subject,
            session,
            PayoutAccountCreate(
                type=PayoutAccountType.stripe,
                organization_id=organization.id,
                country=StripeAccountCountry.US,
            ),
        )

        assert payout_account.id == unfinished.id
        stripe_service_mock.create_account.assert_not_called()  # type: ignore[attr-defined]

    @pytest.mark.auth
    async def test_another_country_creates_a_new_account(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        stripe_service_mock: StripeService,
    ) -> None:
        unfinished = await create_payout_account(
            save_fixture, organization, user, is_payouts_enabled=False, country="US"
        )
        stripe_service_mock.create_account.return_value = _stripe_account("acct_fr")  # type: ignore[attr-defined]

        payout_account = await payout_account_service.create_or_resume(
            auth_subject,
            session,
            PayoutAccountCreate(
                type=PayoutAccountType.stripe,
                organization_id=organization.id,
                country=StripeAccountCountry.FR,
            ),
        )

        await session.flush()
        assert payout_account.id != unfinished.id
        assert organization.payout_account_id == payout_account.id

    @pytest.mark.auth
    async def test_does_not_unlink_a_ready_account(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        stripe_service_mock: StripeService,
    ) -> None:
        ready = await create_payout_account(
            save_fixture, organization, user, is_payouts_enabled=True
        )
        stripe_service_mock.create_account.return_value = _stripe_account("acct_new")  # type: ignore[attr-defined]

        payout_account = await payout_account_service.create_or_resume(
            auth_subject,
            session,
            PayoutAccountCreate(
                type=PayoutAccountType.stripe,
                organization_id=organization.id,
                country=StripeAccountCountry.US,
            ),
        )

        await session.flush()
        assert payout_account.id != ready.id
        assert organization.payout_account_id == ready.id


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
    @pytest.mark.parametrize(
        "attempt_status", [PayoutAttemptStatus.pending, PayoutAttemptStatus.in_transit]
    )
    async def test_pending_payouts_raises_error(
        self,
        attempt_status: PayoutAttemptStatus,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        """Cannot delete a payout account that has pending or in-transit payouts."""
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        # Unlink from org first so we get past the linked check
        organization.payout_account = None
        await save_fixture(organization)

        account = await create_account(save_fixture, user)
        await create_payout(
            save_fixture,
            payout_account=payout_account,
            account=account,
            attempts=[attempt_status],
        )

        with pytest.raises(PayoutAccountHasPendingPayouts):
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

        account = await create_account(save_fixture, user)
        await create_payout(
            save_fixture,
            payout_account=payout_account,
            account=account,
            attempts=[PayoutAttemptStatus.succeeded],
        )

        stripe_service_mock.account_exists.return_value = True  # type: ignore[attr-defined]
        stripe_service_mock.retrieve_balance.return_value = ("usd", 0)  # type: ignore[attr-defined]
        stripe_service_mock.delete_account.return_value = None  # type: ignore[attr-defined]

        await payout_account_service.delete(session, payout_account)

        stripe_service_mock.delete_account.assert_called_once_with(  # type: ignore[attr-defined]
            payout_account.stripe_id
        )

    @pytest.mark.auth
    async def test_successful_deletion_unlinked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        """Successfully deletes a payout account if forcing organization unlinking."""
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )

        stripe_service_mock.account_exists.return_value = True  # type: ignore[attr-defined]
        stripe_service_mock.retrieve_balance.return_value = ("usd", 0)  # type: ignore[attr-defined]
        stripe_service_mock.delete_account.return_value = None  # type: ignore[attr-defined]

        await payout_account_service.delete(session, payout_account, unlink=True)

        stripe_service_mock.delete_account.assert_called_once_with(  # type: ignore[attr-defined]
            payout_account.stripe_id
        )


@pytest.mark.asyncio
class TestRejectStripeAccount:
    async def test_rejects_existing_stripe_account(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        stripe_service_mock.account_exists.return_value = True  # type: ignore[attr-defined]

        await payout_account_service.reject_stripe_account(
            session, payout_account.id, "fraud"
        )

        stripe_service_mock.reject_account.assert_called_once_with(  # type: ignore[attr-defined]
            payout_account.stripe_id, "fraud"
        )

    async def test_skips_when_stripe_account_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        stripe_service_mock.account_exists.return_value = False  # type: ignore[attr-defined]

        await payout_account_service.reject_stripe_account(
            session, payout_account.id, "terms_of_service"
        )

        stripe_service_mock.reject_account.assert_not_called()  # type: ignore[attr-defined]


@pytest.mark.asyncio
class TestSyncFromStripe:
    async def test_updates_account_from_stripe(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, is_payouts_enabled=False
        )
        stripe_service_mock.retrieve_account.return_value = (  # type: ignore[attr-defined]
            stripe_lib.Account.construct_from(
                {
                    "id": payout_account.stripe_id,
                    "email": "merchant@example.com",
                    "country": "DE",
                    "default_currency": "eur",
                    "details_submitted": True,
                    "charges_enabled": True,
                    "payouts_enabled": True,
                    "requirements": {"disabled_reason": None},
                },
                None,
            )
        )

        updated = await payout_account_service.sync_from_stripe(session, payout_account)

        assert updated.is_payouts_enabled is True
        assert updated.status == PayoutAccountStatus.ready

    async def test_manual_account_is_unsupported(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture,
            organization,
            user,
            type=PayoutAccountType.manual,
            stripe_id=None,
        )

        with pytest.raises(PayoutAccountSyncUnsupported):
            await payout_account_service.sync_from_stripe(session, payout_account)

        stripe_service_mock.retrieve_account.assert_not_called()  # type: ignore[attr-defined]

    @pytest.mark.parametrize(
        "error",
        [
            stripe_lib.PermissionError("no access"),
            stripe_lib.InvalidRequestError("no such account", param="account"),
        ],
    )
    async def test_inaccessible_account_is_not_transient(
        self,
        error: stripe_lib.StripeError,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)
        stripe_service_mock.retrieve_account.side_effect = error  # type: ignore[attr-defined]

        with pytest.raises(PayoutAccountStripeAccountDoesNotExist):
            await payout_account_service.sync_from_stripe(session, payout_account)

    async def test_unreachable_stripe_raises_sync_failed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)
        stripe_service_mock.retrieve_account.side_effect = (  # type: ignore[attr-defined]
            stripe_lib.APIConnectionError("boom")
        )

        with pytest.raises(PayoutAccountSyncFailed):
            await payout_account_service.sync_from_stripe(session, payout_account)
