from pydantic import Field

from polar.currency.schemas import CurrencyAmount
from polar.kit.schemas import Schema


# Public API
class Funding(Schema):
    funding_goal: CurrencyAmount | None
    pledges_sum: CurrencyAmount | None = Field(
        description="Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD."  # noqa: E501
    )
