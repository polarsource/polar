"""
FIXME: This is a dedicated module containing
only `Funding` to avoid circular imports.
The goal is to remove it whenever possible
in favor of the API implemented in this package.
"""
from pydantic import Field

from polar.currency.schemas import CurrencyAmount
from polar.kit.schemas import Schema


# Public API
class Funding(Schema):
    funding_goal: CurrencyAmount | None = None
    pledges_sum: CurrencyAmount | None = Field(
        None,
        description="Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.",  # noqa: E501
    )
