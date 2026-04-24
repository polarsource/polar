from polar.config import settings


class TestGetMinimumPayoutForAccount:
    def test_panama_overrides_usd_default(self) -> None:
        assert settings.get_minimum_payout_for_account("usd", "PA") == 5000

    def test_el_salvador_overrides_usd_default(self) -> None:
        assert settings.get_minimum_payout_for_account("usd", "SV") == 3000

    def test_malaysia_country_beats_myr_currency(self) -> None:
        assert settings.get_minimum_payout_for_account("myr", "MY") == 2830

    def test_country_lookup_is_case_insensitive(self) -> None:
        assert (
            settings.get_minimum_payout_for_account("usd", "pa")
            == settings.get_minimum_payout_for_account("usd", "PA")
            == 5000
        )

    def test_unknown_country_falls_back_to_currency_minimum(self) -> None:
        assert settings.get_minimum_payout_for_account(
            "usd", "US"
        ) == settings.get_minimum_payout_for_currency("usd")

    def test_returns_max_of_currency_and_country_minimum(self) -> None:
        # EUR currency minimum is 1300; Panama's country minimum is 5000.
        # The country minimum should win.
        assert settings.get_minimum_payout_for_account("eur", "PA") == 5000
