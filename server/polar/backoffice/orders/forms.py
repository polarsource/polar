from decimal import Decimal
from typing import Annotated

from pydantic import Field

from polar.kit.schemas import EmptyStrToNone
from polar.models.refund import RefundReason

from .. import forms


class RefundForm(forms.BaseForm):
    reason: Annotated[RefundReason, Field(title="Refund reason")]
    amount: Annotated[Decimal, Field(title="Amount to refund", gt=0, decimal_places=2)]
    comment: Annotated[EmptyStrToNone, Field(default=None, title="Internal comment")]
    revoke_benefits: Annotated[bool, Field(default=False, title="Revoke benefits")]
