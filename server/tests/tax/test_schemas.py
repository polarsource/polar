from polar.tax.schemas import TaxJurisdiction


class TestTaxJurisdictionFromAggregate:
    def test_uppercase_codes(self) -> None:
        jurisdiction = TaxJurisdiction.from_aggregate(
            country="US",
            state="CA",
            currency="usd",
            tax_amount=120,
            order_count=3,
        )
        assert jurisdiction.id == "US-CA"
        assert jurisdiction.country == "US"
        assert jurisdiction.country_name == "United States"
        assert jurisdiction.state == "CA"
        assert jurisdiction.state_name == "California"

    def test_normalizes_lowercase_codes(self) -> None:
        # Whatever case the underlying transaction stored, the constructed
        # identifier and codes must be stable upper case.
        jurisdiction = TaxJurisdiction.from_aggregate(
            country="us",
            state="ca",
            currency="usd",
            tax_amount=120,
            order_count=3,
        )
        assert jurisdiction.id == "US-CA"
        assert jurisdiction.country == "US"
        assert jurisdiction.country_name == "United States"
        assert jurisdiction.state == "CA"
        assert jurisdiction.state_name == "California"

    def test_country_level_only(self) -> None:
        jurisdiction = TaxJurisdiction.from_aggregate(
            country="gb",
            state=None,
            currency="usd",
            tax_amount=300,
            order_count=2,
        )
        assert jurisdiction.id == "GB"
        assert jurisdiction.country == "GB"
        assert jurisdiction.country_name == "United Kingdom"
        assert jurisdiction.state is None
        assert jurisdiction.state_name is None
