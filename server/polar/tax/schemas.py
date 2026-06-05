from typing import Any, cast

import pycountry
from pydantic import Field, computed_field

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
    state: str | None = Field(
        None,
        description=(
            "ISO 3166-2 subdivision code, without the country prefix "
            "(e.g. `CA`). Only set for US and Canadian jurisdictions."
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

    @computed_field(description="Human-readable country name.")  # type: ignore[prop-decorator]
    @property
    def country_name(self) -> str:
        country_obj = pycountry.countries.get(alpha_2=self.country)
        return cast(Any, country_obj).name if country_obj else self.country

    @computed_field(  # type: ignore[prop-decorator]
        description=(
            "Human-readable state/province name. "
            "Only set for US and Canadian jurisdictions."
        )
    )
    @property
    def state_name(self) -> str | None:
        if self.state is None:
            return None
        subdivision = pycountry.subdivisions.get(code=f"{self.country}-{self.state}")
        return cast(Any, subdivision).name if subdivision else self.state

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
        # Normalize codes to upper case so the constructed ID is stable
        # regardless of how the underlying transaction stored them (e.g. `us`
        # and `US` must resolve to the same `US-CA` identifier).
        country = country.upper()
        state = state.upper() if state else None

        return cls(
            id=f"{country}-{state}" if state else country,
            country=country,
            state=state,
            currency=currency,
            tax_amount=tax_amount,
            order_count=order_count,
        )


class TaxSummary(Schema):
    """Aggregated tax remitted by Polar across all jurisdictions.

    Totals span the full filtered dataset, independent of the pagination
    applied to the jurisdiction breakdown.
    """

    currency: str = Field(description="Currency of the remitted tax amount.")
    tax_amount: int = Field(
        description=(
            "Net tax remitted by Polar across all jurisdictions, in the "
            "currency's minor unit. Refunds and disputes are netted out."
        )
    )
    order_count: int = Field(
        description="Number of orders that contributed tax across all jurisdictions."
    )
    jurisdiction_count: int = Field(
        description="Number of distinct jurisdictions tax was remitted in."
    )
