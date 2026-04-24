from polar.config import settings


class TestGetMinimumPayoutForAccount:
    def test_panama_overrides_usd_default(self) -> None:
        # PA country min (5000) > USD currency min, so 5000 wins.
        assert settings.get_minimum_payout_for_account("usd", "PA") == 5000

    def test_el_salvador_overrides_usd_default(self) -> None:
        # SV country min (3000) > USD currency min, so 3000 wins.
        assert settings.get_minimum_payout_for_account("usd", "SV") == 3000

    def test_malaysia_currency_min_beats_country_min(self) -> None:
        # MYR currency min (4000) > MY country min (2830), so the currency min
        # wins. The function returns max(currency_min, country_min).
        myr_currency_min = settings.get_minimum_payout_for_currency("myr")
        assert myr_currency_min == 4000
        assert settings.get_minimum_payout_for_account("myr", "MY") == 4000

    def test_jamaica_falls_back_to_currency_min(self) -> None:
        # JM country min is 0; JMD has no currency override and falls back to
        # the default minimum. The default wins.
        jmd_currency_min = settings.get_minimum_payout_for_currency("jmd")
        assert (
            settings.get_minimum_payout_for_account("jmd", "JM") == jmd_currency_min
        )

    def test_united_states_currency_min_wins(self) -> None:
        # US country min is 1 cent; USD currency min is much higher, so the
        # currency min wins.
        usd_currency_min = settings.get_minimum_payout_for_currency("usd")
        assert settings.get_minimum_payout_for_account("usd", "US") == usd_currency_min

    def test_country_lookup_is_case_insensitive(self) -> None:
        assert (
            settings.get_minimum_payout_for_account("usd", "pa")
            == settings.get_minimum_payout_for_account("usd", "PA")
            == 5000
        )

    def test_returns_max_of_currency_and_country_minimum(self) -> None:
        # EUR currency minimum is 1300; Panama's country minimum is 5000.
        # The country minimum should win.
        assert settings.get_minimum_payout_for_account("eur", "PA") == 5000

    def test_unknown_country_falls_back_to_currency_minimum(self) -> None:
        # ZZ is not in the country dict, so only the currency min applies.
        usd_currency_min = settings.get_minimum_payout_for_currency("usd")
        assert settings.get_minimum_payout_for_account("usd", "ZZ") == usd_currency_min
