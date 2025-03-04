from typing import Annotated

from pydantic import Field

from .. import forms


class AccountReviewForm(forms.BaseForm):
    next_review_threshold: Annotated[
        int,
        forms.CurrencyField(),
        forms.CurrencyValidator,
        Field(title="Next Review Threshold"),
    ]
