from typing import Annotated, Literal

from annotated_types import Ge
from pydantic import Discriminator, Field, TypeAdapter

from .. import forms


class ApproveAccountForm(forms.BaseForm):
    action: Annotated[Literal["approve"], forms.SkipField]
    next_review_threshold: Annotated[
        int,
        forms.CurrencyField(),
        Ge(0),
        forms.CurrencyValidator,
        Field(title="Next Review Threshold"),
    ]


class DenyAccountForm(forms.BaseForm):
    action: Annotated[Literal["deny"], forms.SkipField]


class UnderReviewAccountForm(forms.BaseForm):
    action: Annotated[Literal["under_review"], forms.SkipField]


AccountStatusForm = Annotated[
    ApproveAccountForm | DenyAccountForm | UnderReviewAccountForm,
    Discriminator("action"),
]

AccountStatusFormAdapter: TypeAdapter[AccountStatusForm] = TypeAdapter(
    AccountStatusForm
)


class UpdateOrganizationForm(forms.BaseForm):
    name: str
    slug: str
