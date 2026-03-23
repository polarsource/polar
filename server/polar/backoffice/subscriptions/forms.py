from datetime import UTC, datetime
from typing import Annotated

from pydantic import Field, field_validator

from polar.kit.schemas import EmptyStrToNone
from polar.models.subscription import CustomerCancellationReason

from .. import forms


class CancelForm(forms.BaseForm):
    customer_cancellation_reason: Annotated[
        CustomerCancellationReason, Field(title="Customer cancellation reason")
    ]
    customer_cancellation_comment: Annotated[
        EmptyStrToNone, Field(default=None, title="Customer cancellation comment")
    ]
    revoke: Annotated[bool, Field(default=False, title="Cancel immediately")]


class UpdateBillingPeriodEndForm(forms.BaseForm):
    new_period_end: Annotated[
        datetime,
        forms.InputField("datetime-local"),
        Field(title="New Period End"),
    ]

    @field_validator("new_period_end", mode="before")
    @classmethod
    def ensure_utc_timezone(cls, v: object) -> object:
        if isinstance(v, str):
            return datetime.fromisoformat(v).replace(tzinfo=UTC)
        return v
