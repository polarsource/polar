from datetime import timedelta
from typing import Annotated

from pydantic import Field

from polar.backoffice import forms


class UpdateAccountSettingsForm(forms.BaseForm):
    """Form for editing account settings including payout_transaction_delay."""

    payout_transaction_delay: Annotated[timedelta, forms.InputField(type="text")] = (
        Field(
            title="Payout Transaction Delay",
            description=(
                "Expected format is ISO8601 duration format "
                "(e.g., 'P3D' for 3 days, or 'PT12H' for 12 hours)."
            ),
        )
    )
