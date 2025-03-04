from typing import Annotated

from annotated_types import Ge
from pydantic import Field

from .. import forms


class AccountReviewForm(forms.BaseForm):
    next_review_threshold: Annotated[
        int,
        forms.CurrencyField(),
        Ge(0),
        forms.CurrencyValidator,
        Field(title="Next Review Threshold"),
    ]
