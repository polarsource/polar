from polar.enums import AccountType
from polar.models import Account, User
from polar.postgres import AsyncSession


def generate_account(
    user: User, fee_basis_points: int | None = None, fee_fixed: int | None = None
) -> Account:
    account = Account(
        account_type=AccountType.stripe,
        status=Account.Status.ACTIVE,
        next_review_threshold=1000,
        admin_id=user.id,
        country="US",
        currency="usd",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        _platform_fee_percent=fee_basis_points,
        _platform_fee_fixed=fee_fixed,
    )
    return account


class TestAccountFeeCalulations:
    def test_defaults(
        self,
        session: AsyncSession,
        user: User,
    ):
        session.expunge_all()
        # 4% + 40c
        account = generate_account(
            user,
            fee_basis_points=None,
            fee_fixed=None,
        )

        # $10 = $0.8 in fees (%: 0.4 + $: 0.4)
        assert account.calculate_fee_in_cents(1_000) == 80
        # $100 = $4.4 in fees (%: 4 + $: 0.4)
        assert account.calculate_fee_in_cents(10_000) == 440

        # Test some Stripe-like rounding

        # $87.3 = $3.89 (3.892) in fees (%: 3.492 + $: 0.4)
        assert account.calculate_fee_in_cents(8_730) == 389

        # $87.49 = $3.90 (3.8996) in fees (%: 3.4996 + $: 0.4)
        assert account.calculate_fee_in_cents(8_749) == 390

        # $87.6 = $3.90 (3.904) in fees (%: 3.504 + $: 0.4)
        assert account.calculate_fee_in_cents(8_760) == 390

    def test_custom(
        self,
        session: AsyncSession,
        user: User,
    ):
        session.expunge_all()
        # 4% + 40c
        account = generate_account(
            user,
            fee_basis_points=349,
            fee_fixed=35,
        )

        # $10 = $0.70 in fees (%: 0.349 + $: 0.35 = 0.699)
        assert account.calculate_fee_in_cents(1_000) == 70
        # $100 = $3.84 in fees (%: 3.49 + $: 0.35 = 3.84)
        assert account.calculate_fee_in_cents(10_000) == 384

        # Test some Stripe-like rounding

        # $87.3 = $3.40 (3.396) in fees (%: 3.04677 + $: 0.35 = 3.39677)
        assert account.calculate_fee_in_cents(8_730) == 340

        # $87.49 = $3.40 (3.403) in fees (%: 3.053401 + $: 0.35)
        assert account.calculate_fee_in_cents(8_749) == 340

        # $87.6 = $3.41 (3.407) in fees (%: 3.05724 + $: 0.35)
        assert account.calculate_fee_in_cents(8_760) == 341
