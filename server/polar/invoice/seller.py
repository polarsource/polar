"""Polar's seller information for invoices.

Polar is registered for VAT in multiple jurisdictions. The VAT number shown
on an invoice depends on the other party's billing address: EU customers
get our EU OSS VAT number, UK customers get our UK VAT number, and
everyone else doesn't see a VAT number at all.
"""

from polar.config import Environment, settings
from polar.kit.address import Address
from polar.tax.tax_id import COUNTRY_TAX_ID_MAP, TaxID, TaxIDFormat

POLAR_EU_OSS_VAT_ID: TaxID = ("EU372061545", TaxIDFormat.eu_oss_vat)
POLAR_GB_VAT_ID: TaxID = ("GB458254961", TaxIDFormat.gb_vat)

EU_VAT_COUNTRIES: frozenset[str] = frozenset(
    country
    for country, formats in COUNTRY_TAX_ID_MAP.items()
    if TaxIDFormat.eu_vat in formats
)

SUPPORT_CONTACT_INFO = "[support@polar.sh](mailto:support@polar.sh)"


def get_polar_vat_id(address: Address | None) -> TaxID | None:
    """Polar's VAT number for an invoice, based on the other party's billing address."""
    if address is None:
        return None
    if address.country == "GB":
        return POLAR_GB_VAT_ID
    if address.country in EU_VAT_COUNTRIES:
        return POLAR_EU_OSS_VAT_ID
    return None


def get_polar_additional_info(address: Address | None) -> str | None:
    """Compose Polar's seller-side `additional_info` text for an invoice.

    Sandbox invoices are explicitly fake (a yellow warning banner is shown on
    the PDF), so we omit Polar's contact and VAT info there.
    """
    if settings.ENV == Environment.sandbox:
        return None

    parts = [SUPPORT_CONTACT_INFO]
    vat = get_polar_vat_id(address)
    if vat is not None:
        parts.append(f"VAT: {vat[0]}")
    return "\n".join(parts)


__all__ = [
    "EU_VAT_COUNTRIES",
    "POLAR_EU_OSS_VAT_ID",
    "POLAR_GB_VAT_ID",
    "SUPPORT_CONTACT_INFO",
    "get_polar_additional_info",
    "get_polar_vat_id",
]
