from polar.models import Account, User
from polar.postgres import AsyncSession


def generate_account(
    user: User,
    fee_basis_points: int | None = None,
    fee_fixed: int | None = None,
) -> Account:
    account = Account(
        currency="usd",
        _platform_fee_percent=fee_basis_points,
        _platform_fee_fixed=fee_fixed,
    )
    return account


class TestAccountFeeCalulations:
    def test_defaults(
        self,
        session: AsyncSession,
        user: User,
    ) -> None:
        session.expunge_all()
        # 5% + 50c
        account = generate_account(
            user,
            fee_basis_points=None,
            fee_fixed=None,
        )

        # $10 = $1.00 in fees (%: 0.5 + $: 0.5)
        assert account.calculate_fee_in_cents(1_000) == 100
        # $100 = $5.50 in fees (%: 5 + $: 0.5)
        assert account.calculate_fee_in_cents(10_000) == 550

        # Test some Stripe-like rounding

        # $87.3 = $4.87 (4.865) in fees (%: 4.365 + $: 0.5)
        assert account.calculate_fee_in_cents(8_730) == 487

        # $87.49 = $4.87 (4.8745) in fees (%: 4.3745 + $: 0.5)
        assert account.calculate_fee_in_cents(8_749) == 487

        # $87.6 = $4.88 (4.88) in fees (%: 4.38 + $: 0.5)
        assert account.calculate_fee_in_cents(8_760) == 488

    def test_custom(
        self,
        session: AsyncSession,
        user: User,
    ) -> None:
        session.expunge_all()
        # 3.49% + 35c
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
