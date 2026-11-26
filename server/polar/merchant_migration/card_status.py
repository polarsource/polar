"""What a copied card left on Polar can do for a renewal, read from the card
itself each time so it stays current as cards expire or customers add new ones."""

from collections.abc import Mapping
from enum import StrEnum
from typing import Any

from polar.kit.utils import utc_now
from polar.models.payment_method import card_expiration


class MerchantMigrationCardStatus(StrEnum):
    ready = "ready"
    # The card copied, but India requires an issuer mandate for recurring
    # charges and it stays with the source account: renewals decline.
    india_card = "india_card"
    expired_card = "expired_card"
    no_card = "no_card"


def card_status(
    method_metadata: Mapping[str, Any] | None,
) -> MerchantMigrationCardStatus:
    """A card only proves itself on a real charge; these are the failures
    known ahead of one."""
    if method_metadata is None:
        return MerchantMigrationCardStatus.no_card
    if method_metadata.get("country") == "IN":
        return MerchantMigrationCardStatus.india_card
    year, month = method_metadata.get("exp_year"), method_metadata.get("exp_month")
    if (
        year is not None
        and month is not None
        and card_expiration(year, month) <= utc_now()
    ):
        return MerchantMigrationCardStatus.expired_card
    return MerchantMigrationCardStatus.ready
