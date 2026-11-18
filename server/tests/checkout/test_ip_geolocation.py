import pytest

from polar.checkout.ip_geolocation import get_tax_id_country
from polar.tax.tax_id import TaxID, TaxIDFormat


@pytest.mark.parametrize(
    ("tax_id", "expected"),
    [
        (("DE136695976", TaxIDFormat.eu_vat), "DE"),
        (("EL094259216", TaxIDFormat.eu_vat), "GR"),
        (("XI980780684", TaxIDFormat.eu_vat), "GB"),
        (("911144442", TaxIDFormat.us_ein), "US"),
        (("CHE123456789", TaxIDFormat.ch_vat), "CH"),
    ],
)
def test_get_tax_id_country(tax_id: TaxID, expected: str) -> None:
    assert get_tax_id_country(tax_id) == expected
