from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Annotated, Any

from pydantic import Field, create_model, field_validator

from polar.kit.schemas import EmptyStrToNone
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus

from .. import forms


class CancelForm(forms.BaseForm):
    customer_cancellation_reason: Annotated[
        CustomerCancellationReason, Field(title="Customer cancellation reason")
    ]
    customer_cancellation_comment: Annotated[
        EmptyStrToNone, Field(default=None, title="Customer cancellation comment")
    ]
    revoke: Annotated[bool, Field(default=False, title="Cancel immediately")]


class UpdateStatusForm(forms.BaseForm):
    status: Annotated[SubscriptionStatus, Field(title="New status")]
    void_pending_orders: Annotated[
        bool,
        Field(
            default=False,
            title="Void pending orders",
            description=(
                "Stops dunning retries so the subscription "
                "doesn't fall back to past due."
            ),
        ),
    ]


def build_update_status_form(
    targets: Sequence[SubscriptionStatus], include_void_pending_orders: bool
) -> type[UpdateStatusForm]:
    fields: dict[str, Any] = {
        "status": (
            Annotated[
                SubscriptionStatus,
                forms.SelectField(
                    [
                        (target.value, target.value.replace("_", " ").title())
                        for target in targets
                    ]
                ),
                Field(title="New status"),
            ],
            ...,
        )
    }
    if not include_void_pending_orders:
        fields["void_pending_orders"] = (Annotated[bool, forms.SkipField()], False)
    return create_model("UpdateStatusForm", __base__=UpdateStatusForm, **fields)


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
