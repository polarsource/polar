from typing import Annotated

from pydantic import Field

from polar.kit.schemas import EmptyStrToNone
from polar.models.refund import RefundReason

from .. import forms


class RefundForm(forms.BaseForm):
    reason: Annotated[RefundReason, Field(title="Refund reason")]
    amount: Annotated[int, Field(gt=0, title="Amount to refund (in cents)")]
    comment: Annotated[EmptyStrToNone, Field(default=None, title="Internal comment")]
    revoke_benefits: Annotated[bool, Field(default=False, title="Revoke benefits")]
