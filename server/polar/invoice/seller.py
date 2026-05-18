"""Polar's seller information for invoices.

Polar is registered for VAT in multiple jurisdictions. The number shown on
an invoice is looked up from `settings.INVOICES_VAT_NUMBERS` by the other
party's billing country: if there's no entry for that country, no VAT
number is shown.
"""

from polar.config import settings
from polar.kit.address import Address


def get_polar_vat_number(country: str | None) -> str | None:
    """Polar's VAT number for an invoice, based on the other party's billing country."""
    if country is None:
        return None
    return settings.INVOICES_VAT_NUMBERS.get(country)


def get_polar_additional_info(address: Address | None) -> str | None:
    """Compose Polar's seller-side `additional_info` text for an invoice."""
    parts: list[str] = []
    if settings.INVOICES_ADDITIONAL_INFO:
        parts.append(settings.INVOICES_ADDITIONAL_INFO)
    vat_number = get_polar_vat_number(address.country if address else None)
    if vat_number is not None:
        parts.append(f"VAT: {vat_number}")
    return "\n".join(parts) if parts else None


__all__ = ["get_polar_additional_info", "get_polar_vat_number"]
