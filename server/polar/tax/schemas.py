from typing import Any, cast

import pycountry
from pydantic import Field

from polar.kit.schemas import Schema


class TaxJurisdiction(Schema):
    """Aggregated tax remitted by Polar for a single jurisdiction.

    US and Canadian jurisdictions are reported at the state/province level;
    every other country is aggregated at the country level.
    """

    id: str = Field(
        description=(
            "Stable identifier for the jurisdiction. "
            "For US/Canada it is `{country}-{state}` (e.g. `US-CA`), "
            "otherwise the country code (e.g. `GB`)."
        )
    )
    country: str = Field(
        description="ISO 3166-1 alpha-2 country code.", examples=["US", "GB"]
    )
    country_name: str = Field(description="Human-readable country name.")
    state: str | None = Field(
        None,
        description=(
            "ISO 3166-2 subdivision code, without the country prefix "
            "(e.g. `CA`). Only set for US and Canadian jurisdictions."
        ),
    )
    state_name: str | None = Field(
        None,
        description=(
            "Human-readable state/province name. "
            "Only set for US and Canadian jurisdictions."
        ),
    )
    currency: str = Field(description="Currency of the remitted tax amount.")
    tax_amount: int = Field(
        description=(
            "Net tax remitted by Polar in this jurisdiction, in the currency's "
            "minor unit. Refunds and disputes are netted out."
        )
    )
    order_count: int = Field(
        description="Number of orders that contributed tax to this jurisdiction."
    )

    @classmethod
    def from_aggregate(
        cls,
        *,
        country: str,
        state: str | None,
        currency: str,
        tax_amount: int,
        order_count: int,
    ) -> "TaxJurisdiction":
        country_obj = pycountry.countries.get(alpha_2=country)
        country_name = cast(Any, country_obj).name if country_obj else country

        state_name: str | None = None
        if state:
            subdivision = pycountry.subdivisions.get(code=f"{country}-{state}")
            state_name = cast(Any, subdivision).name if subdivision else state

        return cls(
            id=f"{country}-{state}" if state else country,
            country=country,
            country_name=country_name,
            state=state,
            state_name=state_name,
            currency=currency,
            tax_amount=tax_amount,
            order_count=order_count,
        )
