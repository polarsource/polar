from decimal import Decimal
from typing import Annotated, Any, Literal

from fastapi import Request
from pydantic import Field, create_model

from polar.kit.schemas import EmptyStrToNone
from polar.models.refund import ManualRefundReason, RefundReason

from .. import forms

BackofficeRefundReason = (
    ManualRefundReason
    | Literal[RefundReason.tax_refund, RefundReason.vat_reverse_charge_correction]
)

TAX_REFUND_REASONS = {
    RefundReason.tax_refund,
    RefundReason.vat_reverse_charge_correction,
}


class RefundForm(forms.BaseForm):
    reason: Annotated[BackofficeRefundReason, Field(title="Refund reason")]
    amount: Annotated[Decimal, Field(title="Amount to refund", gt=0, decimal_places=2)]
    comment: Annotated[EmptyStrToNone, Field(default=None, title="Internal comment")]
    revoke_benefits: Annotated[bool, Field(default=False, title="Revoke benefits")]


class TaxRefundForm(RefundForm):
    amount: Annotated[
        Decimal, Field(title="Tax amount to refund", gt=0, decimal_places=2)
    ]
    revoke_benefits: Annotated[bool, forms.SkipField()] = False


class VATRefundForm(TaxRefundForm):
    tax_id: Annotated[str, Field(title="Customer VAT ID", min_length=1)]


def build_refund_form_class(request: Request, reason: RefundReason) -> type[RefundForm]:
    base: type[RefundForm] = RefundForm
    if reason == RefundReason.vat_reverse_charge_correction:
        base = VATRefundForm
    elif reason == RefundReason.tax_refund:
        base = TaxRefundForm
    reason_field: Any = Annotated[
        BackofficeRefundReason,
        forms.SelectField(
            [
                (r.value, r.value.replace("_", " ").title())
                for r in RefundReason
                if r != RefundReason.dispute_prevention
            ],
            hx_get=str(request.url_for("orders:refund", id=request.path_params["id"])),
            hx_trigger="change",
            hx_target="#modal",
            hx_include="closest form",
        ),
        Field(title="Refund reason"),
    ]
    return create_model("OrderRefundForm", __base__=base, reason=(reason_field, ...))
