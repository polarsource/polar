from typing import Annotated

from annotated_types import Ge
from pydantic import Field

from .. import forms


class RetryPayoutForm(forms.BaseForm):
    account_amount: Annotated[
        int | None,
        forms.InputField(type="number", placeholder="10000"),
        Ge(0),
        Field(
            title="Sub-Amount in CENTS",
            description="Amount to attempt to payout in **cents**. Leave empty to payout full amount.",
        ),
    ] = None
