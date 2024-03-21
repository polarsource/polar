from pydantic import Field

from polar.kit.schemas import Schema


# Public API
class CurrencyAmount(Schema):
    currency: str = Field(description="Three letter currency code (eg: USD)")
    amount: int = Field(
        description="Amount in the currencies smallest unit (cents if currency is USD)"
    )
